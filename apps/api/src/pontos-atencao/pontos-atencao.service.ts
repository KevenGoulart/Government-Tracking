import { Injectable, NotFoundException } from '@nestjs/common';
import { type Casa, Prisma } from '@raio-x/db';
import {
  categoriaForaDaConcentracao,
  type ConcentracaoFornecedor,
  CRITERIOS_PONTOS_ATENCAO,
  type DespesaAtipica,
  haConcentracao,
  limiteAtipico,
  type PontosAtencao,
  type PontosAtencaoQuery,
} from '@raio-x/shared';
import { CacheService } from '../cache/cache.service';
import { decimal } from '../common/decimal';
import { INCLUDE_DESPESA, mapearDespesa } from '../common/despesa';
import { PrismaService } from '../prisma/prisma.service';

const UMA_HORA = 3_600;

/** Padrão de uma categoria no ano: calculado sobre todas as despesas positivas da casa. */
interface PadraoCategoria {
  categoriaId: string;
  quantidade: number;
  mediana: number;
  limite: number;
}

interface LinhaFornecedorCategoria {
  slug: string;
  fornecedorId: string | null;
  nome: string | null;
  documento: string | null;
  total: Prisma.Decimal;
  quantidade: bigint;
}

/**
 * "Pontos de atenção": regras estatísticas simples sobre a cota parlamentar.
 *
 * 1. **Valor atípico na categoria**: despesa acima do percentil 99 e da cerca de Tukey
 *    (Q3 + 3 × IQR) das despesas da mesma categoria, no mesmo ano, de toda a casa.
 * 2. **Concentração em um fornecedor**: um único fornecedor com CNPJ/CPF recebe metade ou
 *    mais do total do ano, sem contar passagens.
 *
 * Os critérios ficam em `CRITERIOS_PONTOS_ATENCAO` (pacote shared), que o front usa para
 * explicar a regra. Nada aqui afirma irregularidade: são só valores fora do padrão.
 */
@Injectable()
export class PontosAtencaoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly cache: CacheService,
  ) {}

  async doParlamentar(id: string, query: PontosAtencaoQuery): Promise<PontosAtencao> {
    const parlamentar = await this.prisma.parlamentar.findUnique({
      where: { id },
      select: { casa: true },
    });
    if (!parlamentar) throw new NotFoundException(`Parlamentar ${id} não encontrado`);

    const ano =
      query.ano ??
      (
        await this.prisma.despesa.aggregate({
          where: { parlamentarId: id },
          _max: { ano: true },
        })
      )._max.ano;

    if (ano === null) {
      return {
        ano,
        valoresAtipicos: { quantidade: 0, total: '0.00', data: [] },
        concentracao: null,
      };
    }

    return this.cache.obterOuCalcular(`pontos-atencao:${id}:${ano}`, UMA_HORA, async () => {
      const [padroes, concentracao] = await Promise.all([
        this.padroesCategorias(parlamentar.casa, ano),
        this.concentracao(id, ano),
      ]);
      return {
        ano,
        valoresAtipicos: await this.valoresAtipicos(id, ano, padroes),
        concentracao,
      };
    });
  }

  /** Mediana e limite de cada categoria da casa no ano (compartilhado entre parlamentares). */
  private padroesCategorias(casa: Casa, ano: number): Promise<PadraoCategoria[]> {
    return this.cache.obterOuCalcular(`padroes-categorias:${casa}:${ano}`, UMA_HORA, async () => {
      const { percentil, minimoDespesasCategoria } = CRITERIOS_PONTOS_ATENCAO;
      // Estornos (valores negativos) não fazem parte do padrão de gasto da categoria.
      const linhas = await this.prisma.$queryRaw<
        { categoriaId: string; quantidade: bigint; quartis: number[] }[]
      >`
        SELECT d."categoriaId", COUNT(*) AS quantidade,
               percentile_cont(ARRAY[0.25, 0.5, 0.75, ${percentil}::float8])
                 WITHIN GROUP (ORDER BY d."valorLiquido") AS quartis
        FROM "Despesa" d JOIN "Categoria" c ON c.id = d."categoriaId"
        WHERE d.ano = ${ano} AND c.casa = ${casa}::"Casa" AND d."valorLiquido" > 0
        GROUP BY d."categoriaId"
        HAVING COUNT(*) >= ${minimoDespesasCategoria}`;

      return linhas.map(({ categoriaId, quantidade, quartis }) => {
        const [q1 = 0, mediana = 0, q3 = 0, p99 = 0] = quartis.map(Number);
        return {
          categoriaId,
          quantidade: Number(quantidade),
          mediana,
          limite: limiteAtipico({ q1, q3, p99 }),
        };
      });
    });
  }

  private async valoresAtipicos(
    id: string,
    ano: number,
    padroes: PadraoCategoria[],
  ): Promise<PontosAtencao['valoresAtipicos']> {
    if (padroes.length === 0) return { quantidade: 0, total: '0.00', data: [] };

    const limites = Prisma.join(
      padroes.map((p) => Prisma.sql`(${p.categoriaId}, ${p.limite}::numeric)`),
    );
    const acima = await this.prisma.$queryRaw<
      { id: string; categoriaId: string; valor: Prisma.Decimal }[]
    >`
      SELECT d.id, d."categoriaId", d."valorLiquido" AS valor
      FROM "Despesa" d
      JOIN (VALUES ${limites}) AS l("categoriaId", limite) ON l."categoriaId" = d."categoriaId"
      WHERE d."parlamentarId" = ${id} AND d.ano = ${ano} AND d."valorLiquido" > l.limite`;

    const padraoPorCategoria = new Map(padroes.map((p) => [p.categoriaId, p]));
    const comRazao = acima
      .map((linha) => {
        const padrao = padraoPorCategoria.get(linha.categoriaId) as PadraoCategoria;
        const vezesMediana = padrao.mediana > 0 ? linha.valor.toNumber() / padrao.mediana : 0;
        return { ...linha, padrao, vezesMediana };
      })
      .sort((a, b) => b.vezesMediana - a.vezesMediana || a.id.localeCompare(b.id));

    const listadas = comRazao.slice(0, CRITERIOS_PONTOS_ATENCAO.maximoListadas);
    const registros = await this.prisma.despesa.findMany({
      where: { id: { in: listadas.map((l) => l.id) } },
      include: INCLUDE_DESPESA,
    });
    const porId = new Map(registros.map((r) => [r.id, r]));

    const data: DespesaAtipica[] = listadas.flatMap((l) => {
      const registro = porId.get(l.id);
      if (!registro) return [];
      return [
        {
          ...mapearDespesa(registro),
          referencia: {
            mediana: l.padrao.mediana.toFixed(2),
            limite: l.padrao.limite.toFixed(2),
            quantidadeCategoria: l.padrao.quantidade,
          },
          vezesMediana: Math.round(l.vezesMediana * 10) / 10,
        },
      ];
    });

    const total = comRazao.reduce((soma, l) => soma.add(l.valor), new Prisma.Decimal(0));
    return { quantidade: comRazao.length, total: decimal(total), data };
  }

  private async concentracao(id: string, ano: number): Promise<ConcentracaoFornecedor | null> {
    const linhas = await this.prisma.$queryRaw<LinhaFornecedorCategoria[]>`
      SELECT c.slug, f.id AS "fornecedorId", f.nome, f.documento,
             SUM(d."valorLiquido") AS total, COUNT(*) AS quantidade
      FROM "Despesa" d
      JOIN "Categoria" c ON c.id = d."categoriaId"
      LEFT JOIN "Fornecedor" f ON f.id = d."fornecedorId"
      WHERE d."parlamentarId" = ${id} AND d.ano = ${ano}
      GROUP BY c.slug, f.id, f.nome, f.documento`;

    const consideradas = linhas.filter((l) => !categoriaForaDaConcentracao(l.slug));
    const totalBase = consideradas.reduce((soma, l) => soma.add(l.total), new Prisma.Decimal(0));

    // Só fornecedores identificados por CNPJ/CPF: nomes genéricos sem documento
    // (ex.: "RAMAL", de telefonia) juntariam empresas diferentes.
    const porFornecedor = new Map<
      string,
      {
        fornecedor: ConcentracaoFornecedor['fornecedor'];
        total: Prisma.Decimal;
        quantidade: number;
      }
    >();
    for (const l of consideradas) {
      if (!l.fornecedorId || !l.documento || !l.nome) continue;
      const atual = porFornecedor.get(l.fornecedorId) ?? {
        fornecedor: { id: l.fornecedorId, nome: l.nome, documento: l.documento },
        total: new Prisma.Decimal(0),
        quantidade: 0,
      };
      atual.total = atual.total.add(l.total);
      atual.quantidade += Number(l.quantidade);
      porFornecedor.set(l.fornecedorId, atual);
    }

    const maior = [...porFornecedor.values()].sort((a, b) => b.total.comparedTo(a.total))[0];
    if (!maior || !haConcentracao(maior.total.toNumber(), totalBase.toNumber())) return null;

    return {
      fornecedor: maior.fornecedor,
      total: decimal(maior.total),
      totalBase: decimal(totalBase),
      participacao: Math.round(maior.total.div(totalBase).toNumber() * 1000) / 1000,
      quantidade: maior.quantidade,
    };
  }
}
