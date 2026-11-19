import { z } from 'zod';
import { anoQuerySchema, casaSchema, decimalSchema, opcionalDaQuery, ufSchema } from './common';
import { paginationQuerySchema } from './pagination';

// ---------- Query ----------

export const parlamentaresQuerySchema = paginationQuerySchema.extend({
  nome: opcionalDaQuery(z.string().trim().min(2).max(100)),
  partido: opcionalDaQuery(z.string().trim().toUpperCase().max(30)),
  uf: opcionalDaQuery(z.string().trim().toUpperCase().pipe(ufSchema)),
  casa: opcionalDaQuery(casaSchema),
});
export type ParlamentaresQuery = z.infer<typeof parlamentaresQuerySchema>;

export const parlamentarDetalheQuerySchema = z.object({
  ano: opcionalDaQuery(anoQuerySchema),
});
export type ParlamentarDetalheQuery = z.infer<typeof parlamentarDetalheQuerySchema>;

// ---------- Respostas ----------

export const parlamentarResumoSchema = z.object({
  id: z.string(),
  casa: casaSchema,
  nome: z.string(),
  partido: z.string().nullable(),
  uf: z.string(),
  fotoUrl: z.string().nullable(),
  emExercicio: z.boolean(),
});
export type ParlamentarResumo = z.infer<typeof parlamentarResumoSchema>;

export const totalAnualSchema = z.object({
  ano: z.number().int(),
  total: decimalSchema,
  quantidade: z.number().int(),
});

export const totalCategoriaSchema = z.object({
  slug: z.string(),
  nome: z.string(),
  total: decimalSchema,
});
export type TotalCategoria = z.infer<typeof totalCategoriaSchema>;

export const totalFornecedorSchema = z.object({
  id: z.string(),
  nome: z.string(),
  documento: z.string().nullable(),
  total: decimalSchema,
});
export type TotalFornecedor = z.infer<typeof totalFornecedorSchema>;

export const parlamentarDetalheSchema = parlamentarResumoSchema.extend({
  idExterno: z.string(),
  nomeCivil: z.string().nullable(),
  email: z.string().nullable(),
  resumo: z.object({
    /** Ano usado para os totais por categoria e fornecedor (o solicitado ou o mais recente com dados). */
    anoReferencia: z.number().int().nullable(),
    anosDisponiveis: z.array(totalAnualSchema),
    totalAno: decimalSchema,
    categorias: z.array(totalCategoriaSchema),
    fornecedores: z.array(totalFornecedorSchema),
  }),
});
export type ParlamentarDetalhe = z.infer<typeof parlamentarDetalheSchema>;

export const filtrosParlamentaresSchema = z.object({
  partidos: z.array(z.string()),
  ufs: z.array(z.string()),
});
export type FiltrosParlamentares = z.infer<typeof filtrosParlamentaresSchema>;
