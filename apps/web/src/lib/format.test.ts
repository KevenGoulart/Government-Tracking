import { caixaDeFrase, formatarData, formatarDataHora, nomeMes } from './format';

describe('format (web)', () => {
  it('formata datas ISO sem deslocamento de fuso', () => {
    expect(formatarData('2025-01-01')).toBe('01/01/2025');
    expect(formatarData(null)).toBe('—');
  });

  it('formata data e hora no fuso de Brasília', () => {
    expect(formatarDataHora('2026-11-19T10:02:00.000Z')).toMatch(/^19\/11\/2026,? 07:02$/);
  });

  it('nomeia meses', () => {
    expect(nomeMes(3)).toBe('março');
  });

  it('converte rótulos oficiais para caixa de frase', () => {
    expect(caixaDeFrase('COMBUSTÍVEIS E LUBRIFICANTES')).toBe('Combustíveis e lubrificantes');
    expect(caixaDeFrase('PASSAGEM AÉREA - SIGEPA')).toBe('Passagem aérea - SIGEPA');
  });
});
