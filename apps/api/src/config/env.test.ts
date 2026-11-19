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

  it('trata APP_VERSION vazia como ausente', () => {
    expect(parseEnv({ ...valid, APP_VERSION: '' }).APP_VERSION).toBeUndefined();
    expect(parseEnv({ ...valid, APP_VERSION: 'abc' }).APP_VERSION).toBe('abc');
  });

  it('usa PORT e o commit da plataforma quando as variáveis do projeto faltam', () => {
    const env = parseEnv({ ...valid, PORT: '10000', RENDER_GIT_COMMIT: 'a1b2c3' });
    expect(env).toMatchObject({ API_PORT: 10000, APP_VERSION: 'a1b2c3' });
    expect(parseEnv({ ...valid, PORT: '10000', API_PORT: '4000' }).API_PORT).toBe(4000);
  });

  it('falha com mensagem legível quando falta variável obrigatória', () => {
    expect(() => parseEnv({ REDIS_URL: valid.REDIS_URL })).toThrow(/DATABASE_URL/);
  });
});
