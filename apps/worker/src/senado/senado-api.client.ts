import { z } from 'zod';
import type { HttpClient } from '../comum/http-client';

/**
 * A API do Senado converte XML em JSON: listas com um único item chegam como objeto.
 * Este helper aceita os dois formatos e sempre devolve array.
 */
function lista<T extends z.ZodType>(item: T) {
  return z
    .union([z.array(item), item])
    .transform((v) => (Array.isArray(v) ? v : [v]) as z.infer<T>[]);
}

const identificacaoSchema = z.object({
  CodigoParlamentar: z.string(),
  NomeParlamentar: z.string(),
  NomeCompletoParlamentar: z.string().optional(),
  UrlFotoParlamentar: z.string().optional(),
  EmailParlamentar: z.string().optional(),
  SiglaPartidoParlamentar: z.string().optional(),
  UfParlamentar: z.string().optional(),
});

const mandatoSchema = z.object({ UfParlamentar: z.string().optional() });

const legislaturaSchema = z.object({
  ListaParlamentarLegislatura: z.object({
    Parlamentares: z.object({
      Parlamentar: lista(
        z.object({
          IdentificacaoParlamentar: identificacaoSchema,
          Mandatos: z.object({ Mandato: lista(mandatoSchema) }).optional(),
        }),
      ),
    }),
  }),
});

const emExercicioSchema = z.object({
  ListaParlamentarEmExercicio: z.object({
    Parlamentares: z.object({
      Parlamentar: lista(z.object({ IdentificacaoParlamentar: identificacaoSchema })),
    }),
  }),
});

const detalheSchema = z.object({
  DetalheParlamentar: z.object({
    Parlamentar: z.object({ IdentificacaoParlamentar: identificacaoSchema }),
  }),
});

export interface Senador {
  codigo: string;
  nome: string;
  nomeCompleto: string | null;
  partido: string | null;
  uf: string | null;
  fotoUrl: string | null;
  email: string | null;
}

/**
 * A API informa a foto como http://www.senado.leg.br/.../senador{codigo}.jpg, que redireciona
 * (301) para o endereço abaixo. Gravamos o destino final, em HTTPS, para não depender do
 * redirecionamento ao exibir a imagem.
 */
function fotoOficial(codigo: string, url: string | undefined): string | null {
  return url ? `https://legis.senado.leg.br/senadores/fotos-oficiais/${codigo}` : null;
}

function paraSenador(id: z.infer<typeof identificacaoSchema>, ufMandato?: string): Senador {
  return {
    codigo: id.CodigoParlamentar,
    nome: id.NomeParlamentar,
    nomeCompleto: id.NomeCompletoParlamentar ?? null,
    partido: id.SiglaPartidoParlamentar ?? null,
    uf: id.UfParlamentar ?? ufMandato ?? null,
    fotoUrl: fotoOficial(id.CodigoParlamentar, id.UrlFotoParlamentar),
    email: id.EmailParlamentar ?? null,
  };
}

/** Cliente da API de Dados Abertos do Senado (https://legis.senado.leg.br/dadosabertos). */
export class SenadoApiClient {
  constructor(
    private readonly http: HttpClient,
    private readonly baseUrl: string,
  ) {}

  /** Todos os que tiveram mandato na legislatura (titulares e suplentes). Não traz partido. */
  async listarDaLegislatura(legislatura: number): Promise<Senador[]> {
    const res = await this.http.getJson(
      `${this.baseUrl}/senador/lista/legislatura/${legislatura}`,
      legislaturaSchema,
    );
    return res.ListaParlamentarLegislatura.Parlamentares.Parlamentar.map((p) =>
      paraSenador(p.IdentificacaoParlamentar, p.Mandatos?.Mandato[0]?.UfParlamentar),
    );
  }

  async listarEmExercicio(): Promise<Senador[]> {
    const res = await this.http.getJson(`${this.baseUrl}/senador/lista/atual`, emExercicioSchema);
    return res.ListaParlamentarEmExercicio.Parlamentares.Parlamentar.map((p) =>
      paraSenador(p.IdentificacaoParlamentar),
    );
  }

  async obterSenador(codigo: string): Promise<Senador> {
    const res = await this.http.getJson(`${this.baseUrl}/senador/${codigo}`, detalheSchema);
    return paraSenador(res.DetalheParlamentar.Parlamentar.IdentificacaoParlamentar);
  }
}
