module.exports = {
  root: true,
  parser: '@typescript-eslint/parser',
  parserOptions: {
    project: 'tsconfig.json',
    tsconfigRootDir: __dirname,
    sourceType: 'module',
  },
  plugins: ['@typescript-eslint/eslint-plugin', 'prettier'],
  extends: [
    'plugin:@typescript-eslint/recommended',
    'plugin:prettier/recommended',
  ],
  env: { node: true, es2022: true },
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    '@typescript-eslint/explicit-function-return-type': 'off',
    '@typescript-eslint/explicit-module-boundary-types': 'off',
    '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    '@typescript-eslint/no-non-null-assertion': 'warn',
    'no-console': ['warn', { allow: ['warn', 'error'] }],
    'prettier/prettier': 'error',
  },
  ignorePatterns: ['dist/', 'node_modules/', '*.config.ts', '*.config.cjs'],
  overrides: [
    {
      // Constitution Principle V — matching engine purity boundary.
      // src/matching/** must NOT depend on NestJS DI, HTTP, controllers, repositories,
      // applications/, or any I/O-bound module. Pure functions + types only.
      files: ['src/matching/**/*.ts'],
      excludedFiles: ['src/matching/matching.module.ts', 'src/matching/engine.service.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              { group: ['@nestjs/*'], message: 'Engine must be DI-free (Principle V).' },
              { group: ['express', 'express/*'], message: 'No HTTP in engine.' },
              {
                group: ['@/applications', '@/applications/*', '../applications', '../applications/*'],
                message: 'Engine cannot depend on applications (would create a cycle).',
              },
              {
                group: ['@/audit', '@/audit/*', '../audit', '../audit/*'],
                message: 'Engine must not write audit events directly.',
              },
              {
                group: ['@/infra', '@/infra/*', '../infra', '../infra/*'],
                message: 'Engine must not touch infra (Prisma/Redis/HIBP).',
              },
            ],
            paths: [
              {
                name: '@prisma/client',
                message:
                  'Engine must import Decimal from "@prisma/client/runtime/library" (type-only), not the Prisma runtime.',
              },
            ],
          },
        ],
      },
    },
    {
      // Engine entry point (matching.module.ts + engine.service.ts) is allowed @nestjs/common only.
      files: ['src/matching/engine.service.ts', 'src/matching/matching.module.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            patterns: [
              {
                group: ['@/applications', '@/applications/*', '../applications', '../applications/*'],
                message: 'Engine cannot depend on applications.',
              },
              {
                group: ['@/audit', '@/audit/*', '../audit', '../audit/*'],
                message: 'Engine must not emit audit events directly.',
              },
              {
                group: ['@/infra', '@/infra/*', '../infra', '../infra/*'],
                message: 'Engine must not touch infra.',
              },
            ],
            paths: [
              {
                name: '@prisma/client',
                message:
                  'Engine must import Decimal from "@prisma/client/runtime/library", not the Prisma runtime namespace.',
              },
            ],
          },
        ],
      },
    },
  ],
};
