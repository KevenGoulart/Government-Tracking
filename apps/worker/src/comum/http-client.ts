import type { z } from 'zod';

export class HttpError extends Error {
  constructor(
    readonly status: number,
    readonly url: string,
  ) {
    super(`HTTP ${status} ao acessar ${url}`);
    this.name = 'HttpError';
  }
}

export interface HttpClientOptions {
  userAgent: string;
  /** Limite de requisições por segundo (aplicado entre todas as chamadas do cliente). */
  requestsPerSecond: number;
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  timeoutMs?: number;
  // Dependências injetáveis para testes
  fetch?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  now?: () => number;
  random?: () => number;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/**
 * Cliente HTTP para fontes públicas: limita a taxa de requisições, aplica timeout e
 * repete falhas transitórias (rede, 429 e 5xx) com backoff exponencial e jitter,
 * respeitando o cabeçalho Retry-After quando presente.
 */
export class HttpClient {
  private readonly fetchFn: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly now: () => number;
  private readonly random: () => number;
  private readonly maxRetries: number;
  private readonly baseDelayMs: number;
  private readonly maxDelayMs: number;
  private readonly timeoutMs: number;
  private readonly intervalMs: number;
  private nextSlot = 0;

  constructor(private readonly options: HttpClientOptions) {
    this.fetchFn = options.fetch ?? fetch;
    this.sleep = options.sleep ?? defaultSleep;
    this.now = options.now ?? Date.now;
    this.random = options.random ?? Math.random;
    this.maxRetries = options.maxRetries ?? 4;
    this.baseDelayMs = options.baseDelayMs ?? 1_000;
    this.maxDelayMs = options.maxDelayMs ?? 30_000;
    this.timeoutMs = options.timeoutMs ?? 60_000;
    this.intervalMs = 1_000 / options.requestsPerSecond;
  }

  async getJson<T extends z.ZodType>(url: string, schema: T): Promise<z.infer<T>> {
    const res = await this.request(url, 'application/json');
    return schema.parse(await res.json());
  }

  async getBytes(url: string): Promise<Uint8Array> {
    const res = await this.request(url, '*/*');
    return new Uint8Array(await res.arrayBuffer());
  }

  private async request(url: string, accept: string): Promise<Response> {
    for (let attempt = 0; ; attempt++) {
      await this.throttle();
      let res: Response;
      try {
        res = await this.fetchFn(url, {
          headers: { Accept: accept, 'User-Agent': this.options.userAgent },
          signal: AbortSignal.timeout(this.timeoutMs),
        });
      } catch (error) {
        // Falha de rede ou timeout
        if (attempt >= this.maxRetries) throw error;
        await this.sleep(this.backoff(attempt));
        continue;
      }

      if (res.ok) return res;

      const transitorio = res.status === 429 || res.status >= 500;
      if (!transitorio || attempt >= this.maxRetries) throw new HttpError(res.status, url);

      await res.body?.cancel();
      const retryAfter = parseRetryAfter(res.headers.get('retry-after'), this.now());
      await this.sleep(Math.min(this.maxDelayMs, retryAfter ?? this.backoff(attempt)));
    }
  }

  /** Reserva o próximo "slot" de envio respeitando o intervalo mínimo entre requisições. */
  private async throttle(): Promise<void> {
    const now = this.now();
    const wait = Math.max(0, this.nextSlot - now);
    this.nextSlot = Math.max(now, this.nextSlot) + this.intervalMs;
    if (wait > 0) await this.sleep(wait);
  }

  private backoff(attempt: number): number {
    const exponencial = Math.min(this.maxDelayMs, this.baseDelayMs * 2 ** attempt);
    return Math.round(exponencial * (0.5 + this.random() / 2));
  }
}

/** Retry-After pode vir em segundos ("30") ou como data HTTP. */
export function parseRetryAfter(value: string | null, now: number): number | undefined {
  if (!value) return undefined;
  const segundos = Number(value);
  if (Number.isFinite(segundos)) return Math.max(0, segundos * 1_000);
  const data = Date.parse(value);
  return Number.isNaN(data) ? undefined : Math.max(0, data - now);
}
