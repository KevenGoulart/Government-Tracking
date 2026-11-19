import { z } from 'zod';
import type { HttpClient } from './http-client';

const linksSchema = z.array(z.object({ rel: z.string(), href: z.string() }));

export const deputadoListaSchema = z.object({
  id: z.number().int(),
  nome: z.string(),
  siglaPartido: z.string().nullable(),
  siglaUf: z.string().nullable(),
  urlFoto: z.string().nullable(),
  email: z.string().nullable(),
  idLegislatura: z.number().int(),
});
export type DeputadoLista = z.infer<typeof deputadoListaSchema>;

const listaDeputadosSchema = z.object({
  dados: z.array(deputadoListaSchema),
  links: linksSchema,
});

export const deputadoDetalheSchema = z.object({
  id: z.number().int(),
  nomeCivil: z.string().nullable(),
  ultimoStatus: z.object({
    nome: z.string(),
    siglaPartido: z.string().nullable(),
    siglaUf: z.string().nullable(),
    urlFoto: z.string().nullable(),
    email: z.string().nullable(),
    situacao: z.string().nullable(),
  }),
});
export type DeputadoDetalhe = z.infer<typeof deputadoDetalheSchema>;

const detalheDeputadoSchema = z.object({ dados: deputadoDetalheSchema });

/** Cliente da API de Dados Abertos da Câmara (https://dadosabertos.camara.leg.br/swagger/api.html). */
export class CamaraApiClient {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
  ) {}

  /**
   * Lista deputados percorrendo todas as páginas pelo link "next".
   * Sem `idLegislatura`, a API retorna apenas os deputados em exercício.
   */
  async listarDeputados(filtro: { idLegislatura?: number } = {}): Promise<DeputadoLista[]> {
    const params = new URLSearchParams({ itens: '100', ordem: 'ASC', ordenarPor: 'nome' });
    if (filtro.idLegislatura) params.set('idLegislatura', String(filtro.idLegislatura));

    const deputados: DeputadoLista[] = [];
    let url: string | undefined = `${this.baseUrl}/deputados?${params.toString()}`;
    while (url) {
      const pagina: z.infer<typeof listaDeputadosSchema> = await this.http.getJson(
        url,
        listaDeputadosSchema,
      );
      deputados.push(...pagina.dados);
      url = pagina.links.find((link) => link.rel === 'next')?.href;
    }
    return deputados;
  }

  async obterDeputado(id: number): Promise<DeputadoDetalhe> {
    const res = await this.http.getJson(`${this.baseUrl}/deputados/${id}`, detalheDeputadoSchema);
    return res.dados;
  }
}
