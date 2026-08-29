import tseslint from 'typescript-eslint';

export default [
  { ignores: ['**/node_modules/**', '**/.next/**', '**/dist/**'] },
  ...tseslint.configs.recommended,
];
