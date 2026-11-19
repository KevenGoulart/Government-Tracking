import { describe, expect, it } from 'vitest';
import {
  categoriaForaDaConcentracao,
  haConcentracao,
  limiteAtipico,
  pontosAtencaoQuerySchema,
} from './pontos-atencao';

describe('limiteAtipico', () => {
  it('usa a cerca de Tukey quando ela fica acima do percentil 99', () => {
    // Combustível 2025: Q1 170, Q3 298,61 → cerca 684,45; P99 3.097,77
    expect(limiteAtipico({ q1: 170, q3: 298.61, p99: 3097.77 })).toBe(3097.77);
    // Locação de veículos: valores quase fixos, cerca (19.350) acima do P99 (13.226)
    expect(limiteAtipico({ q1: 3550, q3: 7500, p99: 13226.19 })).toBe(19350);
  });

  it('com intervalo interquartil zero, o limite é o percentil 99', () => {
    expect(limiteAtipico({ q1: 6000, q3: 6000, p99: 6000 })).toBe(6000);
  });
});

describe('categoriaForaDaConcentracao', () => {
  it('exclui passagens das duas casas', () => {
    expect(categoriaForaDaConcentracao('passagem-aerea-sigepa')).toBe(true);
    expect(categoriaForaDaConcentracao('passagens-terrestres-maritimas-ou-fluviais')).toBe(true);
    expect(
      categoriaForaDaConcentracao('senado-passagens-aereas-aquaticas-e-terrestres-nacionais'),
    ).toBe(true);
  });

  it('mantém as demais categorias', () => {
    expect(categoriaForaDaConcentracao('divulgacao-da-atividade-parlamentar')).toBe(false);
    expect(categoriaForaDaConcentracao('locacao-ou-fretamento-de-veiculos-automotores')).toBe(
      false,
    );
  });
});

describe('haConcentracao', () => {
  it('exige metade do total e um total mínimo', () => {
    expect(haConcentracao(50_000, 100_000)).toBe(true);
    expect(haConcentracao(49_999, 100_000)).toBe(false);
    // Total pequeno: um único fornecedor domina naturalmente
    expect(haConcentracao(30_000, 40_000)).toBe(false);
  });
});

describe('pontosAtencaoQuerySchema', () => {
  it('aceita ano vazio vindo de formulário', () => {
    expect(pontosAtencaoQuerySchema.parse({ ano: '' })).toEqual({ ano: undefined });
    expect(pontosAtencaoQuerySchema.parse({ ano: '2025' })).toEqual({ ano: 2025 });
  });
});
