import { describe, expect, it } from 'vitest';
import { dataBrasileira, decimalBrasileiro } from './numero';

describe('decimalBrasileiro', () => {
  it.each([
    ['8.000,00', '8000.00'],
    ['399,44', '399.44'],
    ['4000', '4000.00'],
    ['-1966,37', '-1966.37'],
    ['1.234.567,8', '1234567.80'],
    ['0,00', '0.00'],
    [',03', '0.03'],
    ['-,5', '-0.50'],
  ])('converte "%s" em "%s"', (entrada, esperado) => {
    expect(decimalBrasileiro(entrada)).toBe(esperado);
  });

  it.each(['', 'abc', '1,2,3', '12.34', '1.2345,00', ',', '-'])('rejeita "%s"', (entrada) => {
    expect(() => decimalBrasileiro(entrada)).toThrow(/inválido/);
  });
});

describe('dataBrasileira', () => {
  it('converte dd/mm/aaaa para ISO', () => {
    expect(dataBrasileira('18/01/2025')).toBe('2025-01-18');
  });

  it.each(['', '2025-01-18', '31/02/2025', '1/1/2025'])('retorna null para "%s"', (entrada) => {
    expect(dataBrasileira(entrada)).toBeNull();
  });
});
