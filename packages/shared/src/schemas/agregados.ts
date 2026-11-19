import { z } from 'zod';
import { anoQuerySchema, decimalSchema, opcionalDaQuery, ufSchema } from './common';
import { gastoMensalSchema } from './despesa';
import { paginationQuerySchema } from './pagination';
import { parlamentarResumoSchema, totalCategoriaSchema } from './parlamentar';

// ---------- Ranking ----------

export const rankingQuerySchema = paginationQuerySchema.extend({
  /** Quando omitido, usa o ano mais recente com dados. */
  ano: opcionalDaQuery(anoQuerySchema),
  categoria: opcionalDaQuery(z.string().trim().max(120)),
  partido: opcionalDaQuery(z.string().trim().toUpperCase().max(30)),
  uf: opcionalDaQuery(z.string().trim().toUpperCase().pipe(ufSchema)),
});
export type RankingQuery = z.infer<typeof rankingQuerySchema>;

export const rankingItemSchema = z.object({
  posicao: z.number().int(),
  parlamentar: parlamentarResumoSchema,
  total: decimalSchema,
  quantidade: z.number().int(),
});
export type RankingItem = z.infer<typeof rankingItemSchema>;

export const rankingSchema = z.object({
  ano: z.number().int().nullable(),
  data: z.array(rankingItemSchema),
  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type Ranking = z.infer<typeof rankingSchema>;

// ---------- Estatísticas gerais ----------

export const estatisticasQuerySchema = z.object({
  ano: opcionalDaQuery(anoQuerySchema),
});
export type EstatisticasQuery = z.infer<typeof estatisticasQuerySchema>;

export const totalUfSchema = z.object({
  uf: z.string(),
  total: decimalSchema,
  parlamentares: z.number().int(),
  /** Total dividido pelo número de parlamentares com despesa no ano (estados têm bancadas de tamanhos diferentes). */
  mediaPorParlamentar: decimalSchema,
});
export type TotalUf = z.infer<typeof totalUfSchema>;

export const estatisticasSchema = z.object({
  ano: z.number().int().nullable(),
  anosDisponiveis: z.array(z.number().int()),
  total: decimalSchema,
  quantidadeDespesas: z.number().int(),
  quantidadeParlamentares: z.number().int(),
  quantidadeFornecedores: z.number().int(),
  porCategoria: z.array(totalCategoriaSchema),
  porUf: z.array(totalUfSchema),
  maioresGastos: z.array(rankingItemSchema),
});
export type Estatisticas = z.infer<typeof estatisticasSchema>;

// ---------- Fornecedor ----------

export const fornecedorQuerySchema = z.object({
  /** Quando omitido, considera todos os anos sincronizados. */
  ano: opcionalDaQuery(anoQuerySchema),
});
export type FornecedorQuery = z.infer<typeof fornecedorQuerySchema>;

export const fornecedorDetalheSchema = z.object({
  id: z.string(),
  nome: z.string(),
  documento: z.string().nullable(),
  tipoDocumento: z.enum(['CNPJ', 'CPF']).nullable(),
  ano: z.number().int().nullable(),
  anosDisponiveis: z.array(z.object({ ano: z.number().int(), total: decimalSchema })),
  total: decimalSchema,
  quantidade: z.number().int(),
  /** Total de parlamentares que pagaram o fornecedor (a lista traz no máximo os 100 maiores). */
  quantidadeParlamentares: z.number().int(),
  parlamentares: z.array(
    z.object({
      parlamentar: parlamentarResumoSchema,
      total: decimalSchema,
      quantidade: z.number().int(),
    }),
  ),
  categorias: z.array(totalCategoriaSchema),
});
export type FornecedorDetalhe = z.infer<typeof fornecedorDetalheSchema>;

// ---------- Comparação ----------

export const MIN_COMPARACAO = 2;
export const MAX_COMPARACAO = 4;

export const comparacaoQuerySchema = z.object({
  /** IDs separados por vírgula: `?ids=a,b,c`. */
  ids: z
    .string()
    .transform((valor) => [
      ...new Set(
        valor
          .split(',')
          .map((id) => id.trim())
          .filter(Boolean),
      ),
    ])
    .pipe(z.array(z.string().max(40)).min(MIN_COMPARACAO).max(MAX_COMPARACAO)),
  ano: opcionalDaQuery(anoQuerySchema),
});
export type ComparacaoQuery = z.infer<typeof comparacaoQuerySchema>;

export const comparacaoSchema = z.object({
  ano: z.number().int().nullable(),
  parlamentares: z.array(
    z.object({
      parlamentar: parlamentarResumoSchema,
      total: decimalSchema,
      quantidade: z.number().int(),
      categorias: z.array(totalCategoriaSchema),
      mensal: z.array(gastoMensalSchema),
    }),
  ),
});
export type Comparacao = z.infer<typeof comparacaoSchema>;
