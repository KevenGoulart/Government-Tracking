import { parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseEnv (worker)', () => {
  it('converte a lista de anos e os booleanos', () => {
    const env = parseEnv({
      ...valid,
      SYNC_INITIAL_YEARS: '2025, 2026',
      SYNC_CRON_ENABLED: 'false',
    });
    expect(env.SYNC_INITIAL_YEARS).toEqual([2025, 2026]);
    expect(env.SYNC_CRON_ENABLED).toBe(false);
  });

  it('aplica padrões da API da Câmara', () => {
    const env = parseEnv(valid);
    expect(env.CAMARA_API_BASE_URL).toBe('https://dadosabertos.camara.leg.br/api/v2');
    expect(env.CAMARA_LEGISLATURA).toBe(57);
  });

  it.each(['2025,abc', '1990', ''])('rejeita anos inválidos: "%s"', (years) => {
    expect(() => parseEnv({ ...valid, SYNC_INITIAL_YEARS: years })).toThrow(/SYNC_INITIAL_YEARS/);
  });
});
