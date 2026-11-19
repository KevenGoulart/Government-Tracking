import { z } from 'zod';
import { HttpClient, HttpError, parseRetryAfter } from './http-client';

function resposta(status: number, body: unknown = {}, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers });
}

function criarCliente(respostas: Array<Response | Error>, extra: { now?: () => number } = {}) {
  const fila = [...respostas];
  const fetchMock = vi.fn(() => {
    const proxima = fila.shift();
    if (!proxima) throw new Error('sem respostas configuradas');
    return proxima instanceof Error ? Promise.reject(proxima) : Promise.resolve(proxima);
  });
  const sleep = vi.fn((_ms: number) => Promise.resolve());
  const client = new HttpClient({
    userAgent: 'teste',
    requestsPerSecond: 1_000,
    baseDelayMs: 100,
    maxRetries: 3,
    fetch: fetchMock,
    sleep,
    random: () => 1,
    now: extra.now ?? (() => 0),
  });
  return { client, fetchMock, sleep };
}

const schema = z.object({ ok: z.boolean() });

describe('HttpClient', () => {
  it('retorna o JSON validado pelo schema', async () => {
    const { client } = criarCliente([resposta(200, { ok: true, extra: 1 })]);
    await expect(client.getJson('http://x', schema)).resolves.toEqual({ ok: true });
  });

  it('repete 5xx com backoff exponencial e depois sucede', async () => {
    const { client, fetchMock, sleep } = criarCliente([
      resposta(503),
      resposta(502),
      resposta(200, { ok: true }),
    ]);
    await expect(client.getJson('http://x', schema)).resolves.toEqual({ ok: true });
    expect(fetchMock).toHaveBeenCalledTimes(3);
    // Ignora as pausas curtas do limitador de taxa (relógio parado no teste)
    expect(sleep.mock.calls.map(([ms]) => ms).filter((ms) => ms >= 100)).toEqual([100, 200]);
  });

  it('respeita o Retry-After em respostas 429', async () => {
    const { client, sleep } = criarCliente([
      resposta(429, {}, { 'retry-after': '2' }),
      resposta(200, { ok: true }),
    ]);
    await client.getJson('http://x', schema);
    expect(sleep).toHaveBeenCalledWith(2_000);
  });

  it('repete falhas de rede', async () => {
    const { client, fetchMock } = criarCliente([
      new TypeError('fetch failed'),
      resposta(200, { ok: true }),
    ]);
    await client.getJson('http://x', schema);
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('não repete erros 4xx (exceto 429)', async () => {
    const { client, fetchMock } = criarCliente([resposta(404)]);
    await expect(client.getJson('http://x', schema)).rejects.toBeInstanceOf(HttpError);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('desiste após o número máximo de tentativas', async () => {
    const { client, fetchMock } = criarCliente([
      resposta(500),
      resposta(500),
      resposta(500),
      resposta(500),
    ]);
    await expect(client.getJson('http://x', schema)).rejects.toMatchObject({ status: 500 });
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it('falha quando a resposta não segue o schema', async () => {
    const { client } = criarCliente([resposta(200, { ok: 'sim' })]);
    await expect(client.getJson('http://x', schema)).rejects.toThrow();
  });

  it('espaça as requisições conforme o limite por segundo', async () => {
    const sleep = vi.fn((_ms: number) => Promise.resolve());
    const client = new HttpClient({
      userAgent: 'teste',
      requestsPerSecond: 2,
      fetch: () => Promise.resolve(resposta(200, { ok: true })),
      sleep,
      now: () => 0, // relógio parado: cada chamada precisa esperar o slot seguinte
    });
    await client.getJson('http://x', schema);
    await client.getJson('http://x', schema);
    await client.getJson('http://x', schema);
    expect(sleep.mock.calls.map(([ms]) => ms)).toEqual([500, 1_000]);
  });
});

describe('HttpClient (cabeçalhos)', () => {
  it('envia cabeçalhos extras configurados', async () => {
    const fetchMock = vi.fn((_url: string, _init?: RequestInit) =>
      Promise.resolve(resposta(200, { ok: true })),
    );
    const client = new HttpClient({
      userAgent: 'teste',
      requestsPerSecond: 1_000,
      headers: { 'chave-api-dados': 'segredo' },
      fetch: fetchMock as unknown as typeof fetch,
      sleep: () => Promise.resolve(),
    });
    await client.getJson('http://x', schema);
    expect(fetchMock.mock.calls[0]?.[1]?.headers).toMatchObject({
      'chave-api-dados': 'segredo',
      'User-Agent': 'teste',
    });
  });
});

describe('parseRetryAfter', () => {
  it('interpreta segundos e datas HTTP', () => {
    expect(parseRetryAfter('30', 0)).toBe(30_000);
    expect(parseRetryAfter(new Date(5_000).toUTCString(), 0)).toBe(5_000);
    expect(parseRetryAfter(null, 0)).toBeUndefined();
    expect(parseRetryAfter('amanhã', 0)).toBeUndefined();
  });
});
