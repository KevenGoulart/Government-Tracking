import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@raio-x/db';
import { type FornecedorDetalhe, type FornecedorQuery, normalizarDocumento } from '@raio-x/shared';
import { CacheService } from '../cache/cache.service';
import { decimal } from '../common/decimal';
import { COLUNAS_PARLAMENTAR, type LinhaParlamentar, resumoParlamentar } from '../common/sql';
import { PrismaService } from '../prisma/prisma.service';

const UMA_HORA = 3_600;
const MAX_PARLAMENTARES = 100;

@Injectable()
export class FornecedoresService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /**
   * Busca o fornecedor pelo CNPJ/CPF (com ou sem pontuação) ou, para fornecedores sem
   * documento válido na fonte (ex.: ramais telefônicos), pelo id interno.
   */
  async detalhe(identificador: string, query: FornecedorQuery): Promise<FornecedorDetalhe> {
    const fornecedor = await this.resolver(identificador);
    const { tipo } = normalizarDocumento(fornecedor.documento);

    return this.cache.obterOuCalcular(
      `fornecedor:${fornecedor.id}:${query.ano ?? 'todos'}`,
      UMA_HORA,
      async () => {
        const filtroAno = query.ano ? Prisma.sql`AND d.ano = ${query.ano}` : Prisma.empty;

        const [anos, parlamentares, categorias, [contagem]] = await Promise.all([
          this.prisma.despesa.groupBy({
            by: ['ano'],
            where: { fornecedorId: fornecedor.id },
            _sum: { valorLiquido: true },
            _count: { _all: true },
            orderBy: { ano: 'desc' },
          }),
          this.prisma.$queryRaw<
            (LinhaParlamentar & { total: Prisma.Decimal; quantidade: bigint })[]
          >`
            SELECT ${COLUNAS_PARLAMENTAR}, SUM(d."valorLiquido") AS total, COUNT(*) AS quantidade
            FROM "Despesa" d JOIN "Parlamentar" p ON p.id = d."parlamentarId"
            WHERE d."fornecedorId" = ${fornecedor.id} ${filtroAno}
            GROUP BY p.id
            ORDER BY total DESC, p.nome ASC
            LIMIT ${MAX_PARLAMENTARES}`,
          this.prisma.$queryRaw<{ slug: string; nome: string; total: Prisma.Decimal }[]>`
            SELECT c.slug, c.nome, SUM(d."valorLiquido") AS total
            FROM "Despesa" d JOIN "Categoria" c ON c.id = d."categoriaId"
            WHERE d."fornecedorId" = ${fornecedor.id} ${filtroAno}
            GROUP BY c.slug, c.nome
            ORDER BY total DESC`,
          this.prisma.$queryRaw<[{ total: bigint }]>`
            SELECT COUNT(DISTINCT d."parlamentarId") AS total
            FROM "Despesa" d
            WHERE d."fornecedorId" = ${fornecedor.id} ${filtroAno}`,
        ]);

        const doPeriodo = query.ano ? anos.filter((a) => a.ano === query.ano) : anos;
        const total = doPeriodo.reduce(
          (soma, a) => soma.add(a._sum.valorLiquido ?? 0),
          new Prisma.Decimal(0),
        );

        return {
          id: fornecedor.id,
          nome: fornecedor.nome,
          documento: fornecedor.documento,
          tipoDocumento: tipo,
          ano: query.ano ?? null,
          anosDisponiveis: anos.map((a) => ({ ano: a.ano, total: decimal(a._sum.valorLiquido) })),
          total: decimal(total),
          quantidade: doPeriodo.reduce((soma, a) => soma + a._count._all, 0),
          quantidadeParlamentares: Number(contagem.total),
          parlamentares: parlamentares.map((p) => ({
            parlamentar: resumoParlamentar(p),
            total: decimal(p.total),
            quantidade: Number(p.quantidade),
          })),
          categorias: categorias.map((c) => ({
            slug: c.slug,
            nome: c.nome,
            total: decimal(c.total),
          })),
        };
      },
    );
  }

  private async resolver(identificador: string) {
    const { documento } = normalizarDocumento(identificador);
    const fornecedor = documento
      ? await this.prisma.fornecedor.findFirst({ where: { documento } })
      : /^[a-z0-9]{20,32}$/.test(identificador)
        ? await this.prisma.fornecedor.findUnique({ where: { id: identificador } })
        : null;
    if (!fornecedor) throw new NotFoundException('Fornecedor não encontrado');
    return fornecedor;
  }
}
