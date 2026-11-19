import { LINHAS_EXEMPLO, linha, montarCsv, montarZip } from './__fixtures__/cota';
import { extrairCsvDoZip, type LinhaCota, lerLinhasCota } from './cota-csv';
import { atribuirChaves, type DespesaCota, mapearLinhaCota } from './despesa-cota.mapper';

async function lerTodas(csv: string): Promise<LinhaCota[]> {
  const linhas: LinhaCota[] = [];
  for await (const l of lerLinhasCota(extrairCsvDoZip(montarZip(csv)))) linhas.push(l);
  return linhas;
}

async function mapear(...linhasCsv: string[]): Promise<DespesaCota[]> {
  const linhas = await lerTodas(montarCsv(linhasCsv));
  return linhas.map(mapearLinhaCota).filter((d): d is DespesaCota => d !== null);
}

describe('lerLinhasCota', () => {
  it('lê o zip com BOM, separador ";" e campos com quebra de linha', async () => {
    const linhas = await lerTodas(
      montarCsv([LINHAS_EXEMPLO.combustivel, LINHAS_EXEMPLO.trechoComQuebraDeLinha]),
    );
    expect(linhas).toHaveLength(2);
    expect(linhas[0]?.txNomeParlamentar).toBe('Afonso Hamm');
    expect(linhas[1]?.txtTrecho).toBe('BSB/CGH/POA/RIA/VCP\n/BSB');
  });

  it('falha quando o zip não contém CSV', () => {
    expect(() => extrairCsvDoZip(montarZip('x', 'leiame.txt'))).toThrow(/Nenhum arquivo .csv/);
  });
});

describe('mapearLinhaCota', () => {
  it('normaliza uma despesa comum', async () => {
    const [despesa] = await mapear(LINHAS_EXEMPLO.combustivel);
    expect(despesa).toEqual({
      ideCadastro: '136811',
      parlamentar: { nome: 'Afonso Hamm', uf: 'RS', partido: 'PP' },
      ano: 2025,
      mes: 1,
      categoria: { slug: 'combustiveis-e-lubrificantes', nome: 'COMBUSTÍVEIS E LUBRIFICANTES' },
      fornecedor: {
        chave: '04971874000147',
        documento: '04971874000147',
        nome: 'POSTO NATIVUS LTDA AVENIDA',
        nomeNormalizado: 'POSTO NATIVUS LTDA AVENIDA',
      },
      dataDocumento: '2025-01-13',
      codDocumento: '7855758',
      tipoDocumento: 'DANFE/DACTE',
      numDocumento: '174760',
      valorDocumento: '190.34',
      valorGlosa: '0.00',
      valorLiquido: '190.34',
      urlDocumento:
        'https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=7855758',
      passageiro: null,
      trecho: null,
      parcela: 0,
      lote: '2102967',
      ressarcimento: null,
    });
  });

  it('ignora despesas de lideranças partidárias (sem deputado)', async () => {
    const [linhaLideranca] = await lerTodas(montarCsv([LINHAS_EXEMPLO.lideranca]));
    expect(linhaLideranca && mapearLinhaCota(linhaLideranca)).toBeNull();
  });

  it('descarta documento fictício e identifica o fornecedor pelo nome', async () => {
    const [ramal] = await mapear(LINHAS_EXEMPLO.ramalTelefonico);
    expect(ramal?.fornecedor).toEqual({
      chave: 'nome:RAMAL',
      documento: null,
      nome: 'RAMAL',
      nomeNormalizado: 'RAMAL',
    });
    expect(ramal).toMatchObject({ codDocumento: null, dataDocumento: null, urlDocumento: null });
  });

  it('mantém o sinal de estornos (passagem cancelada)', async () => {
    const [, cancelada] = await mapear(
      LINHAS_EXEMPLO.passagemEmitida,
      LINHAS_EXEMPLO.passagemCancelada,
    );
    expect(cancelada).toMatchObject({ valorDocumento: '-1469.95', valorLiquido: '-1469.95' });
  });

  it('rotula códigos de tipo de documento desconhecidos sem inventar significado', async () => {
    const [d] = await mapear(linha({ indTipoDocumento: '3' }));
    expect(d?.tipoDocumento).toBe('Outro (código 3)');
  });

  it('rejeita valores monetários inválidos', async () => {
    await expect(mapear(linha({ vlrLiquido: 'abc' }))).rejects.toThrow(/vlrLiquido/);
  });
});

describe('atribuirChaves', () => {
  it('gera chaves distintas para linhas que compartilham codDocumento', async () => {
    const despesas = await mapear(
      LINHAS_EXEMPLO.passagemEmitida,
      LINHAS_EXEMPLO.passagemCancelada,
      LINHAS_EXEMPLO.ramalTelefonico,
      linha({
        ...{ txtDescricao: 'TELEFONIA', txtFornecedor: 'RAMAL' },
        ideDocumento: '0',
        txtNumero: '7950599',
        vlrDocumento: '0.05',
        vlrLiquido: '0.05',
        txtCNPJCPF: '00000000000006',
      }),
    );
    const chaves = atribuirChaves(despesas).map((d) => d.idExterno);
    expect(new Set(chaves).size).toBe(4);
    expect(chaves[0]).toMatch(/^camara:136811:2025:[0-9a-f]{20}:0$/);
  });

  it('diferencia linhas idênticas por um contador de ocorrência', async () => {
    const despesas = await mapear(LINHAS_EXEMPLO.combustivel, LINHAS_EXEMPLO.combustivel);
    const [a, b] = atribuirChaves(despesas).map((d) => d.idExterno);
    expect(a?.replace(/:0$/, '')).toBe(b?.replace(/:1$/, ''));
    expect(a).not.toBe(b);
  });

  it('é determinística entre execuções', async () => {
    const despesas = await mapear(LINHAS_EXEMPLO.combustivel, LINHAS_EXEMPLO.passagemEmitida);
    expect(atribuirChaves(despesas)).toEqual(atribuirChaves(despesas));
  });
});
