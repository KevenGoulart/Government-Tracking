import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from './generated/prisma/client';

export interface CreatePrismaClientOptions {
  connectionString: string;
  log?: boolean;
}

/** Cria um PrismaClient usando o driver adapter do `pg` (padrão do Prisma 7). */
export function createPrismaClient({ connectionString, log = false }: CreatePrismaClientOptions) {
  const adapter = new PrismaPg({ connectionString });
  return new PrismaClient({ adapter, log: log ? ['query', 'warn', 'error'] : ['warn', 'error'] });
}
