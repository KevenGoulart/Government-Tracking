import type { Prisma } from '@raio-x/db';

/** Serializa um Decimal do Prisma como string com 2 casas ("1234.50"). Nulo vira "0.00". */
export function decimal(valor: Prisma.Decimal | null | undefined): string {
  return valor ? valor.toFixed(2) : '0.00';
}
