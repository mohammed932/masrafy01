import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

/**
 * Vitest over Jest: the repo already runs TypeScript through `tsx`/esbuild,
 * so there is no `ts-jest` transform to maintain.
 */
export default defineConfig({
  test: {
    include: ['test/**/*.spec.ts'],
    environment: 'node',
    globals: true,
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
    },
  },
  resolve: {
    alias: {
      // mirrors compilerOptions.paths in tsconfig.json
      '@': resolve(__dirname, 'src'),
    },
  },
});
