import { execSync } from 'node:child_process';
import path from 'node:path';
import { Client } from 'pg';
import type { PrismaClient } from './generated/prisma/client';

/** Diretório do pacote `@raio-x/db` (onde ficam o schema e as migrations). */
const DB_PACKAGE_DIR = path.resolve(__dirname, '..');

/** Deriva a URL do banco de testes a partir da URL principal: `raiox` → `raiox_test`. */
export function testDatabaseUrl(baseUrl: string): string {
  const url = new URL(baseUrl);
  const nome = url.pathname.replace(/^\//, '');
  if (!nome) throw new Error('DATABASE_URL sem nome de banco');
  url.pathname = nome.endsWith('_test') ? `/${nome}` : `/${nome}_test`;
  return url.toString();
}

/**
 * Garante que o banco de testes exista e esteja com todas as migrations aplicadas.
 * Retorna a URL de conexão. Usado no `globalSetup` dos testes de integração.
 */
export async function prepareTestDatabase(baseUrl: string): Promise<string> {
  const url = testDatabaseUrl(baseUrl);
  const nome = new URL(url).pathname.slice(1);

  const admin = new URL(baseUrl);
  admin.pathname = '/postgres';
  admin.search = '';
  const client = new Client({ connectionString: admin.toString() });
  await client.connect();
  try {
    const existe = await client.query('SELECT 1 FROM pg_database WHERE datname = $1', [nome]);
    if (existe.rowCount === 0) await client.query(`CREATE DATABASE "${nome}"`);
  } finally {
    await client.end();
  }

  execSync('pnpm exec prisma migrate deploy', {
    cwd: DB_PACKAGE_DIR,
    env: { ...process.env, DATABASE_URL: url },
    stdio: 'pipe',
  });
  return url;
}

/** Limpa todas as tabelas de dados (mantém o histórico de migrations). */
export async function truncateAll(prisma: PrismaClient): Promise<void> {
  await prisma.$executeRawUnsafe(
    'TRUNCATE TABLE "Despesa", "Fornecedor", "Categoria", "Parlamentar", "SyncRun" RESTART IDENTITY CASCADE',
  );
}
