import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { prepareTestDatabase } from '@raio-x/db/testing';
import type { TestProject } from 'vitest/node';

declare module 'vitest' {
  export interface ProvidedContext {
    databaseUrl: string;
  }
}

/** Cria/migra o banco `<nome>_test` e o disponibiliza para os testes via `inject('databaseUrl')`. */
export default async function setup(project: TestProject): Promise<void> {
  const envFile = resolve(process.cwd(), '../../.env');
  if (existsSync(envFile)) process.loadEnvFile(envFile);

  const baseUrl = process.env.DATABASE_URL;
  if (!baseUrl) throw new Error('DATABASE_URL não definida para os testes e2e');
  project.provide('databaseUrl', await prepareTestDatabase(baseUrl));
}
