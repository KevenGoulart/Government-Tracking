import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { type Casa, Prisma } from '@raio-x/db';
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

  /** Ano mais recente com despesas da casa (padrão quando o cliente não informa o ano). */
  async anoMaisRecente(casa: Casa): Promise<number | null> {
    const { _max } = await this.prisma.despesa.aggregate({
      where: { parlamentar: { casa } },
      _max: { ano: true },
    });
    return _max.ano;
  }

  /**
   * Total gasto por parlamentar no ano, numa das casas (as cotas da Câmara e do Senado têm
   * regras e limites diferentes e nunca são somadas). Partido e UF são os atuais.
   */
  async ranking(query: RankingQuery): Promise<Ranking> {
    const { casa } = query;
    const ano = query.ano ?? (await this.anoMaisRecente(casa));
    if (ano === null) return { casa, ano, data: [], meta: buildPaginationMeta(query, 0) };

    return this.cache.obterOuCalcular(
      `ranking:${JSON.stringify({ ...query, ano })}`,
      UMA_HORA,
      async () => {
        const condicoes = [Prisma.sql`d.ano = ${ano}`, Prisma.sql`p.casa = ${casa}::"Casa"`];
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
          casa,
          ano,
          data: linhas.map((linha, i) => this.itemRanking(linha, offset + i + 1)),
          meta: buildPaginationMeta(query, Number(contagem[0].total)),
        };
      },
    );
  }

  async estatisticas(query: EstatisticasQuery): Promise<Estatisticas> {
    const { casa } = query;
    const anos = await this.prisma.despesa.groupBy({
      by: ['ano'],
      where: { parlamentar: { casa } },
      orderBy: { ano: 'desc' },
    });
    const anosDisponiveis = anos.map((a) => a.ano);
    const ano = query.ano ?? anosDisponiveis[0] ?? null;

    if (ano === null) {
      return {
        casa,
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

    return this.cache.obterOuCalcular(`estatisticas:${casa}:${ano}`, UMA_HORA, async () => {
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
          SELECT SUM(d."valorLiquido") AS total, COUNT(*) AS despesas,
                 COUNT(DISTINCT d."parlamentarId") AS parlamentares,
                 COUNT(DISTINCT d."fornecedorId") AS fornecedores
          FROM "Despesa" d JOIN "Parlamentar" p ON p.id = d."parlamentarId"
          WHERE d.ano = ${ano} AND p.casa = ${casa}::"Casa"`,
        this.totaisPorCategoria(
          Prisma.sql`d.ano = ${ano} AND d."parlamentarId" IN (SELECT id FROM "Parlamentar" WHERE casa = ${casa}::"Casa")`,
        ),
        this.prisma.$queryRaw<{ uf: string; total: Prisma.Decimal; parlamentares: bigint }[]>`
          SELECT p.uf, SUM(d."valorLiquido") AS total, COUNT(DISTINCT p.id) AS parlamentares
          FROM "Despesa" d JOIN "Parlamentar" p ON p.id = d."parlamentarId"
          WHERE d.ano = ${ano} AND p.casa = ${casa}::"Casa" AND p.uf <> 'NA'
          GROUP BY p.uf
          ORDER BY total DESC`,
        this.ranking({ casa, ano, page: 1, pageSize: TOP_GASTOS_HOME }),
      ]);

      return {
        casa,
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
    if (new Set(parlamentares.map((p) => p.casa)).size > 1) {
      // As cotas têm regras e limites diferentes: comparar deputado com senador engana.
      throw new BadRequestException('Compare apenas parlamentares da mesma casa');
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
