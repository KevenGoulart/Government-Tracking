import { z } from 'zod';

export const FONTES_SYNC = {
  CAMARA_DEPUTADOS: 'camara:deputados',
  CAMARA_DESPESAS: 'camara:despesas',
  SENADO_SENADORES: 'senado:senadores',
  SENADO_DESPESAS: 'senado:despesas',
  TRANSPARENCIA_EMENDAS: 'transparencia:emendas',
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
  /**
   * A mais antiga entre as últimas sincronizações das fontes que já sincronizaram ao menos
   * uma vez: os dados exibidos estão atualizados até aqui.
   */
  atualizadoEm: z.iso.datetime().nullable(),
});
export type SyncStatus = z.infer<typeof syncStatusSchema>;
