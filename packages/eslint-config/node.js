import globals from 'globals';
import tseslint from 'typescript-eslint';
import { base } from './base.js';

/**
 * Configuração para apps Node (NestJS) e bibliotecas.
 * @param {string} tsconfigRootDir
 */
export function node(tsconfigRootDir) {
  return tseslint.config(...base(tsconfigRootDir), {
    languageOptions: { globals: globals.node },
    rules: {
      // NestJS injeta dependências via metadata de tipos: o import precisa ser de valor.
      '@typescript-eslint/consistent-type-imports': 'off',
      // Classes de módulo do Nest são vazias por design.
      '@typescript-eslint/no-extraneous-class': 'off',
    },
  });
}
