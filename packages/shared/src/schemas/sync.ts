import { z } from 'zod';

export const FONTES_SYNC = {
  CAMARA_DEPUTADOS: 'camara:deputados',
  CAMARA_DESPESAS: 'camara:despesas',
} as const;
export type FonteSync = (typeof FONTES_SYNC)[keyof typeof FONTES_SYNC];

export const syncStatusSchema = z.object({
  /** Fim da sincronização bem-sucedida mais recente de cada fonte (ISO 8601). */
  fontes: z.array(
    z.object({
      fonte: z.string(),
      ultimaSincronizacao: z.iso.datetime().nullable(),
    }),
  ),
  /** A mais antiga entre as últimas sincronizações: os dados exibidos estão atualizados até aqui. */
  atualizadoEm: z.iso.datetime().nullable(),
});
export type SyncStatus = z.infer<typeof syncStatusSchema>;
