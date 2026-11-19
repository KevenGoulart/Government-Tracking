import type { Comparacao } from '@raio-x/shared';
import { idsDaUrl, montarCategorias, montarMensal } from './dados';

const parlamentar = (id: string) => ({
  id,
  casa: 'CAMARA' as const,
  nome: id,
  partido: null,
  uf: 'SP',
  fotoUrl: null,
  emExercicio: true,
});

const comparacao: Comparacao = {
  ano: 2025,
  parlamentares: [
    {
      parlamentar: parlamentar('a'),
      total: '300.00',
      quantidade: 2,
      categorias: [
        { slug: 'x', nome: 'COMBUSTÍVEIS', total: '100.00' },
        { slug: 'y', nome: 'TELEFONIA', total: '200.00' },
      ],
      mensal: [{ ano: 2025, mes: 2, total: '300.00' }],
    },
    {
      parlamentar: parlamentar('b'),
      total: '500.00',
      quantidade: 1,
      categorias: [{ slug: 'x', nome: 'COMBUSTÍVEIS', total: '500.00' }],
      mensal: [{ ano: 2025, mes: 4, total: '500.00' }],
    },
  ],
};

describe('dados da comparação', () => {
  it('lê ids da URL sem repetidos e com limite de 4', () => {
    expect(idsDaUrl('a, b,,a,c,d,e')).toEqual(['a', 'b', 'c', 'd']);
    expect(idsDaUrl(undefined)).toEqual([]);
  });

  it('monta a série mensal com zero onde não há gasto', () => {
    const mensal = montarMensal(comparacao, new Date('2025-06-01'));
    expect(mensal).toHaveLength(4);
    expect(mensal[1]).toEqual({ rotulo: '2', a: 300, b: 0 });
    expect(mensal[3]).toEqual({ rotulo: '4', a: 0, b: 500 });
    expect(montarMensal(comparacao, new Date('2026-06-15'))).toHaveLength(12);
  });

  it('ordena categorias pelo total somado e completa com zero', () => {
    expect(montarCategorias(comparacao)).toEqual([
      { rotulo: 'Combustíveis', a: 100, b: 500 },
      { rotulo: 'Telefonia', a: 200, b: 0 },
    ]);
    expect(montarCategorias(comparacao, 1)).toHaveLength(1);
  });
});
