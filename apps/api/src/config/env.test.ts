import { parseEnv } from './env';

const valid = {
  DATABASE_URL: 'postgresql://u:p@localhost:5432/db',
  REDIS_URL: 'redis://localhost:6379',
};

describe('parseEnv', () => {
  it('aplica padrões e converte a porta', () => {
    const env = parseEnv({ ...valid, API_PORT: '4000' });
    expect(env.API_PORT).toBe(4000);
    expect(env.NODE_ENV).toBe('development');
  });

  it('falha com mensagem legível quando falta variável obrigatória', () => {
    expect(() => parseEnv({ REDIS_URL: valid.REDIS_URL })).toThrow(/DATABASE_URL/);
  });
});
