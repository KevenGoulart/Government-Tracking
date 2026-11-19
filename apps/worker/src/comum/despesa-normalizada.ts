import { colapsarEspacos, normalizarDocumento, normalizarNome } from '@raio-x/shared';

/** Despesa de cota parlamentar já normalizada, independente da casa de origem. */
export interface DespesaNormalizada {
  ano: number;
  mes: number;
  categoria: { slug: string; nome: string };
  fornecedor: FornecedorNormalizado;
  dataDocumento: string | null;
  codDocumento: string | null;
  tipoDocumento: string | null;
  numDocumento: string | null;
  valorDocumento: string;
  valorGlosa: string;
  valorLiquido: string;
  urlDocumento: string | null;
  passageiro: string | null;
  trecho: string | null;
}

export type DespesaComChave = DespesaNormalizada & { idExterno: string };

export interface FornecedorNormalizado {
  /** Chave natural: o documento válido ou `nome:<NOME NORMALIZADO>`. */
  chave: string;
  documento: string | null;
  nome: string;
  nomeNormalizado: string;
}

/** Fornecedor identificado pelo CNPJ/CPF válido ou, na falta dele, pelo nome normalizado. */
export function fornecedorDaFonte(nome: string, documentoBruto: string): FornecedorNormalizado {
  const { documento } = normalizarDocumento(documentoBruto);
  const nomeLimpo = colapsarEspacos(nome) || 'NÃO INFORMADO';
  const nomeNormalizado = normalizarNome(nomeLimpo);
  return {
    chave: documento ?? `nome:${nomeNormalizado}`,
    documento,
    nome: nomeLimpo,
    nomeNormalizado,
  };
}

export const textoOuNull = (valor: string): string | null => colapsarEspacos(valor) || null;
