import js from '@eslint/js';
import globals from 'globals';
import reactHooks from 'eslint-plugin-react-hooks';
import tseslint from 'typescript-eslint';

// Kiến trúc được ép bằng lint (SPEC 5.3, 6):
// - domain/ là logic thuần: không React, không DB, không audio.
// - Chỉ db/ được đụng tới Dexie. UI đi qua repositories.
export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'mockup', 'coverage', 'playwright-report'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      'no-restricted-imports': [
        'error',
        { paths: [{ name: 'dexie', message: 'Chỉ src/db được import Dexie. Dùng repositories.' }, { name: 'dexie-react-hooks', message: 'Dùng hooks trong src/db.' }] },
      ],
    },
  },
  {
    files: ['src/db/**/*.{ts,tsx}'],
    rules: { 'no-restricted-imports': 'off' },
  },
  {
    files: ['src/domain/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            { group: ['react', 'react-dom', 'dexie', 'dexie-react-hooks', 'zustand', 'xstate'], message: 'domain/ phải là logic thuần.' },
            { group: ['@/db/*', '@/audio/*', '@/ui/*', '@/features/*', '@/app/*'], message: 'domain/ không phụ thuộc tầng khác.' },
          ],
        },
      ],
    },
  },
  {
    files: ['*.config.{ts,js}', 'e2e/**/*.ts'],
    languageOptions: { globals: globals.node },
  },
);
