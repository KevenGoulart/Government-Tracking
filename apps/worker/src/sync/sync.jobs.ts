import { z } from 'zod';

/** Nomes dos jobs da fila de sincronização. */
export const JOBS = {
  DEPUTADOS: 'camara:deputados',
  DESPESAS: 'camara:despesas',
} as const;

export const despesasJobSchema = z.object({
  /** Anos a sincronizar; quando omitido, usa os anos recentes. */
  anos: z.array(z.number().int().min(2008).max(2100)).min(1).optional(),
});
export type DespesasJobData = z.infer<typeof despesasJobSchema>;

/**
 * Anos sincronizados diariamente: o atual e o anterior, porque deputados podem pedir
 * reembolso de despesas meses depois da data do documento.
 */
export function anosRecentes(hoje = new Date()): number[] {
  const ano = hoje.getFullYear();
  return [ano - 1, ano];
}
