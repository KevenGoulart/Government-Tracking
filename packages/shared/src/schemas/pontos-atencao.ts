import { z } from 'zod';
import { anoQuerySchema, casaSchema, decimalSchema, opcionalDaQuery } from './common';
import { despesaSchema } from './despesa';
import { parlamentarResumoSchema } from './parlamentar';

/**
 * Critérios dos "pontos de atenção": regras estatísticas simples e públicas, que destacam
 * valores fora do padrão. Não indicam irregularidade: um valor alto pode ter explicação
 * legítima. Os mesmos números são usados no cálculo (API) e no texto exibido (front).
 */
export const CRITERIOS_PONTOS_ATENCAO = {
  /** Percentil da categoria acima do qual uma despesa pode ser considerada atípica. */
  percentil: 0.99,
  /** Multiplicador do intervalo interquartil (cerca de Tukey para valores extremos). */
  multiplicadorIqr: 3,
  /** Categorias com poucas despesas no ano não têm um padrão confiável. */
  minimoDespesasCategoria: 50,
  /** Quantas despesas atípicas a resposta lista (as mais distantes da mediana). */
  maximoListadas: 10,
  /** Quantos destaques de cada tipo a home mostra (os mais evidentes da casa). */
  maximoDestaques: 5,
  /** Participação de um único fornecedor no total do ano (fora passagens). */
  participacaoFornecedor: 0.5,
  /** Abaixo deste total (fora passagens), a concentração não é avaliada. */
  totalMinimoConcentracao: 50_000,
} as const;

export interface EstatisticaCategoria {
  q1: number;
  q3: number;
  p99: number;
}

/**
 * Valor a partir do qual uma despesa é atípica na categoria: precisa estar acima do
 * percentil 99 **e** da cerca de valores extremos de Tukey (Q3 + 3 × IQR). Exigir as duas
 * condições evita destacar demais em categorias de distribuição muito assimétrica
 * (combustível) ou muito concentrada (locação de veículos, com valores quase fixos).
 */
export function limiteAtipico({ q1, q3, p99 }: EstatisticaCategoria): number {
  const { multiplicadorIqr } = CRITERIOS_PONTOS_ATENCAO;
  return Math.max(p99, q3 + multiplicadorIqr * (q3 - q1));
}

/**
 * Passagens são compradas pelos sistemas das próprias casas e concentram-se naturalmente
 * em poucas companhias aéreas; por isso ficam fora da regra de concentração.
 */
export function categoriaForaDaConcentracao(slug: string): boolean {
  return /(^|-)passage(m|ns)-/.test(slug);
}

/** Se a participação de um fornecedor no total do ano configura concentração. */
export function haConcentracao(valorFornecedor: number, totalBase: number): boolean {
  const { participacaoFornecedor, totalMinimoConcentracao } = CRITERIOS_PONTOS_ATENCAO;
  if (totalBase < totalMinimoConcentracao || totalBase <= 0) return false;
  return valorFornecedor / totalBase >= participacaoFornecedor;
}

// ---------- API ----------

export const pontosAtencaoQuerySchema = z.object({
  /** Quando omitido, usa o ano mais recente com despesas do parlamentar. */
  ano: opcionalDaQuery(anoQuerySchema),
});
export type PontosAtencaoQuery = z.infer<typeof pontosAtencaoQuerySchema>;

export const despesaAtipicaSchema = despesaSchema.extend({
  referencia: z.object({
    /** Mediana das despesas da categoria no ano (todos os parlamentares da casa). */
    mediana: decimalSchema,
    /** Valor a partir do qual a despesa é considerada atípica (ver `limiteAtipico`). */
    limite: decimalSchema,
    quantidadeCategoria: z.number().int(),
  }),
  /** Quantas vezes o valor da despesa equivale à mediana da categoria. */
  vezesMediana: z.number(),
});
export type DespesaAtipica = z.infer<typeof despesaAtipicaSchema>;

export const concentracaoFornecedorSchema = z.object({
  fornecedor: z.object({ id: z.string(), nome: z.string(), documento: z.string().nullable() }),
  total: decimalSchema,
  /** Total do parlamentar no ano, sem passagens (a base da participação). */
  totalBase: decimalSchema,
  /** Participação entre 0 e 1. */
  participacao: z.number(),
  quantidade: z.number().int(),
});
export type ConcentracaoFornecedor = z.infer<typeof concentracaoFornecedorSchema>;

export const pontosAtencaoSchema = z.object({
  ano: z.number().int().nullable(),
  valoresAtipicos: z.object({
    quantidade: z.number().int(),
    total: decimalSchema,
    /** As mais distantes da mediana da categoria (no máximo `maximoListadas`). */
    data: z.array(despesaAtipicaSchema),
  }),
  concentracao: concentracaoFornecedorSchema.nullable(),
});
export type PontosAtencao = z.infer<typeof pontosAtencaoSchema>;

// ---------- Destaques da casa (home) ----------

export const destaquesPontosAtencaoQuerySchema = z.object({
  casa: opcionalDaQuery(casaSchema).transform((casa) => casa ?? 'CAMARA'),
  /** Quando omitido, usa o ano mais recente com despesas da casa. */
  ano: opcionalDaQuery(anoQuerySchema),
});
export type DestaquesPontosAtencaoQuery = z.infer<typeof destaquesPontosAtencaoQuerySchema>;

export const destaquesPontosAtencaoSchema = z.object({
  casa: casaSchema,
  ano: z.number().int().nullable(),
  valoresAtipicos: z.object({
    /** Despesas atípicas de toda a casa no ano. */
    quantidade: z.number().int(),
    total: decimalSchema,
    /** A maior de cada parlamentar, pelo valor acima do limite em reais (no máximo `maximoDestaques`). */
    data: z.array(despesaAtipicaSchema.extend({ parlamentar: parlamentarResumoSchema })),
  }),
  concentracoes: z.object({
    /** Parlamentares com concentração em um fornecedor no ano. */
    quantidade: z.number().int(),
    /** As maiores participações (no máximo `maximoDestaques`). */
    data: z.array(concentracaoFornecedorSchema.extend({ parlamentar: parlamentarResumoSchema })),
  }),
});
export type DestaquesPontosAtencao = z.infer<typeof destaquesPontosAtencaoSchema>;
