import { z } from 'zod';
import {
  anoQuerySchema,
  casaSchema,
  dataSchema,
  decimalSchema,
  mesQuerySchema,
  opcionalDaQuery,
} from './common';
import { paginationQuerySchema } from './pagination';

// ---------- Query ----------

export const despesasQuerySchema = paginationQuerySchema.extend({
  ano: opcionalDaQuery(anoQuerySchema),
  mes: opcionalDaQuery(mesQuerySchema),
  categoria: opcionalDaQuery(z.string().trim().max(120)),
  ordenarPor: opcionalDaQuery(z.enum(['data', 'valor'])).transform((v) => v ?? 'data'),
  ordem: opcionalDaQuery(z.enum(['asc', 'desc'])).transform((v) => v ?? 'desc'),
});
export type DespesasQuery = z.infer<typeof despesasQuerySchema>;

export const gastosMensaisQuerySchema = z.object({
  ano: opcionalDaQuery(anoQuerySchema),
});
export type GastosMensaisQuery = z.infer<typeof gastosMensaisQuerySchema>;

// ---------- Respostas ----------

export const categoriaSchema = z.object({ slug: z.string(), nome: z.string() });

export const categoriasQuerySchema = z.object({
  casa: opcionalDaQuery(casaSchema),
});
export type CategoriasQuery = z.infer<typeof categoriasQuerySchema>;
export type Categoria = z.infer<typeof categoriaSchema>;

export const despesaSchema = z.object({
  id: z.string(),
  ano: z.number().int(),
  mes: z.number().int(),
  dataDocumento: dataSchema.nullable(),
  categoria: categoriaSchema,
  fornecedor: z
    .object({ id: z.string(), nome: z.string(), documento: z.string().nullable() })
    .nullable(),
  tipoDocumento: z.string().nullable(),
  numDocumento: z.string().nullable(),
  valorDocumento: decimalSchema,
  valorGlosa: decimalSchema,
  valorLiquido: decimalSchema,
  urlDocumento: z.string().nullable(),
});
export type Despesa = z.infer<typeof despesaSchema>;

export const gastoMensalSchema = z.object({
  ano: z.number().int(),
  mes: z.number().int(),
  total: decimalSchema,
});
export type GastoMensal = z.infer<typeof gastoMensalSchema>;
