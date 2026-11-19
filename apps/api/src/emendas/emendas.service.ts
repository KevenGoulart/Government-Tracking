import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@raio-x/db';
import { buildPaginationMeta, type EmendasParlamentar, type EmendasQuery } from '@raio-x/shared';
import { CacheService } from '../cache/cache.service';
import { decimal } from '../common/decimal';
import { PrismaService } from '../prisma/prisma.service';

const UMA_HORA = 3_600;
const MAX_LOCALIDADES = 10;

type LinhaTotais = {
  empenhado: Prisma.Decimal | null;
  pago: Prisma.Decimal | null;
  quantidade: bigint;
};

function totais(linha: LinhaTotais | undefined) {
  return {
    empenhado: decimal(linha?.empenhado),
    pago: decimal(linha?.pago),
    quantidade: Number(linha?.quantidade ?? 0),
  };
}

@Injectable()
export class EmendasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  /** Emendas de autoria do parlamentar: totais do ano, por área e localidade, e a lista. */
  async doParlamentar(id: string, query: EmendasQuery): Promise<EmendasParlamentar> {
    const existe = await this.prisma.parlamentar.count({ where: { id } });
    if (!existe) throw new NotFoundException(`Parlamentar ${id} não encontrado`);

    const anos = await this.prisma.$queryRaw<(LinhaTotais & { ano: number })[]>`
      SELECT ano, SUM("valorEmpenhado") AS empenhado, SUM("valorPago") AS pago, COUNT(*) AS quantidade
      FROM "Emenda" WHERE "parlamentarId" = ${id}
      GROUP BY ano ORDER BY ano DESC`;
    const ano = query.ano ?? anos[0]?.ano ?? null;
    const anosDisponiveis = anos.map((a) => ({ ano: a.ano, ...totais(a) }));

    if (ano === null) {
      return {
        ano,
        anosDisponiveis,
        totais: totais(undefined),
        porFuncao: [],
        porLocalidade: [],
        data: [],
        meta: buildPaginationMeta(query, 0),
      };
    }

    const agregados = await this.cache.obterOuCalcular(
      `emendas:${id}:${ano}`,
      UMA_HORA,
      async () => {
        const [porFuncao, porLocalidade] = await Promise.all([
          this.prisma.$queryRaw<(LinhaTotais & { funcao: string })[]>`
          SELECT COALESCE(funcao, 'Não informada') AS funcao,
                 SUM("valorEmpenhado") AS empenhado, SUM("valorPago") AS pago, COUNT(*) AS quantidade
          FROM "Emenda" WHERE "parlamentarId" = ${id} AND ano = ${ano}
          GROUP BY 1 ORDER BY empenhado DESC`,
          this.prisma.$queryRaw<(LinhaTotais & { localidade: string })[]>`
          SELECT COALESCE(localidade, 'Não informada') AS localidade,
                 SUM("valorEmpenhado") AS empenhado, SUM("valorPago") AS pago, COUNT(*) AS quantidade
          FROM "Emenda" WHERE "parlamentarId" = ${id} AND ano = ${ano}
          GROUP BY 1 ORDER BY empenhado DESC
          LIMIT ${MAX_LOCALIDADES}`,
        ]);
        return {
          porFuncao: porFuncao.map((f) => ({ funcao: f.funcao, ...totais(f) })),
          porLocalidade: porLocalidade.map((l) => ({ localidade: l.localidade, ...totais(l) })),
        };
      },
    );

    const where = { parlamentarId: id, ano };
    const [emendas, total] = await Promise.all([
      this.prisma.emenda.findMany({
        where,
        orderBy: [{ valorEmpenhado: 'desc' }, { codigo: 'asc' }],
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize,
      }),
      this.prisma.emenda.count({ where }),
    ]);

    return {
      ano,
      anosDisponiveis,
      totais: totais(anos.find((a) => a.ano === ano)),
      ...agregados,
      data: emendas.map((e) => ({
        id: e.id,
        codigo: e.codigo,
        ano: e.ano,
        numero: e.numero,
        tipo: e.tipo,
        observacaoAutor: e.observacaoAutor,
        localidade: e.localidade,
        funcao: e.funcao,
        subfuncao: e.subfuncao,
        valorEmpenhado: decimal(e.valorEmpenhado),
        valorLiquidado: decimal(e.valorLiquidado),
        valorPago: decimal(e.valorPago),
      })),
      meta: buildPaginationMeta(query, total),
    };
  }
}
