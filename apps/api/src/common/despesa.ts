import type { Prisma } from '@raio-x/db';
import type { Despesa } from '@raio-x/shared';
import { decimal } from './decimal';

/** Relações carregadas para montar uma despesa na resposta da API. */
export const INCLUDE_DESPESA = {
  categoria: { select: { slug: true, nome: true } },
  fornecedor: { select: { id: true, nome: true, documento: true } },
} satisfies Prisma.DespesaInclude;

type DespesaComRelacoes = Prisma.DespesaGetPayload<{ include: typeof INCLUDE_DESPESA }>;

export function mapearDespesa(d: DespesaComRelacoes): Despesa {
  return {
    id: d.id,
    ano: d.ano,
    mes: d.mes,
    dataDocumento: d.dataDocumento ? d.dataDocumento.toISOString().slice(0, 10) : null,
    categoria: d.categoria,
    fornecedor: d.fornecedor,
    tipoDocumento: d.tipoDocumento,
    numDocumento: d.numDocumento,
    valorDocumento: decimal(d.valorDocumento),
    valorGlosa: decimal(d.valorGlosa),
    valorLiquido: decimal(d.valorLiquido),
    urlDocumento: d.urlDocumento,
  };
}
