import { describe, expect, it } from 'vitest';
import { limparNomeCategoria, slugCategoria } from './categoria';
import {
  cnpjValido,
  cpfValido,
  formatarDocumento,
  normalizarDocumento,
  somenteDigitos,
} from './documento';
import { normalizarNome, normalizarParaBusca, removerAcentos } from './texto';

describe('documento', () => {
  it('extrai somente dígitos', () => {
    expect(somenteDigitos('049.718.740/0014-7')).toBe('04971874000147');
  });

  it.each(['04971874000147', '02012862000160', '08.532.429/0001-31'])(
    'aceita CNPJ válido %s',
    (v) => {
      expect(cnpjValido(v)).toBe(true);
    },
  );

  it.each(['00000000000006', '11111111111111', '04971874000148', '123'])(
    'rejeita CNPJ inválido %s',
    (v) => {
      expect(cnpjValido(v)).toBe(false);
    },
  );

  it('valida CPF pelos dígitos verificadores', () => {
    expect(cpfValido('529.982.247-25')).toBe(true);
    expect(cpfValido('529.982.247-26')).toBe(false);
    expect(cpfValido('000.000.000-00')).toBe(false);
  });

  it('normaliza CNPJ e CPF e descarta documentos fictícios', () => {
    expect(normalizarDocumento('049.718.740/0014-7')).toEqual({
      documento: '04971874000147',
      tipo: 'CNPJ',
    });
    expect(normalizarDocumento('52998224725')).toEqual({ documento: '52998224725', tipo: 'CPF' });
    expect(normalizarDocumento('00000000000006')).toEqual({ documento: null, tipo: null });
    expect(normalizarDocumento('')).toEqual({ documento: null, tipo: null });
    expect(normalizarDocumento(undefined)).toEqual({ documento: null, tipo: null });
  });

  it('formata documentos para exibição', () => {
    expect(formatarDocumento('04971874000147')).toBe('04.971.874/0001-47');
    expect(formatarDocumento('52998224725')).toBe('529.982.247-25');
    expect(formatarDocumento('123')).toBe('123');
  });
});

describe('texto', () => {
  it('remove acentos', () => {
    expect(removerAcentos('Acácio Favacho — São João')).toBe('Acacio Favacho — Sao Joao');
  });

  it('normaliza nomes de fornecedores para comparação', () => {
    expect(normalizarNome('  Posto  Nativus Ltda. - Avenida ')).toBe(
      'POSTO NATIVUS LTDA - AVENIDA',
    );
    expect(normalizarNome('Cafés & Cia')).toBe('CAFES & CIA');
  });

  it('gera a forma de busca em minúsculas', () => {
    expect(normalizarParaBusca('Acácio  FAVACHO')).toBe('acacio favacho');
  });
});

describe('categoria', () => {
  it.each([
    [
      'HOSPEDAGEM ,EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL.',
      'HOSPEDAGEM, EXCETO DO PARLAMENTAR NO DISTRITO FEDERAL',
    ],
    ['COMBUSTÍVEIS E LUBRIFICANTES.', 'COMBUSTÍVEIS E LUBRIFICANTES'],
    ['PASSAGEM AÉREA - SIGEPA', 'PASSAGEM AÉREA - SIGEPA'],
  ])('limpa o rótulo "%s"', (entrada, esperado) => {
    expect(limparNomeCategoria(entrada)).toBe(esperado);
  });

  it('gera slugs estáveis', () => {
    expect(slugCategoria('MANUTENÇÃO DE ESCRITÓRIO DE APOIO À ATIVIDADE PARLAMENTAR')).toBe(
      'manutencao-de-escritorio-de-apoio-a-atividade-parlamentar',
    );
    expect(slugCategoria('COMBUSTÍVEIS E LUBRIFICANTES.')).toBe(
      slugCategoria('Combustíveis e lubrificantes'),
    );
  });
});
