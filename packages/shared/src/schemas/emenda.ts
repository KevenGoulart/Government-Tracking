import { z } from 'zod';
import { anoQuerySchema, decimalSchema, opcionalDaQuery } from './common';
import { paginationQuerySchema } from './pagination';

export const emendasQuerySchema = paginationQuerySchema.extend({
  /** Quando omitido, usa o ano mais recente com emendas do parlamentar. */
  ano: opcionalDaQuery(anoQuerySchema),
});
export type EmendasQuery = z.infer<typeof emendasQuerySchema>;

export const emendaSchema = z.object({
  id: z.string(),
  codigo: z.string(),
  ano: z.number().int(),
  numero: z.string().nullable(),
  tipo: z.string(),
  observacaoAutor: z.string().nullable(),
  localidade: z.string().nullable(),
  funcao: z.string().nullable(),
  subfuncao: z.string().nullable(),
  valorEmpenhado: decimalSchema,
  valorLiquidado: decimalSchema,
  valorPago: decimalSchema,
});
export type Emenda = z.infer<typeof emendaSchema>;

const totaisEmendaSchema = z.object({
  empenhado: decimalSchema,
  pago: decimalSchema,
  quantidade: z.number().int(),
});

export const emendasParlamentarSchema = z.object({
  ano: z.number().int().nullable(),
  anosDisponiveis: z.array(totaisEmendaSchema.extend({ ano: z.number().int() })),
  totais: totaisEmendaSchema,
  /** Área do orçamento (saúde, educação...), pelo valor empenhado. */
  porFuncao: z.array(totaisEmendaSchema.extend({ funcao: z.string() })),
  porLocalidade: z.array(totaisEmendaSchema.extend({ localidade: z.string() })),
  data: z.array(emendaSchema),
  meta: z.object({
    page: z.number().int(),
    pageSize: z.number().int(),
    total: z.number().int(),
    totalPages: z.number().int(),
  }),
});
export type EmendasParlamentar = z.infer<typeof emendasParlamentarSchema>;
