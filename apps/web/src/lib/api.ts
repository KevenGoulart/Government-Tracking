import 'server-only';
import {
  type Categoria,
  categoriaSchema,
  comparacaoSchema,
  estatisticasSchema,
  fornecedorDetalheSchema,
  type RankingQuery,
  rankingSchema,
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

/**
 * Versão do código. O Next inclui os cabeçalhos na chave do cache de dados, então cada
 * deploy usa entradas novas e nunca lê respostas gravadas no formato anterior.
 */
const VERSAO_APP = process.env.APP_VERSION || process.env.VERCEL_GIT_COMMIT_SHA || 'dev';

async function buscar(path: string, init: RequestInit): Promise<unknown> {
  const res = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: { Accept: 'application/json', 'X-App-Version': VERSAO_APP },
  });
  if (!res.ok) throw new ApiError(res.status, path);
  return res.json();
}

async function apiGet<T extends z.ZodType>(
  path: string,
  schema: T,
  revalidate: number,
): Promise<z.infer<T>> {
  // Valida o contrato: uma mudança na API quebra aqui, com erro claro, e não na renderização.
  const resultado = schema.safeParse(await buscar(path, { next: { revalidate } }));
  if (resultado.success) return resultado.data;

  // A resposta pode ter vindo do cache em um formato antigo (ex.: em desenvolvimento,
  // após mudar a API). Busca direto na fonte antes de considerar erro de contrato.
  return schema.parse(await buscar(path, { cache: 'no-store' }));
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

  estatisticas: (ano?: number) =>
    apiGet(`/estatisticas${montarQuery({ ano })}`, estatisticasSchema, UMA_HORA),

  ranking: (query: Partial<RankingQuery>) =>
    apiGet(`/rankings${montarQuery(query)}`, rankingSchema, UMA_HORA),

  fornecedor: (identificador: string, ano?: number) =>
    apiGet(
      `/fornecedores/${encodeURIComponent(identificador)}${montarQuery({ ano })}`,
      fornecedorDetalheSchema,
      UMA_HORA,
    ),

  comparacao: (ids: string[], ano?: number) =>
    apiGet(`/comparacao${montarQuery({ ids: ids.join(','), ano })}`, comparacaoSchema, UMA_HORA),
};
