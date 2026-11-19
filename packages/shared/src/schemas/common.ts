import { z } from 'zod';

export const CASAS = ['CAMARA', 'SENADO'] as const;
export const casaSchema = z.enum(CASAS);
export type Casa = z.infer<typeof casaSchema>;

export const UFS = [
  'AC',
  'AL',
  'AM',
  'AP',
  'BA',
  'CE',
  'DF',
  'ES',
  'GO',
  'MA',
  'MG',
  'MS',
  'MT',
  'PA',
  'PB',
  'PE',
  'PI',
  'PR',
  'RJ',
  'RN',
  'RO',
  'RR',
  'RS',
  'SC',
  'SE',
  'SP',
  'TO',
] as const;
export const ufSchema = z.enum(UFS);
export type Uf = z.infer<typeof ufSchema>;

/** Valor monetário serializado como string decimal ("1234.56") para não perder precisão. */
export const decimalSchema = z.string().regex(/^-?\d+(\.\d+)?$/, 'Decimal inválido');

/** Data no formato YYYY-MM-DD. */
export const dataSchema = z.iso.date();

/**
 * Converte "" em undefined: formulários GET enviam campos vazios (`?nome=&uf=`),
 * que devem ser tratados como filtro ausente.
 */
export function opcionalDaQuery<T extends z.ZodType>(schema: T) {
  return z.preprocess((valor) => (valor === '' ? undefined : valor), schema.optional());
}

export const anoQuerySchema = z.coerce.number().int().min(2008).max(2100);
export const mesQuerySchema = z.coerce.number().int().min(1).max(12);
