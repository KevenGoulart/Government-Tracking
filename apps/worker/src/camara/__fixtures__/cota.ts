import { strToU8, zipSync } from 'fflate';

/** Cabeçalho real do arquivo anual da cota (32 colunas). */
export const CABECALHO = [
  'txNomeParlamentar',
  'cpf',
  'ideCadastro',
  'nuCarteiraParlamentar',
  'nuLegislatura',
  'sgUF',
  'sgPartido',
  'codLegislatura',
  'numSubCota',
  'txtDescricao',
  'numEspecificacaoSubCota',
  'txtDescricaoEspecificacao',
  'txtFornecedor',
  'txtCNPJCPF',
  'txtNumero',
  'indTipoDocumento',
  'datEmissao',
  'vlrDocumento',
  'vlrGlosa',
  'vlrLiquido',
  'numMes',
  'numAno',
  'numParcela',
  'txtPassageiro',
  'txtTrecho',
  'numLote',
  'numRessarcimento',
  'datPagamentoRestituicao',
  'vlrRestituicao',
  'nuDeputadoId',
  'ideDocumento',
  'urlDocumento',
] as const;

type Coluna = (typeof CABECALHO)[number];

const BASE: Record<Coluna, string> = {
  txNomeParlamentar: 'Afonso Hamm',
  cpf: '',
  ideCadastro: '136811',
  nuCarteiraParlamentar: '487',
  nuLegislatura: '2023',
  sgUF: 'RS',
  sgPartido: 'PP',
  codLegislatura: '57',
  numSubCota: '3',
  txtDescricao: 'COMBUSTÍVEIS E LUBRIFICANTES.',
  numEspecificacaoSubCota: '1',
  txtDescricaoEspecificacao: 'Veículos Automotores',
  txtFornecedor: 'POSTO NATIVUS LTDA AVENIDA',
  txtCNPJCPF: '049.718.740/0014-7',
  txtNumero: '174760',
  indTipoDocumento: '4',
  datEmissao: '2025-01-13T15:56:03',
  vlrDocumento: '190.34',
  vlrGlosa: '0',
  vlrLiquido: '190.34',
  numMes: '1',
  numAno: '2025',
  numParcela: '0',
  txtPassageiro: '',
  txtTrecho: '',
  numLote: '2102967',
  numRessarcimento: '',
  datPagamentoRestituicao: '',
  vlrRestituicao: '',
  nuDeputadoId: '1758',
  ideDocumento: '7855758',
  urlDocumento:
    'https://www.camara.leg.br/cota-parlamentar/nota-fiscal-eletronica?ideDocumentoFiscal=7855758',
};

export function linha(sobrescrever: Partial<Record<Coluna, string>> = {}): string {
  const valores = { ...BASE, ...sobrescrever };
  return CABECALHO.map((coluna) => `"${valores[coluna]}"`).join(';');
}

const BOM = String.fromCharCode(0xfeff);

export function montarCsv(linhas: string[]): string {
  // BOM + CRLF, como no arquivo oficial
  return `${BOM}${CABECALHO.map((c) => `"${c}"`).join(';')}\r\n${linhas.join('\r\n')}\r\n`;
}

export function montarZip(csv: string, nome = 'Ano-2025.csv'): Uint8Array {
  return zipSync({ [nome]: strToU8(csv) });
}

/** Cenários reais observados no arquivo de 2025. */
export const LINHAS_EXEMPLO = {
  combustivel: linha(),
  lideranca: linha({
    txNomeParlamentar: 'LIDERANÇA DO PDT',
    ideCadastro: '',
    sgUF: 'NA',
    sgPartido: '',
    ideDocumento: '9999',
  }),
  ramalTelefonico: linha({
    txtDescricao: 'TELEFONIA',
    txtFornecedor: 'RAMAL',
    txtCNPJCPF: '00000000000006',
    txtNumero: '7949712',
    indTipoDocumento: '0',
    datEmissao: '',
    vlrDocumento: '3.65',
    vlrLiquido: '3.65',
    numLote: '0',
    numRessarcimento: '0',
    ideDocumento: '0',
    urlDocumento: '',
  }),
  passagemEmitida: linha({
    txtDescricao: 'PASSAGEM AÉREA - SIGEPA',
    txtFornecedor: 'TAM',
    txtCNPJCPF: '020.128.620/0016-0',
    txtNumero: '9572215578980',
    indTipoDocumento: '0',
    datEmissao: '2025-01-15T12:00:00',
    vlrDocumento: '1469.95',
    vlrLiquido: '1469.95',
    txtPassageiro: 'AFONSO HAMM',
    txtTrecho: 'BSB/POA',
    numLote: '0',
    ideDocumento: '302440',
    urlDocumento: '',
  }),
  passagemCancelada: linha({
    txtDescricao: 'PASSAGEM AÉREA - SIGEPA',
    txtFornecedor: 'TAM',
    txtCNPJCPF: '020.128.620/0016-0',
    txtNumero: '9572215578980',
    indTipoDocumento: '0',
    datEmissao: '2025-01-15T12:00:00',
    vlrDocumento: '-1469.95',
    vlrLiquido: '-1469.95',
    txtPassageiro: 'AFONSO HAMM',
    txtTrecho: 'BSB/POA',
    numLote: '0',
    ideDocumento: '302440',
    urlDocumento: '',
  }),
  trechoComQuebraDeLinha: linha({
    ideCadastro: '74400',
    txNomeParlamentar: 'Paulo Pimenta',
    sgPartido: 'PT',
    txtDescricao: 'PASSAGEM AÉREA - SIGEPA',
    txtFornecedor: 'AZUL',
    txtCNPJCPF: '092.962.950/0016-0',
    txtNumero: 'GIKJVP',
    indTipoDocumento: '0',
    vlrDocumento: '2481.97',
    vlrLiquido: '2481.97',
    numMes: '7',
    txtPassageiro: 'Magda Beatris da Silva',
    txtTrecho: 'BSB/CGH/POA/RIA/VCP\n/BSB',
    numLote: '0',
    ideDocumento: '345222',
    urlDocumento: '',
  }),
};
