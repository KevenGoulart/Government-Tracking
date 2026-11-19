import { completarMeses } from './gastos-mensais';

describe('completarMeses', () => {
  const gastos = [
    { ano: 2025, mes: 2, total: '100.50' },
    { ano: 2025, mes: 5, total: '20.00' },
    { ano: 2024, mes: 12, total: '9.00' },
  ];

  it('preenche os 12 meses de um ano passado com zero onde não há gasto', () => {
    const dados = completarMeses(gastos, 2025, new Date('2026-06-01'));
    expect(dados).toHaveLength(12);
    expect(dados.slice(0, 5)).toEqual([
      { mes: 1, total: 0 },
      { mes: 2, total: 100.5 },
      { mes: 3, total: 0 },
      { mes: 4, total: 0 },
      { mes: 5, total: 20 },
    ]);
  });

  it('no ano corrente, vai só até o último mês com dado', () => {
    expect(completarMeses(gastos, 2025, new Date('2025-11-01'))).toHaveLength(5);
  });

  it('ignora outros anos', () => {
    expect(completarMeses(gastos, 2024, new Date('2026-01-01'))[11]).toEqual({ mes: 12, total: 9 });
  });
});
