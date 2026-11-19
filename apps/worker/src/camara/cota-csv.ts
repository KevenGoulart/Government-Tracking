import { Readable } from 'node:stream';
import { parse } from 'csv-parse';
import { unzipSync } from 'fflate';
import { z } from 'zod';

/**
 * Colunas usadas do arquivo anual da Cota Parlamentar (camara.leg.br/cotas/Ano-AAAA.csv.zip).
 * Dicionário de dados: https://www2.camara.leg.br/transparencia/cota-para-exercicio-da-atividade-parlamentar/explicacoes-sobre-o-formato-dos-arquivos-xml
 */
export const linhaCotaSchema = z.object({
  txNomeParlamentar: z.string(),
  ideCadastro: z.string(),
  sgUF: z.string(),
  sgPartido: z.string(),
  txtDescricao: z.string(),
  txtFornecedor: z.string(),
  txtCNPJCPF: z.string(),
  txtNumero: z.string(),
  indTipoDocumento: z.string(),
  datEmissao: z.string(),
  vlrDocumento: z.string(),
  vlrGlosa: z.string(),
  vlrLiquido: z.string(),
  numMes: z.string(),
  numAno: z.string(),
  numParcela: z.string(),
  txtPassageiro: z.string(),
  txtTrecho: z.string(),
  numLote: z.string(),
  numRessarcimento: z.string(),
  ideDocumento: z.string(),
  urlDocumento: z.string(),
});
export type LinhaCota = z.infer<typeof linhaCotaSchema>;

/** Extrai o primeiro arquivo .csv de um zip em memória. */
export function extrairCsvDoZip(zip: Uint8Array): Uint8Array {
  const arquivos = unzipSync(zip, { filter: (arquivo) => arquivo.name.endsWith('.csv') });
  const [csv] = Object.values(arquivos);
  if (!csv) throw new Error('Nenhum arquivo .csv encontrado no zip da cota parlamentar');
  return csv;
}

const TAMANHO_PEDACO = 1 << 20;

/**
 * Entrega o arquivo em pedaços de 1 MB, sem copiar (`Buffer.from(buffer, offset, tamanho)`
 * é uma visão sobre a mesma memória). Assim o arquivo pode ser lido mais de uma vez sem
 * duplicar os ~75 MB descompactados.
 */
function* emPedacos(csv: Uint8Array): Generator<Buffer> {
  for (let inicio = 0; inicio < csv.byteLength; inicio += TAMANHO_PEDACO) {
    const tamanho = Math.min(TAMANHO_PEDACO, csv.byteLength - inicio);
    yield Buffer.from(csv.buffer, csv.byteOffset + inicio, tamanho);
  }
}

/**
 * Lê as linhas do CSV (UTF-8 com BOM, separador ";", campos entre aspas que podem conter
 * quebras de linha). Valida cada linha e informa o número do registro em caso de erro.
 */
export async function* lerLinhasCota(csv: Uint8Array): AsyncGenerator<LinhaCota> {
  const parser = Readable.from(emPedacos(csv)).pipe(
    parse({
      delimiter: ';',
      bom: true,
      columns: true,
      skip_empty_lines: true,
      relax_quotes: true,
    }),
  );

  let registro = 0;
  for await (const bruto of parser as AsyncIterable<unknown>) {
    registro++;
    const resultado = linhaCotaSchema.safeParse(bruto);
    if (!resultado.success) {
      throw new Error(`Linha ${registro} do CSV da cota inválida: ${resultado.error.message}`);
    }
    yield resultado.data;
  }
}
