import { resolve } from 'node:path';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    include: ['tests/**/*.spec.ts'],
    environment: 'jsdom',
    globals: true,
    passWithNoTests: true,
  },
  resolve: {
    alias: {
      // mirrors compilerOptions.paths in tsconfig.json
      '@core': resolve(__dirname, 'src/app/core'),
      '@features': resolve(__dirname, 'src/app/features'),
      '@shared': resolve(__dirname, 'src/app/shared'),
    },
  },
});
