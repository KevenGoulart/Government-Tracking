import { createHash } from 'node:crypto';
import { colapsarEspacos, limparNomeCategoria, slugCategoria } from '@raio-x/shared';
import {
  type DespesaNormalizada,
  fornecedorDaFonte,
  textoOuNull,
} from '../comum/despesa-normalizada';
import type { LinhaCota } from './cota-csv';

/** Rótulos de `indTipoDocumento`, iguais aos que a API da Câmara usa em `tipoDocumento`. */
const TIPOS_DOCUMENTO: Record<string, string> = {
  '0': 'Nota Fiscal',
  '1': 'Recibos/Outros',
  '2': 'Despesa no Exterior',
  '4': 'DANFE/DACTE',
};

export interface DespesaCota extends DespesaNormalizada {
  /** Identificador do deputado na Câmara (ideCadastro / id da API). */
  ideCadastro: string;
  parlamentar: { nome: string; uf: string | null; partido: string | null };
  parcela: number;
  lote: string | null;
  ressarcimento: string | null;
}

export type DespesaCotaComChave = DespesaCota & { idExterno: string };

const vazioParaNull = (valor: string): string | null => {
  const limpo = colapsarEspacos(valor);
  return limpo === '' || limpo === '0' ? null : limpo;
};

function decimal(valor: string, campo: string): string {
  const numero = Number(valor === '' ? '0' : valor);
  if (!Number.isFinite(numero)) throw new Error(`Valor inválido em ${campo}: "${valor}"`);
  return numero.toFixed(2);
}

function inteiro(valor: string, campo: string): number {
  const numero = Number(valor);
  if (!Number.isInteger(numero)) throw new Error(`Inteiro inválido em ${campo}: "${valor}"`);
  return numero;
}

function tipoDocumento(codigo: string): string | null {
  const limpo = codigo.trim();
  if (!limpo) return null;
  return TIPOS_DOCUMENTO[limpo] ?? `Outro (código ${limpo})`;
}

function data(valor: string): string | null {
  const match = /^(\d{4}-\d{2}-\d{2})/.exec(valor);
  return match?.[1] ?? null;
}

/**
 * Converte uma linha do CSV da cota em uma despesa normalizada.
 * Retorna `null` para linhas sem deputado associado (despesas de lideranças partidárias).
 */
export function mapearLinhaCota(linha: LinhaCota): DespesaCota | null {
  const ideCadastro = linha.ideCadastro.trim();
  if (!ideCadastro) return null;

  return {
    ideCadastro,
    parlamentar: {
      nome: colapsarEspacos(linha.txNomeParlamentar),
      uf: textoOuNull(linha.sgUF),
      partido: textoOuNull(linha.sgPartido),
    },
    ano: inteiro(linha.numAno, 'numAno'),
    mes: inteiro(linha.numMes, 'numMes'),
    categoria: {
      slug: slugCategoria(linha.txtDescricao),
      nome: limparNomeCategoria(linha.txtDescricao),
    },
    fornecedor: fornecedorDaFonte(linha.txtFornecedor, linha.txtCNPJCPF),
    dataDocumento: data(linha.datEmissao),
    codDocumento: vazioParaNull(linha.ideDocumento),
    tipoDocumento: tipoDocumento(linha.indTipoDocumento),
    numDocumento: textoOuNull(linha.txtNumero),
    valorDocumento: decimal(linha.vlrDocumento, 'vlrDocumento'),
    valorGlosa: decimal(linha.vlrGlosa, 'vlrGlosa'),
    valorLiquido: decimal(linha.vlrLiquido, 'vlrLiquido'),
    urlDocumento: textoOuNull(linha.urlDocumento),
    passageiro: textoOuNull(linha.txtPassageiro),
    trecho: textoOuNull(linha.txtTrecho),
    parcela: linha.numParcela === '' ? 0 : inteiro(linha.numParcela, 'numParcela'),
    lote: vazioParaNull(linha.numLote),
    ressarcimento: vazioParaNull(linha.numRessarcimento),
  };
}

function hashConteudo(d: DespesaCota): string {
  const conteudo = [
    d.mes,
    d.categoria.slug,
    d.fornecedor.chave,
    d.dataDocumento,
    d.codDocumento,
    d.tipoDocumento,
    d.numDocumento,
    d.valorDocumento,
    d.valorGlosa,
    d.valorLiquido,
    d.urlDocumento,
    d.passageiro,
    d.trecho,
    d.parcela,
    d.lote,
    d.ressarcimento,
  ];
  return createHash('sha256').update(JSON.stringify(conteudo)).digest('hex').slice(0, 20);
}

/**
 * Atribui a chave natural de cada despesa de um mesmo deputado e ano.
 *
 * A fonte não tem identificador único por linha: `codDocumento` se repete (ex.: telefonia
 * com código "0", passagem emitida e cancelada com o mesmo código). A chave é então derivada
 * do conteúdo da linha, mais um contador para linhas idênticas. Como o conjunto do ano é
 * sempre reprocessado por inteiro, as chaves são estáveis entre execuções.
 */
export function atribuirChaves(despesas: DespesaCota[]): DespesaCotaComChave[] {
  const ocorrencias = new Map<string, number>();
  return despesas.map((despesa) => {
    const hash = hashConteudo(despesa);
    const n = ocorrencias.get(hash) ?? 0;
    ocorrencias.set(hash, n + 1);
    return {
      ...despesa,
      idExterno: `camara:${despesa.ideCadastro}:${despesa.ano}:${hash}:${n}`,
    };
  });
}
