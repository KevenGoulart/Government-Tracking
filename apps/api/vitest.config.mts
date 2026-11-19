import swc from 'unplugin-swc';
import { defineConfig } from 'vitest/config';

// SWC preserva os metadados de decorators que a injeção de dependências do Nest exige.
const plugins = [swc.vite({ module: { type: 'es6' } })];

export default defineConfig({
  test: {
    projects: [
      {
        plugins,
        test: { name: 'unit', include: ['src/**/*.test.ts'], globals: true },
      },
      {
        plugins,
        test: {
          name: 'e2e',
          include: ['test/**/*.e2e.test.ts'],
          globals: true,
          setupFiles: ['test/setup-env.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
        },
      },
    ],
  },
});
