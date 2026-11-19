import type { Redis } from 'ioredis';
import type { PrismaService } from '../prisma/prisma.service';
import { CacheService } from './cache.service';

function criar(
  redis: Partial<Record<'get' | 'set', ReturnType<typeof vi.fn>>>,
  fim = new Date(1_000),
) {
  const findFirst = vi.fn(() => Promise.resolve({ fim }));
  const prisma = { syncRun: { findFirst } } as unknown as PrismaService;
  const service = new CacheService({ status: 'ready', ...redis } as unknown as Redis, prisma, {
    APP_VERSION: 'abc123',
  });
  return { service, findFirst };
}

describe('CacheService', () => {
  it('retorna o valor salvo sem recalcular', async () => {
    const get = vi.fn(() => Promise.resolve(JSON.stringify({ total: '10.00' })));
    const { service } = criar({ get, set: vi.fn() });
    const calcular = vi.fn();

    await expect(service.obterOuCalcular('x', 60, calcular)).resolves.toEqual({ total: '10.00' });
    expect(calcular).not.toHaveBeenCalled();
    expect(get).toHaveBeenCalledWith('cache:abc123:1000:x');
  });

  it('calcula e salva com TTL quando não há valor', async () => {
    const set = vi.fn(() => Promise.resolve('OK'));
    const { service } = criar({ get: vi.fn(() => Promise.resolve(null)), set });

    await expect(service.obterOuCalcular('x', 60, () => Promise.resolve([1]))).resolves.toEqual([
      1,
    ]);
    expect(set).toHaveBeenCalledWith('cache:abc123:1000:x', '[1]', 'EX', 60);
  });

  it('continua funcionando quando o Redis falha', async () => {
    const falha = vi.fn(() => Promise.reject(new Error('ECONNREFUSED')));
    const { service } = criar({ get: falha, set: falha });

    await expect(service.obterOuCalcular('x', 60, () => Promise.resolve('ok'))).resolves.toBe('ok');
  });

  it('usa a versão dos dados na chave e a memoriza', async () => {
    const get = vi.fn(() => Promise.resolve(null));
    const { service, findFirst } = criar(
      { get, set: vi.fn(() => Promise.resolve('OK')) },
      new Date(42),
    );

    await service.obterOuCalcular('a', 60, () => Promise.resolve(1));
    await service.obterOuCalcular('b', 60, () => Promise.resolve(2));

    expect(get).toHaveBeenLastCalledWith('cache:abc123:42:b');
    expect(findFirst).toHaveBeenCalledTimes(1);
  });
});
