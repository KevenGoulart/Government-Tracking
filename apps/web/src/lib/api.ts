import 'server-only';
import {
  type Categoria,
  categoriaSchema,
  despesaSchema,
  type DespesasQuery,
  filtrosParlamentaresSchema,
  gastoMensalSchema,
  paginatedSchema,
  parlamentarDetalheSchema,
  type ParlamentaresQuery,
  parlamentarResumoSchema,
  syncStatusSchema,
} from '@raio-x/shared';
import { z } from 'zod';

/**
 * Cliente da API própria (apps/api), usado apenas no servidor (Server Components).
 * O front-end nunca chama as APIs do governo: os dados vêm sempre da nossa base.
 */
const API_URL = process.env.API_URL ?? 'http://localhost:3001';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly path: string,
  ) {
    super(`API respondeu ${status} em ${path}`);
    this.name = 'ApiError';
  }
}

type QueryValue = string | number | undefined | null;

export function montarQuery(params: Record<string, QueryValue>): string {
  const search = new URLSearchParams();
  for (const [chave, valor] of Object.entries(params)) {
    if (valor !== undefined && valor !== null && valor !== '') search.set(chave, String(valor));
  }
  const texto = search.toString();
  return texto ? `?${texto}` : '';
}

async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  revalidate: number,
): Promise<z.infer<T>> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { Accept: 'application/json' },
    next: { revalidate },
  });
  if (!res.ok) throw new ApiError(res.status, path);
  // Valida o contrato: uma mudança na API quebra aqui, com erro claro, e não na renderização.
  return schema.parse(await res.json());
}

/** Os dados mudam no máximo uma vez por dia (sincronização diária). */
const UMA_HORA = 3_600;
const CINCO_MINUTOS = 300;

export const api = {
  parlamentares: (query: Partial<ParlamentaresQuery>) =>
    apiGet(
      `/parlamentares${montarQuery(query)}`,
      paginatedSchema(parlamentarResumoSchema),
      UMA_HORA,
    ),

  filtros: () => apiGet('/parlamentares/filtros', filtrosParlamentaresSchema, UMA_HORA),

  categorias: (): Promise<Categoria[]> => apiGet('/categorias', z.array(categoriaSchema), UMA_HORA),

  parlamentar: (id: string, ano?: number) =>
    apiGet(
      `/parlamentares/${encodeURIComponent(id)}${montarQuery({ ano })}`,
      parlamentarDetalheSchema,
      UMA_HORA,
    ),

  despesas: (id: string, query: Partial<DespesasQuery>) =>
    apiGet(
      `/parlamentares/${encodeURIComponent(id)}/despesas${montarQuery(query)}`,
      paginatedSchema(despesaSchema),
      UMA_HORA,
    ),

  gastosMensais: (id: string, ano?: number) =>
    apiGet(
      `/parlamentares/${encodeURIComponent(id)}/gastos-mensais${montarQuery({ ano })}`,
      z.array(gastoMensalSchema),
      UMA_HORA,
    ),

  syncStatus: () => apiGet('/meta/sync', syncStatusSchema, CINCO_MINUTOS),
};
