import { existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Em CI as variáveis vêm do ambiente; localmente, do .env da raiz (os testes rodam em apps/api).
const envFile = resolve(process.cwd(), '../../.env');
if (existsSync(envFile)) process.loadEnvFile(envFile);
