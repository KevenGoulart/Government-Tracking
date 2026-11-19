import { z } from 'zod';

const booleanFromString = z
  .enum(['true', 'false', '1', '0'])
  .transform((value) => value === 'true' || value === '1');

const yearList = z
  .string()
  .transform((value) =>
    value
      .split(',')
      .map((part) => part.trim())
      .filter(Boolean)
      .map(Number),
  )
  .pipe(z.array(z.number().int().min(2008).max(2100)).min(1));

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  DATABASE_URL: z.url(),
  REDIS_URL: z.url(),
  CAMARA_API_BASE_URL: z.url().default('https://dadosabertos.camara.leg.br/api/v2'),
  CAMARA_LEGISLATURA: z.coerce.number().int().positive().default(57),
  CAMARA_RATE_LIMIT_PER_SECOND: z.coerce.number().positive().default(3),
  SYNC_INITIAL_YEARS: yearList.default([new Date().getFullYear()]),
  SYNC_CONCURRENCY: z.coerce.number().int().min(1).max(10).default(2),
  SYNC_CRON_ENABLED: booleanFromString.default(true),
});

export type Env = z.infer<typeof envSchema>;

/** Valida as variáveis de ambiente na inicialização: falha cedo e com mensagem clara. */
export function parseEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    throw new Error(`Variáveis de ambiente inválidas:\n${z.prettifyError(result.error)}`);
  }
  return result.data;
}
