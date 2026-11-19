import { Prisma } from '@raio-x/db';
import type { ParlamentarResumo } from '@raio-x/shared';

/** Colunas do resumo de parlamentar em consultas SQL (alias `p` para "Parlamentar"). */
export const COLUNAS_PARLAMENTAR = Prisma.sql`
  p.id, p.casa::text AS casa, p.nome, p.partido, p.uf, p."fotoUrl", p."emExercicio"`;

export interface LinhaParlamentar {
  id: string;
  casa: ParlamentarResumo['casa'];
  nome: string;
  partido: string | null;
  uf: string;
  fotoUrl: string | null;
  emExercicio: boolean;
}

export function resumoParlamentar(linha: LinhaParlamentar): ParlamentarResumo {
  return {
    id: linha.id,
    casa: linha.casa,
    nome: linha.nome,
    partido: linha.partido,
    uf: linha.uf,
    fotoUrl: linha.fotoUrl,
    emExercicio: linha.emExercicio,
  };
}

/** Junta condições com AND; sem condições, gera um WHERE vazio. */
export function where(condicoes: Prisma.Sql[]): Prisma.Sql {
  return condicoes.length ? Prisma.sql`WHERE ${Prisma.join(condicoes, ' AND ')}` : Prisma.empty;
}
