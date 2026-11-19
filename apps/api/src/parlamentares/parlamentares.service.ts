import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@raio-x/db';
import {
  buildPaginationMeta,
  type Categoria,
  type Despesa,
  type DespesasQuery,
  type FiltrosParlamentares,
  type GastoMensal,
  type GastosMensaisQuery,
  normalizarParaBusca,
  type Paginated,
  type ParlamentarDetalhe,
  type ParlamentarDetalheQuery,
  type ParlamentaresQuery,
  type ParlamentarResumo,
  type TotalCategoria,
  type TotalFornecedor,
} from '@raio-x/shared';
import { decimal } from '../common/decimal';
import { PrismaService } from '../prisma/prisma.service';

const MAX_FORNECEDORES_RESUMO = 10;

function escaparLike(valor: string): string {
  return valor.replace(/[\\%_]/g, (c) => `\\${c}`);
}

@Injectable()
export class ParlamentaresService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Lista parlamentares com filtros. A busca por nome usa pg_trgm (`<%`, similaridade por
   * palavra) sobre o nome sem acentos, tolerando erros de digitação, e também aceita
   * trechos exatos do nome. Resultados mais parecidos aparecem primeiro.
   */
  async listar(query: ParlamentaresQuery): Promise<Paginated<ParlamentarResumo>> {
    const condicoes: Prisma.Sql[] = [];
    if (query.casa) condicoes.push(Prisma.sql`casa = ${query.casa}::"Casa"`);
    if (query.uf) condicoes.push(Prisma.sql`uf = ${query.uf}`);
    if (query.partido) condicoes.push(Prisma.sql`partido = ${query.partido}`);

    const busca = query.nome ? normalizarParaBusca(query.nome) : undefined;
    if (busca) {
      condicoes.push(
        Prisma.sql`(${busca} <% "nomeBusca" OR "nomeBusca" LIKE ${`%${escaparLike(busca)}%`})`,
      );
    }

    const where = condicoes.length
      ? Prisma.sql`WHERE ${Prisma.join(condicoes, ' AND ')}`
      : Prisma.empty;
    const ordem = busca
      ? Prisma.sql`ORDER BY word_similarity(${busca}, "nomeBusca") DESC, "emExercicio" DESC, nome ASC`
      : Prisma.sql`ORDER BY "emExercicio" DESC, nome ASC`;
    const offset = (query.page - 1) * query.pageSize;

    const [linhas, contagem] = await Promise.all([
      this.prisma.$queryRaw<ParlamentarResumo[]>`
        SELECT id, casa::text AS casa, nome, partido, uf, "fotoUrl", "emExercicio"
        FROM "Parlamentar" ${where} ${ordem}
        LIMIT ${query.pageSize} OFFSET ${offset}`,
      this.prisma.$queryRaw<[{ total: bigint }]>`
        SELECT count(*) AS total FROM "Parlamentar" ${where}`,
    ]);

    return {
      data: linhas,
      meta: buildPaginationMeta(query, Number(contagem[0].total)),
    };
  }

  async filtros(): Promise<FiltrosParlamentares> {
    const [partidos, ufs] = await Promise.all([
      this.prisma.parlamentar.findMany({
        where: { partido: { not: null } },
        distinct: ['partido'],
        select: { partido: true },
        orderBy: { partido: 'asc' },
      }),
      this.prisma.parlamentar.findMany({
        distinct: ['uf'],
        select: { uf: true },
        orderBy: { uf: 'asc' },
      }),
    ]);
    return {
      partidos: partidos.flatMap((p) => (p.partido ? [p.partido] : [])),
      ufs: ufs.map((u) => u.uf).filter((uf) => uf !== 'NA'),
    };
  }

  async categorias(): Promise<Categoria[]> {
    return this.prisma.categoria.findMany({
      select: { slug: true, nome: true },
      orderBy: { nome: 'asc' },
    });
  }

  async detalhe(id: string, query: ParlamentarDetalheQuery): Promise<ParlamentarDetalhe> {
    const parlamentar = await this.obterOuFalhar(id);

    const anos = await this.prisma.despesa.groupBy({
      by: ['ano'],
      where: { parlamentarId: id },
      _sum: { valorLiquido: true },
      _count: { _all: true },
      orderBy: { ano: 'desc' },
    });
    const anoReferencia = query.ano ?? anos[0]?.ano ?? null;
    const totalAno = anos.find((a) => a.ano === anoReferencia)?._sum.valorLiquido;

    const [categorias, fornecedores] =
      anoReferencia === null
        ? [[], []]
        : await Promise.all([
            this.totaisPorCategoria(id, anoReferencia),
            this.maioresFornecedores(id, anoReferencia),
          ]);

    return {
      id: parlamentar.id,
      idExterno: parlamentar.idExterno,
      casa: parlamentar.casa,
      nome: parlamentar.nome,
      nomeCivil: parlamentar.nomeCivil,
      partido: parlamentar.partido,
      uf: parlamentar.uf,
      fotoUrl: parlamentar.fotoUrl,
      email: parlamentar.email,
      emExercicio: parlamentar.emExercicio,
      resumo: {
        anoReferencia,
        anosDisponiveis: anos.map((a) => ({
          ano: a.ano,
          total: decimal(a._sum.valorLiquido),
          quantidade: a._count._all,
        })),
        totalAno: decimal(totalAno),
        categorias,
        fornecedores,
      },
    };
  }

  async despesas(id: string, query: DespesasQuery): Promise<Paginated<Despesa>> {
    await this.obterOuFalhar(id);
    const where: Prisma.DespesaWhereInput = {
      parlamentarId: id,
      ...(query.ano && { ano: query.ano }),
      ...(query.mes && { mes: query.mes }),
      ...(query.categoria && { categoria: { slug: query.categoria } }),
    };
    const orderBy: Prisma.DespesaOrderByWithRelationInput[] =
      query.ordenarPor === 'valor'
        ? [{ valorLiquido: query.ordem }, { id: 'asc' }]
        : [
            { dataDocumento: { sort: query.ordem, nulls: 'last' } },
            { ano: query.ordem },
            { mes: query.ordem },
            { id: 'asc' },
          ];

    const [registros, total] = await Promise.all([
      this.prisma.despesa.findMany({
        where,
        orderBy,
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
        include: {
          categoria: { select: { slug: true, nome: true } },
          fornecedor: { select: { id: true, nome: true, documento: true } },
        },
      }),
      this.prisma.despesa.count({ where }),
    ]);

    return {
      data: registros.map((d) => ({
        id: d.id,
        ano: d.ano,
        mes: d.mes,
        dataDocumento: d.dataDocumento ? d.dataDocumento.toISOString().slice(0, 10) : null,
        categoria: d.categoria,
        fornecedor: d.fornecedor,
        tipoDocumento: d.tipoDocumento,
        numDocumento: d.numDocumento,
        valorDocumento: decimal(d.valorDocumento),
        valorGlosa: decimal(d.valorGlosa),
        valorLiquido: decimal(d.valorLiquido),
        urlDocumento: d.urlDocumento,
      })),
      meta: buildPaginationMeta(query, total),
    };
  }

  async gastosMensais(id: string, query: GastosMensaisQuery): Promise<GastoMensal[]> {
    await this.obterOuFalhar(id);
    const meses = await this.prisma.despesa.groupBy({
      by: ['ano', 'mes'],
      where: { parlamentarId: id, ...(query.ano && { ano: query.ano }) },
      _sum: { valorLiquido: true },
      orderBy: [{ ano: 'asc' }, { mes: 'asc' }],
    });
    return meses.map((m) => ({ ano: m.ano, mes: m.mes, total: decimal(m._sum.valorLiquido) }));
  }

  private async obterOuFalhar(id: string) {
    const parlamentar = await this.prisma.parlamentar.findUnique({ where: { id } });
    if (!parlamentar) throw new NotFoundException(`Parlamentar ${id} não encontrado`);
    return parlamentar;
  }

  private async totaisPorCategoria(id: string, ano: number): Promise<TotalCategoria[]> {
    const linhas = await this.prisma.$queryRaw<
      { slug: string; nome: string; total: Prisma.Decimal }[]
    >`
      SELECT c.slug, c.nome, SUM(d."valorLiquido") AS total
      FROM "Despesa" d JOIN "Categoria" c ON c.id = d."categoriaId"
      WHERE d."parlamentarId" = ${id} AND d.ano = ${ano}
      GROUP BY c.slug, c.nome
      ORDER BY total DESC`;
    return linhas.map((l) => ({ slug: l.slug, nome: l.nome, total: decimal(l.total) }));
  }

  private async maioresFornecedores(id: string, ano: number): Promise<TotalFornecedor[]> {
    const linhas = await this.prisma.$queryRaw<
      { id: string; nome: string; documento: string | null; total: Prisma.Decimal }[]
    >`
      SELECT f.id, f.nome, f.documento, SUM(d."valorLiquido") AS total
      FROM "Despesa" d JOIN "Fornecedor" f ON f.id = d."fornecedorId"
      WHERE d."parlamentarId" = ${id} AND d.ano = ${ano}
      GROUP BY f.id, f.nome, f.documento
      ORDER BY total DESC
      LIMIT ${MAX_FORNECEDORES_RESUMO}`;
    return linhas.map((l) => ({ ...l, total: decimal(l.total) }));
  }
}
