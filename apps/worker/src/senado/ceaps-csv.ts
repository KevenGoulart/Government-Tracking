import { Readable } from 'node:stream';
import {
  dataBrasileira,
  decimalBrasileiro,
  limparNomeCategoria,
  slugCategoria,
} from '@raio-x/shared';
import { parse } from 'csv-parse';
import { z } from 'zod';
import {
  type DespesaNormalizada,
  fornecedorDaFonte,
  textoOuNull,
} from '../comum/despesa-normalizada';

/**
 * Linha do arquivo anual da CEAPS (Cota para o Exercício da Atividade Parlamentar dos
 * Senadores): https://www.senado.leg.br/transparencia/LAI/verba/despesa_ceaps_AAAA.csv
 */
export const linhaCeapsSchema = z.object({
  ANO: z.string(),
  MES: z.string(),
  SENADOR: z.string(),
  TIPO_DESPESA: z.string(),
  CNPJ_CPF: z.string(),
  FORNECEDOR: z.string(),
  DOCUMENTO: z.string(),
  DATA: z.string(),
  DETALHAMENTO: z.string(),
  VALOR_REEMBOLSADO: z.string(),
  COD_DOCUMENTO: z.string(),
});
export type LinhaCeaps = z.infer<typeof linhaCeapsSchema>;

/**
 * Lê o CSV da CEAPS: codificação ISO-8859-1, separador ";" e uma linha de metadados
 * ("ULTIMA ATUALIZACAO") antes do cabeçalho.
 */
export async function* lerLinhasCeaps(arquivo: Uint8Array): AsyncGenerator<LinhaCeaps> {
  const texto = new TextDecoder('latin1').decode(arquivo);
  const inicioCabecalho = texto.indexOf('"ANO"');
  if (inicioCabecalho < 0) throw new Error('Cabeçalho do CSV da CEAPS não encontrado');

  const parser = Readable.from([texto.slice(inicioCabecalho)]).pipe(
    parse({ delimiter: ';', columns: true, skip_empty_lines: true, relax_quotes: true }),
  );
  let registro = 0;
  for await (const bruto of parser as AsyncIterable<unknown>) {
    registro++;
    const resultado = linhaCeapsSchema.safeParse(bruto);
    if (!resultado.success) {
      throw new Error(`Linha ${registro} do CSV da CEAPS inválida: ${resultado.error.message}`);
    }
    yield resultado.data;
  }
}

export interface DespesaSenado extends DespesaNormalizada {
  /** Nome do senador como aparece no arquivo (a fonte não traz identificador). */
  senador: string;
  idExterno: string;
}

const CATEGORIA_NAO_INFORMADA = 'Não informada';

/**
 * Normaliza uma linha da CEAPS. O arquivo traz só o valor reembolsado (sem valor do
 * documento nem glosa) e não tem link para o comprovante.
 */
export function mapearLinhaCeaps(linha: LinhaCeaps): DespesaSenado {
  const ano = Number(linha.ANO);
  const mes = Number(linha.MES);
  if (!Number.isInteger(ano) || !Number.isInteger(mes) || mes < 1 || mes > 12) {
    throw new Error(`Ano/mês inválido na CEAPS: ${linha.ANO}/${linha.MES}`);
  }
  const codigo = linha.COD_DOCUMENTO.trim();
  if (!codigo) throw new Error('Linha da CEAPS sem COD_DOCUMENTO');

  const tipo = limparNomeCategoria(linha.TIPO_DESPESA) || CATEGORIA_NAO_INFORMADA;
  const valor = decimalBrasileiro(linha.VALOR_REEMBOLSADO);

  return {
    senador: linha.SENADOR.trim(),
    // COD_DOCUMENTO é único no arquivo de cada ano (verificado em 2025 e 2026)
    idExterno: `senado:${ano}:${codigo}`,
    ano,
    mes,
    categoria: { slug: `senado-${slugCategoria(tipo)}`, nome: tipo },
    fornecedor: fornecedorDaFonte(linha.FORNECEDOR, linha.CNPJ_CPF),
    dataDocumento: dataBrasileira(linha.DATA),
    codDocumento: codigo,
    tipoDocumento: null,
    numDocumento: textoOuNull(linha.DOCUMENTO),
    valorDocumento: valor,
    valorGlosa: '0.00',
    valorLiquido: valor,
    urlDocumento: null,
    passageiro: null,
    trecho: null,
  };
}
