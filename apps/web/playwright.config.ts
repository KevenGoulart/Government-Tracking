import { defineConfig, devices } from '@playwright/test';

const CI = Boolean(process.env.CI);
const PORTA_WEB = 3100;
const PORTA_API = 3101;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: `http://localhost:${PORTA_WEB}`,
    locale: 'pt-BR',
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: [
    {
      command: 'node e2e/mock-api.ts',
      url: `http://localhost:${PORTA_API}/meta/sync`,
      env: { MOCK_API_PORT: String(PORTA_API) },
      reuseExistingServer: !CI,
    },
    {
      // Em CI o build já foi feito pelo pipeline; localmente usa o servidor de desenvolvimento.
      command: CI
        ? `pnpm exec next start --port ${PORTA_WEB}`
        : `pnpm exec next dev --port ${PORTA_WEB}`,
      url: `http://localhost:${PORTA_WEB}`,
      env: { API_URL: `http://localhost:${PORTA_API}` },
      reuseExistingServer: !CI,
      timeout: 120_000,
    },
  ],
});
