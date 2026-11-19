import { describe, expect, it } from 'vitest';
import { despesasQuerySchema } from './despesa';
import { parlamentaresQuerySchema } from './parlamentar';

describe('parlamentaresQuerySchema', () => {
  it('trata campos vazios de formulário como ausentes', () => {
    expect(parlamentaresQuerySchema.parse({ nome: '', uf: '', partido: '' })).toEqual({
      page: 1,
      pageSize: 20,
      nome: undefined,
      uf: undefined,
      partido: undefined,
      casa: undefined,
    });
  });

  it('normaliza UF e partido para maiúsculas', () => {
    const q = parlamentaresQuerySchema.parse({ uf: 'sp', partido: 'pt' });
    expect(q.uf).toBe('SP');
    expect(q.partido).toBe('PT');
  });

  it('rejeita UF inexistente e nome curto demais', () => {
    expect(parlamentaresQuerySchema.safeParse({ uf: 'XX' }).success).toBe(false);
    expect(parlamentaresQuerySchema.safeParse({ nome: 'a' }).success).toBe(false);
  });
});

describe('despesasQuerySchema', () => {
  it('aplica ordenação padrão por data decrescente', () => {
    const q = despesasQuerySchema.parse({ ano: '2025', mes: '3' });
    expect(q).toMatchObject({ ano: 2025, mes: 3, ordenarPor: 'data', ordem: 'desc' });
  });

  it('rejeita mês fora do intervalo', () => {
    expect(despesasQuerySchema.safeParse({ mes: '13' }).success).toBe(false);
  });
});
