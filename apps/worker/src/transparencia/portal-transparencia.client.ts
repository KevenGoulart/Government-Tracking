import { z } from 'zod';
import type { HttpClient } from '../comum/http-client';

export const emendaPortalSchema = z.object({
  codigoEmenda: z.string(),
  ano: z.number().int(),
  tipoEmenda: z.string(),
  nomeAutor: z.string(),
  numeroEmenda: z.string().nullable().optional(),
  localidadeDoGasto: z.string().nullable().optional(),
  funcao: z.string().nullable().optional(),
  subfuncao: z.string().nullable().optional(),
  valorEmpenhado: z.string(),
  valorLiquidado: z.string(),
  valorPago: z.string(),
  valorRestoInscrito: z.string(),
  valorRestoCancelado: z.string(),
  valorRestoPago: z.string(),
});
export type EmendaPortal = z.infer<typeof emendaPortalSchema>;

/** Proteção contra laço infinito caso a API nunca devolva uma página vazia. */
const MAX_PAGINAS = 3_000;

/**
 * Cliente do Portal da Transparência (CGU): https://api.portaldatransparencia.gov.br/swagger-ui
 * A chave vai no cabeçalho `chave-api-dados`, configurado no HttpClient.
 */
export class PortalTransparenciaClient {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
  ) {}

  /** Percorre todas as páginas de emendas do ano (a API devolve 15 por página). */
  async *listarEmendas(ano: number): AsyncGenerator<EmendaPortal[]> {
    for (let pagina = 1; pagina <= MAX_PAGINAS; pagina++) {
      const itens = await this.http.getJson(
        `${this.baseUrl}/emendas?ano=${ano}&pagina=${pagina}`,
        z.array(emendaPortalSchema),
      );
      if (itens.length === 0) return;
      yield itens;
    }
    throw new Error(`Emendas de ${ano}: mais de ${MAX_PAGINAS} páginas, interrompido`);
  }
}
