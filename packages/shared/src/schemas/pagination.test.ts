import { describe, expect, it } from 'vitest';
import { buildPaginationMeta, MAX_PAGE_SIZE, paginationQuerySchema } from './pagination';

describe('paginationQuerySchema', () => {
  it('aplica valores padrão quando a query está vazia', () => {
    expect(paginationQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });

  it('converte strings vindas da query string', () => {
    expect(paginationQuerySchema.parse({ page: '3', pageSize: '50' })).toEqual({
      page: 3,
      pageSize: 50,
    });
  });

  it.each([
    { page: '0' },
    { page: '-1' },
    { pageSize: String(MAX_PAGE_SIZE + 1) },
    { page: 'abc' },
  ])('rejeita valores inválidos: %o', (input) => {
    expect(paginationQuerySchema.safeParse(input).success).toBe(false);
  });
});

describe('buildPaginationMeta', () => {
  it('calcula o total de páginas', () => {
    expect(buildPaginationMeta({ page: 2, pageSize: 20 }, 45)).toEqual({
      page: 2,
      pageSize: 20,
      total: 45,
      totalPages: 3,
    });
  });

  it('retorna ao menos uma página quando não há resultados', () => {
    expect(buildPaginationMeta({ page: 1, pageSize: 20 }, 0).totalPages).toBe(1);
  });
});
