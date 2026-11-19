const CABECALHO = [
  'ANO',
  'MES',
  'SENADOR',
  'TIPO_DESPESA',
  'CNPJ_CPF',
  'FORNECEDOR',
  'DOCUMENTO',
  'DATA',
  'DETALHAMENTO',
  'VALOR_REEMBOLSADO',
  'COD_DOCUMENTO',
] as const;

type Coluna = (typeof CABECALHO)[number];

const BASE: Record<Coluna, string> = {
  ANO: '2025',
  MES: '1',
  SENADOR: 'ALAN RICK',
  TIPO_DESPESA:
    'Aluguel de imóveis para escritório político, compreendendo despesas concernentes a eles.',
  CNPJ_CPF: '66.970.229/0132-26',
  FORNECEDOR: 'CLARO NXT TELECOMUNICAÇÕES S.A',
  DOCUMENTO: '693736',
  DATA: '18/01/2025',
  DETALHAMENTO: '',
  VALOR_REEMBOLSADO: '399,44',
  COD_DOCUMENTO: '2248419',
};

export function linhaCeaps(sobrescrever: Partial<Record<Coluna, string>> = {}): string {
  const valores = { ...BASE, ...sobrescrever };
  return CABECALHO.map((c) => `"${valores[c]}"`).join(';');
}

/** Monta o arquivo como o oficial: ISO-8859-1, CRLF e linha de metadados antes do cabeçalho. */
export function montarCeaps(linhas: string[]): Uint8Array {
  const texto = [
    '"ULTIMA ATUALIZACAO";"19/11/2026 02:01"',
    CABECALHO.map((c) => `"${c}"`).join(';'),
    ...linhas,
  ].join('\r\n');
  // latin1: cada caractere vira um byte (os textos de teste só usam caracteres do Latin-1)
  return Uint8Array.from(texto, (c) => c.charCodeAt(0));
}
