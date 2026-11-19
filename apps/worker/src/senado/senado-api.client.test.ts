import { exerceuNaLegislatura } from './senado-api.client';

const leg56 = { NumeroLegislatura: '56', DataInicio: '2019-02-01', DataFim: '2023-01-31' };
const leg57 = { NumeroLegislatura: '57', DataInicio: '2023-02-01', DataFim: '2027-01-31' };

describe('exerceuNaLegislatura', () => {
  it('titular com exercício em aberto exerceu', () => {
    const mandatos = [
      {
        PrimeiraLegislaturaDoMandato: leg57,
        Exercicios: { Exercicio: [{ DataInicio: '2023-02-01' }] },
      },
    ];
    expect(exerceuNaLegislatura(mandatos, 57)).toBe(true);
  });

  it('suplente sem exercícios não exerceu (caso real: deputados que são suplentes de senador)', () => {
    const mandatos = [{ PrimeiraLegislaturaDoMandato: leg56, SegundaLegislaturaDoMandato: leg57 }];
    expect(exerceuNaLegislatura(mandatos, 57)).toBe(false);
  });

  it('exercício só na legislatura anterior não conta', () => {
    const mandatos = [
      {
        PrimeiraLegislaturaDoMandato: leg56,
        SegundaLegislaturaDoMandato: leg57,
        Exercicios: { Exercicio: [{ DataInicio: '2020-03-01', DataFim: '2020-07-01' }] },
      },
    ];
    expect(exerceuNaLegislatura(mandatos, 57)).toBe(false);
  });

  it('suplente que assumiu por alguns meses na legislatura exerceu', () => {
    const mandatos = [
      {
        PrimeiraLegislaturaDoMandato: leg56,
        SegundaLegislaturaDoMandato: leg57,
        Exercicios: { Exercicio: [{ DataInicio: '2024-04-02', DataFim: '2024-08-01' }] },
      },
    ];
    expect(exerceuNaLegislatura(mandatos, 57)).toBe(true);
  });
});
