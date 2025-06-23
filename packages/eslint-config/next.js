import baseConfig from './base.js';
import nextPlugin from '@next/eslint-plugin-next';

/** @type {import('eslint').Linter.Config[]} */
export default [
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    plugins: {
      '@next/next': nextPlugin,
    },
    rules: {
      ...nextPlugin.configs.recommended.rules,
      '@next/next/no-html-link-for-pages': 'off', // app routerで不要
      '@next/next/no-img-element': 'error',
      '@next/next/no-page-custom-font': 'warn',
    },
  },
  {
    files: ['**/*.tsx'],
    rules: {
      // React専用ルール
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
];
