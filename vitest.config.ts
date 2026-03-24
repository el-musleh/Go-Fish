import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['**/*.test.ts', '**/*.property.test.ts'],
    exclude: ['_main_reference/**', 'client/**', '**/node_modules/**'],
    testTimeout: 120000,
  },
});
