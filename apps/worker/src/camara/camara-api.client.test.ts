import { CamaraApiClient } from './camara-api.client';
import { HttpClient } from './http-client';

const BASE = 'https://camara.test/api/v2';

function deputado(id: number, nome: string) {
  return {
    id,
    uri: `${BASE}/deputados/${id}`,
    nome,
    siglaPartido: 'PT',
    uriPartido: null,
    siglaUf: 'SP',
    idLegislatura: 57,
    urlFoto: `https://www.camara.leg.br/internet/deputado/bandep/${id}.jpg`,
    email: null,
  };
}

function criar(rotas: Record<string, unknown>) {
  const fetchMock = vi.fn((url: string) => {
    const body = rotas[url];
    return Promise.resolve(
      body === undefined
        ? new Response('not found', { status: 404 })
        : new Response(JSON.stringify(body), { status: 200 }),
    );
  });
  const http = new HttpClient({
    userAgent: 'teste',
    requestsPerSecond: 1_000,
    fetch: fetchMock as unknown as typeof fetch,
    sleep: () => Promise.resolve(),
  });
  return { client: new CamaraApiClient(http, BASE), fetchMock };
}

describe('CamaraApiClient', () => {
  it('percorre todas as páginas de deputados', async () => {
    const pagina1 = `${BASE}/deputados?itens=100&ordem=ASC&ordenarPor=nome&idLegislatura=57`;
    const pagina2 = `${BASE}/deputados?itens=100&ordem=ASC&ordenarPor=nome&idLegislatura=57&pagina=2`;
    const { client, fetchMock } = criar({
      [pagina1]: {
        dados: [deputado(1, 'Ana')],
        links: [
          { rel: 'self', href: pagina1 },
          { rel: 'next', href: pagina2 },
        ],
      },
      [pagina2]: { dados: [deputado(2, 'Bruno')], links: [{ rel: 'self', href: pagina2 }] },
    });

    const deputados = await client.listarDeputados({ idLegislatura: 57 });

    expect(deputados.map((d) => d.nome)).toEqual(['Ana', 'Bruno']);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('obtém o detalhe com nome civil e situação', async () => {
    const { client } = criar({
      [`${BASE}/deputados/7`]: {
        dados: {
          id: 7,
          nomeCivil: 'ANA MARIA DA SILVA',
          cpf: '000',
          ultimoStatus: {
            nome: 'Ana',
            siglaPartido: 'PT',
            siglaUf: 'SP',
            urlFoto: null,
            email: 'dep.ana@camara.leg.br',
            situacao: 'Exercício',
          },
        },
      },
    });

    await expect(client.obterDeputado(7)).resolves.toMatchObject({
      nomeCivil: 'ANA MARIA DA SILVA',
      ultimoStatus: { situacao: 'Exercício' },
    });
  });
});
