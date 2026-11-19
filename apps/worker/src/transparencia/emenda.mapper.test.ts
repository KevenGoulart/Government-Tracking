import { mapearEmenda } from './emenda.mapper';
import type { EmendaPortal } from './portal-transparencia.client';

const base: EmendaPortal = {
  codigoEmenda: '202542900005',
  ano: 2025,
  tipoEmenda: 'Emenda Individual - Transferências com Finalidade Definida',
  nomeAutor: 'SOSTENES CAVALCANTE',
  numeroEmenda: '0005',
  localidadeDoGasto: 'CUIABÁ - MT',
  funcao: 'Desporto e lazer',
  subfuncao: 'Desporto comunitário',
  valorEmpenhado: '8.000,00',
  valorLiquidado: '8.000,00',
  valorPago: '7.500,50',
  valorRestoInscrito: '0,00',
  valorRestoCancelado: '0,00',
  valorRestoPago: '0,00',
};

describe('mapearEmenda', () => {
  it('normaliza valores no formato brasileiro', () => {
    expect(mapearEmenda(base)).toMatchObject({
      codigo: '202542900005',
      autor: 'SOSTENES CAVALCANTE',
      observacaoAutor: null,
      autorColetivo: false,
      valorEmpenhado: '8000.00',
      valorPago: '7500.50',
      localidade: 'CUIABÁ - MT',
    });
  });

  it('separa a observação de sucessão de mandato (art. 78 da LDO)', () => {
    const emenda = mapearEmenda({
      ...base,
      nomeAutor:
        'RODRIGO DA ZAELI (EX-PARLAMENTAR ABILIO BRUNINI, NOS TERMOS ART. 78 LDO 2025 E DA MENSAGEM 95-CN, DE 06.11.25)',
    });
    expect(emenda.autor).toBe('RODRIGO DA ZAELI');
    expect(emenda.observacaoAutor).toBe(
      'EX-PARLAMENTAR ABILIO BRUNINI, NOS TERMOS ART. 78 LDO 2025 E DA MENSAGEM 95-CN, DE 06.11.25',
    );
  });

  it('separa a observação mesmo quando a fonte trunca o parêntese de fechamento', () => {
    const emenda = mapearEmenda({
      ...base,
      nomeAutor:
        'DR. FLAVIO (EX-PARLAMENTAR DELEGADO RAMAGEM, NOS TERMOS DA DECISAO ADPF 854, DE 03',
    });
    expect(emenda.autor).toBe('DR. FLAVIO');
    expect(emenda.observacaoAutor).toBe(
      'EX-PARLAMENTAR DELEGADO RAMAGEM, NOS TERMOS DA DECISAO ADPF 854, DE 03',
    );
  });

  it.each([
    ['Emenda de Bancada', 'BANCADA DO RIO DE JANEIRO'],
    ['Emenda de Comissão', 'COMISSAO DE SAUDE'],
  ])('marca autor coletivo (%s)', (tipoEmenda, nomeAutor) => {
    expect(mapearEmenda({ ...base, tipoEmenda, nomeAutor }).autorColetivo).toBe(true);
  });

  it('trata campos opcionais ausentes como nulos', () => {
    const emenda = mapearEmenda({
      ...base,
      localidadeDoGasto: null,
      funcao: '',
      numeroEmenda: undefined,
    });
    expect(emenda).toMatchObject({ localidade: null, funcao: null, numero: null });
  });
});
