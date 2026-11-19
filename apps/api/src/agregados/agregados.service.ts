import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@raio-x/db';
import {
  buildPaginationMeta,
  type Comparacao,
  type ComparacaoQuery,
  type Estatisticas,
  type EstatisticasQuery,
  type Ranking,
  type RankingItem,
  type RankingQuery,
  type TotalCategoria,
} from '@raio-x/shared';
import { CacheService } from '../cache/cache.service';
import { decimal } from '../common/decimal';
import {
  COLUNAS_PARLAMENTAR,
  type LinhaParlamentar,
  resumoParlamentar,
  where,
} from '../common/sql';
import { PrismaService } from '../prisma/prisma.service';

const UMA_HORA = 3_600;
const TOP_GASTOS_HOME = 10;

type LinhaRanking = LinhaParlamentar & { total: Prisma.Decimal; quantidade: bigint };

@Injectable()
export class AgregadosService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Ano mais recente com despesas (padrão quando o cliente não informa o ano). */
  async anoMaisRecente(): Promise<number | null> {
    const { _max } = await this.prisma.despesa.aggregate({ _max: { ano: true } });
    return _max.ano;
  }

  /**
   * Total gasto por parlamentar no ano. Partido e UF são os atuais do parlamentar
   * (a fonte não informa o partido na data de cada despesa de forma consistente).
   */
  async ranking(query: RankingQuery): Promise<Ranking> {
    const ano = query.ano ?? (await this.anoMaisRecente());
    if (ano === null) return { ano, data: [], meta: buildPaginationMeta(query, 0) };

    return this.cache.obterOuCalcular(
      `ranking:${JSON.stringify({ ...query, ano })}`,
      UMA_HORA,
      async () => {
        const condicoes = [Prisma.sql`d.ano = ${ano}`];
        if (query.partido) condicoes.push(Prisma.sql`p.partido = ${query.partido}`);
        if (query.uf) condicoes.push(Prisma.sql`p.uf = ${query.uf}`);
        if (query.categoria) {
          condicoes.push(
            Prisma.sql`d."categoriaId" = (SELECT id FROM "Categoria" WHERE slug = ${query.categoria})`,
          );
        }
        const filtro = where(condicoes);
        const offset = (query.page - 1) * query.pageSize;

        const [linhas, contagem] = await Promise.all([
          this.prisma.$queryRaw<LinhaRanking[]>`
            SELECT ${COLUNAS_PARLAMENTAR}, SUM(d."valorLiquido") AS total, COUNT(*) AS quantidade
            FROM "Despesa" d JOIN "Parlamentar" p ON p.id = d."parlamentarId"
            ${filtro}
            GROUP BY p.id
            ORDER BY total DESC, p.nome ASC
            LIMIT ${query.pageSize} OFFSET ${offset}`,
          this.prisma.$queryRaw<[{ total: bigint }]>`
            SELECT COUNT(DISTINCT d."parlamentarId") AS total
            FROM "Despesa" d JOIN "Parlamentar" p ON p.id = d."parlamentarId"
            ${filtro}`,
        ]);

        return {
          ano,
          data: linhas.map((linha, i) => this.itemRanking(linha, offset + i + 1)),
          meta: buildPaginationMeta(query, Number(contagem[0].total)),
        };
      },
    );
  }

  async estatisticas(query: EstatisticasQuery): Promise<Estatisticas> {
    const anos = await this.prisma.despesa.groupBy({
      by: ['ano'],
      orderBy: { ano: 'desc' },
    });
    const anosDisponiveis = anos.map((a) => a.ano);
    const ano = query.ano ?? anosDisponiveis[0] ?? null;

    if (ano === null) {
      return {
        ano,
        anosDisponiveis,
        total: '0.00',
        quantidadeDespesas: 0,
        quantidadeParlamentares: 0,
        quantidadeFornecedores: 0,
        porCategoria: [],
        porUf: [],
        maioresGastos: [],
      };
    }

    return this.cache.obterOuCalcular(`estatisticas:${ano}`, UMA_HORA, async () => {
      const [[resumo], porCategoria, porUf, ranking] = await Promise.all([
        this.prisma.$queryRaw<
          [
            {
              total: Prisma.Decimal | null;
              despesas: bigint;
              parlamentares: bigint;
              fornecedores: bigint;
            },
          ]
        >`
          SELECT SUM("valorLiquido") AS total, COUNT(*) AS despesas,
                 COUNT(DISTINCT "parlamentarId") AS parlamentares,
                 COUNT(DISTINCT "fornecedorId") AS fornecedores
          FROM "Despesa" WHERE ano = ${ano}`,
        this.totaisPorCategoria(Prisma.sql`d.ano = ${ano}`),
        this.prisma.$queryRaw<{ uf: string; total: Prisma.Decimal; parlamentares: bigint }[]>`
          SELECT p.uf, SUM(d."valorLiquido") AS total, COUNT(DISTINCT p.id) AS parlamentares
          FROM "Despesa" d JOIN "Parlamentar" p ON p.id = d."parlamentarId"
          WHERE d.ano = ${ano} AND p.uf <> 'NA'
          GROUP BY p.uf
          ORDER BY total DESC`,
        this.ranking({ ano, page: 1, pageSize: TOP_GASTOS_HOME }),
      ]);

      return {
        ano,
        anosDisponiveis,
        total: decimal(resumo.total),
        quantidadeDespesas: Number(resumo.despesas),
        quantidadeParlamentares: Number(resumo.parlamentares),
        quantidadeFornecedores: Number(resumo.fornecedores),
        porCategoria,
        porUf: porUf.map((u) => ({
          uf: u.uf,
          total: decimal(u.total),
          parlamentares: Number(u.parlamentares),
          mediaPorParlamentar: decimal(u.total.div(Number(u.parlamentares))),
        })),
        maioresGastos: ranking.data,
      };
    });
  }

  async comparacao(query: ComparacaoQuery): Promise<Comparacao> {
    const parlamentares = await this.prisma.parlamentar.findMany({
      where: { id: { in: query.ids } },
      select: {
        id: true,
        casa: true,
        nome: true,
        partido: true,
        uf: true,
        fotoUrl: true,
        emExercicio: true,
      },
    });
    const faltando = query.ids.filter((id) => !parlamentares.some((p) => p.id === id));
    if (faltando.length > 0) {
      throw new NotFoundException(`Parlamentares não encontrados: ${faltando.join(', ')}`);
    }

    const ano =
      query.ano ??
      (
        await this.prisma.despesa.aggregate({
          where: { parlamentarId: { in: query.ids } },
          _max: { ano: true },
        })
      )._max.ano;

    // Mantém a ordem pedida pelo cliente (a ordem das colunas na tela)
    const ordenados = query.ids.map(
      (id) => parlamentares.find((p) => p.id === id) as (typeof parlamentares)[number],
    );

    if (ano === null) {
      return {
        ano,
        parlamentares: ordenados.map((p) => ({
          parlamentar: p,
          total: '0.00',
          quantidade: 0,
          categorias: [],
          mensal: [],
        })),
      };
    }

    return this.cache.obterOuCalcular(
      `comparacao:${ano}:${[...query.ids].sort().join(',')}`,
      UMA_HORA,
      async () => {
        const [totais, categorias, mensal] = await Promise.all([
          this.prisma.despesa.groupBy({
            by: ['parlamentarId'],
            where: { parlamentarId: { in: query.ids }, ano },
            _sum: { valorLiquido: true },
            _count: { _all: true },
          }),
          this.prisma.$queryRaw<
            { parlamentarId: string; slug: string; nome: string; total: Prisma.Decimal }[]
          >`
            SELECT d."parlamentarId", c.slug, c.nome, SUM(d."valorLiquido") AS total
            FROM "Despesa" d JOIN "Categoria" c ON c.id = d."categoriaId"
            WHERE d."parlamentarId" IN (${Prisma.join(query.ids)}) AND d.ano = ${ano}
            GROUP BY d."parlamentarId", c.slug, c.nome
            ORDER BY total DESC`,
          this.prisma.despesa.groupBy({
            by: ['parlamentarId', 'mes'],
            where: { parlamentarId: { in: query.ids }, ano },
            _sum: { valorLiquido: true },
            orderBy: [{ mes: 'asc' }],
          }),
        ]);

        return {
          ano,
          parlamentares: ordenados.map((p) => {
            const total = totais.find((t) => t.parlamentarId === p.id);
            return {
              parlamentar: p,
              total: decimal(total?._sum.valorLiquido),
              quantidade: total?._count._all ?? 0,
              categorias: categorias
                .filter((c) => c.parlamentarId === p.id)
                .map((c) => ({ slug: c.slug, nome: c.nome, total: decimal(c.total) })),
              mensal: mensal
                .filter((m) => m.parlamentarId === p.id)
                .map((m) => ({ ano, mes: m.mes, total: decimal(m._sum.valorLiquido) })),
            };
          }),
        };
      },
    );
  }

  private async totaisPorCategoria(condicao: Prisma.Sql): Promise<TotalCategoria[]> {
    const linhas = await this.prisma.$queryRaw<
      { slug: string; nome: string; total: Prisma.Decimal }[]
    >`
      SELECT c.slug, c.nome, SUM(d."valorLiquido") AS total
      FROM "Despesa" d JOIN "Categoria" c ON c.id = d."categoriaId"
      WHERE ${condicao}
      GROUP BY c.slug, c.nome
      ORDER BY total DESC`;
    return linhas.map((l) => ({ slug: l.slug, nome: l.nome, total: decimal(l.total) }));
  }

  private itemRanking(linha: LinhaRanking, posicao: number): RankingItem {
    return {
      posicao,
      parlamentar: resumoParlamentar(linha),
      total: decimal(linha.total),
      quantidade: Number(linha.quantidade),
    };
  }
}
