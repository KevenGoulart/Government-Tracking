import { linhaCeaps, montarCeaps } from './__fixtures__/ceaps';
import { type LinhaCeaps, lerLinhasCeaps, mapearLinhaCeaps } from './ceaps-csv';

async function ler(...linhas: string[]): Promise<LinhaCeaps[]> {
  const resultado: LinhaCeaps[] = [];
  for await (const l of lerLinhasCeaps(montarCeaps(linhas))) resultado.push(l);
  return resultado;
}

describe('lerLinhasCeaps', () => {
  it('decodifica latin1 e ignora a linha de metadados', async () => {
    const [linha] = await ler(linhaCeaps());
    expect(linha?.SENADOR).toBe('ALAN RICK');
    expect(linha?.FORNECEDOR).toBe('CLARO NXT TELECOMUNICAÇÕES S.A');
  });

  it('falha quando o cabeçalho não existe', async () => {
    const arquivo = Uint8Array.from('"X";"Y"\r\n"1";"2"', (c) => c.charCodeAt(0));
    await expect(async () => {
      for await (const _ of lerLinhasCeaps(arquivo)) void _;
    }).rejects.toThrow(/Cabeçalho/);
  });
});

describe('mapearLinhaCeaps', () => {
  it('normaliza valores, datas, fornecedor e categoria do Senado', async () => {
    const [linha] = await ler(linhaCeaps());
    expect(mapearLinhaCeaps(linha as LinhaCeaps)).toEqual({
      senador: 'ALAN RICK',
      idExterno: 'senado:2025:2248419',
      ano: 2025,
      mes: 1,
      categoria: {
        slug: 'senado-aluguel-de-imoveis-para-escritorio-politico-compreendendo-despesas-concernentes-a-eles',
        nome: 'Aluguel de imóveis para escritório político, compreendendo despesas concernentes a eles',
      },
      fornecedor: {
        chave: '66970229013226',
        documento: '66970229013226',
        nome: 'CLARO NXT TELECOMUNICAÇÕES S.A',
        nomeNormalizado: 'CLARO NXT TELECOMUNICACOES S A',
      },
      dataDocumento: '2025-01-18',
      codDocumento: '2248419',
      tipoDocumento: null,
      numDocumento: '693736',
      valorDocumento: '399.44',
      valorGlosa: '0.00',
      valorLiquido: '399.44',
      urlDocumento: null,
      passageiro: null,
      trecho: null,
    });
  });

  it('mantém estornos negativos e usa categoria "Não informada" quando vazia', async () => {
    const [linha] = await ler(linhaCeaps({ VALOR_REEMBOLSADO: '-1966,37', TIPO_DESPESA: '' }));
    const despesa = mapearLinhaCeaps(linha as LinhaCeaps);
    expect(despesa.valorLiquido).toBe('-1966.37');
    expect(despesa.categoria).toEqual({ slug: 'senado-nao-informada', nome: 'Não informada' });
  });

  it('rejeita valores ou códigos inválidos', async () => {
    const [semCodigo, valorRuim] = await ler(
      linhaCeaps({ COD_DOCUMENTO: '' }),
      linhaCeaps({ VALOR_REEMBOLSADO: 'abc' }),
    );
    expect(() => mapearLinhaCeaps(semCodigo as LinhaCeaps)).toThrow(/COD_DOCUMENTO/);
    expect(() => mapearLinhaCeaps(valorRuim as LinhaCeaps)).toThrow(/inválido/);
  });
});
