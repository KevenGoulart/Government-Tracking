import { describe, expect, it } from 'vitest';
import { formatarMoeda, nomeMesCurto } from './format';

describe('format', () => {
  it('formata moeda em reais', () => {
    // Intl usa espaço não separável entre "R$" e o número
    expect(formatarMoeda('1234.5').replace(/\s/g, ' ')).toBe('R$ 1.234,50');
    expect(formatarMoeda(-10).replace(/\s/g, ' ')).toBe('-R$ 10,00');
  });

  it('retorna o nome curto do mês', () => {
    expect(nomeMesCurto(1)).toBe('jan');
    expect(nomeMesCurto(12)).toBe('dez');
    expect(nomeMesCurto(13)).toBe('13');
  });
});
