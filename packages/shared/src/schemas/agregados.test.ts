import { describe, expect, it } from 'vitest';
import { comparacaoQuerySchema, rankingQuerySchema } from './agregados';

describe('comparacaoQuerySchema', () => {
  it('separa, limpa e remove ids repetidos', () => {
    expect(comparacaoQuerySchema.parse({ ids: ' a, b ,a,,c' }).ids).toEqual(['a', 'b', 'c']);
  });

  it('exige entre 2 e 4 parlamentares', () => {
    expect(comparacaoQuerySchema.safeParse({ ids: 'a' }).success).toBe(false);
    expect(comparacaoQuerySchema.safeParse({ ids: 'a,b,c,d,e' }).success).toBe(false);
    expect(comparacaoQuerySchema.safeParse({ ids: 'a,b,c,d' }).success).toBe(true);
  });
});

describe('rankingQuerySchema', () => {
  it('aceita filtros vazios e normaliza UF', () => {
    expect(rankingQuerySchema.parse({ ano: '', uf: 'sp', categoria: '' })).toMatchObject({
      ano: undefined,
      uf: 'SP',
      categoria: undefined,
      page: 1,
    });
  });
});
