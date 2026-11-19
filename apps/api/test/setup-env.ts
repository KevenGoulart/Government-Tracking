import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { inject } from 'vitest';

// Em CI as variáveis vêm do ambiente; localmente, do .env da raiz (os testes rodam em apps/api).
const envFile = resolve(process.cwd(), '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);

// Os testes nunca usam o banco de desenvolvimento.
process.env.DATABASE_URL = inject('databaseUrl');

// Banco 15 do Redis: o cache dos testes não se mistura com o de desenvolvimento.
const redis = new URL(process.env.REDIS_URL ?? 'redis://localhost:6379');
redis.pathname = '/15';
process.env.REDIS_URL = redis.toString();
