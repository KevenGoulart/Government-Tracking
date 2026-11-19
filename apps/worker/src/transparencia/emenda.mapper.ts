import { colapsarEspacos, decimalBrasileiro } from '@raio-x/shared';
import type { EmendaPortal } from './portal-transparencia.client';

export interface EmendaNormalizada {
  codigo: string;
  ano: number;
  numero: string | null;
  tipo: string;
  /** Autor como veio da fonte, sem o texto entre parênteses. */
  autor: string;
  observacaoAutor: string | null;
  /** Emendas de bancada/comissão não têm um parlamentar como autor. */
  autorColetivo: boolean;
  localidade: string | null;
  funcao: string | null;
  subfuncao: string | null;
  valorEmpenhado: string;
  valorLiquidado: string;
  valorPago: string;
  valorRestoInscrito: string;
  valorRestoCancelado: string;
  valorRestoPago: string;
}

const AUTOR_COLETIVO = /^(BANCADA|COMISS[AÃ]O|RELATOR|LIDERAN[CÇ]A|MESA)\b/i;

const textoOuNull = (valor: string | null | undefined) => colapsarEspacos(valor ?? '') || null;

/**
 * Normaliza uma emenda do Portal. O autor às vezes vem com uma observação entre
 * parênteses, ex.: "RODRIGO DA ZAELI (EX-PARLAMENTAR ABILIO BRUNINI, NOS TERMOS ART. 78
 * LDO 2025 ...)": a emenda passou para o sucessor do mandato, que é quem aparece como autor.
 */
export function mapearEmenda(emenda: EmendaPortal): EmendaNormalizada {
  // A fonte às vezes trunca o texto e o parêntese de fechamento some: ")" é opcional.
  const match = /^([^(]*)\((.*?)\)?\s*$/.exec(emenda.nomeAutor);
  const autor = colapsarEspacos(match?.[1] ?? emenda.nomeAutor);
  const tipo = colapsarEspacos(emenda.tipoEmenda);

  return {
    codigo: emenda.codigoEmenda.trim(),
    ano: emenda.ano,
    numero: textoOuNull(emenda.numeroEmenda),
    tipo,
    autor,
    observacaoAutor: textoOuNull(match?.[2]),
    autorColetivo: /bancada|comiss/i.test(tipo) || AUTOR_COLETIVO.test(autor),
    localidade: textoOuNull(emenda.localidadeDoGasto),
    funcao: textoOuNull(emenda.funcao),
    subfuncao: textoOuNull(emenda.subfuncao),
    valorEmpenhado: decimalBrasileiro(emenda.valorEmpenhado),
    valorLiquidado: decimalBrasileiro(emenda.valorLiquidado),
    valorPago: decimalBrasileiro(emenda.valorPago),
    valorRestoInscrito: decimalBrasileiro(emenda.valorRestoInscrito),
    valorRestoCancelado: decimalBrasileiro(emenda.valorRestoCancelado),
    valorRestoPago: decimalBrasileiro(emenda.valorRestoPago),
  };
}
