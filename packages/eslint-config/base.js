import js from '@eslint/js';
import prettier from 'eslint-config-prettier';
import tseslint from 'typescript-eslint';

/**
 * Configuração base: TypeScript com regras type-aware e proibição de `any`.
 * @param {string} tsconfigRootDir diretório do pacote que usa a config
 */
export function base(tsconfigRootDir) {
  return tseslint.config(
    {
      ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/generated/**', '**/*.config.*'],
    },
    js.configs.recommended,
    ...tseslint.configs.recommendedTypeChecked,
    {
      languageOptions: {
        parserOptions: {
          projectService: true,
          tsconfigRootDir,
        },
      },
      rules: {
        '@typescript-eslint/no-explicit-any': 'error',
        '@typescript-eslint/consistent-type-imports': [
          'error',
          { fixStyle: 'inline-type-imports' },
        ],
        '@typescript-eslint/no-unused-vars': [
          'error',
          { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
        ],
        eqeqeq: ['error', 'always'],
        'no-console': ['warn', { allow: ['warn', 'error'] }],
      },
    },
    prettier,
  );
}
