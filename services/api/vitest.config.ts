import { defineConfig } from 'vitest/config';

/**
 * Integration tests run against a dedicated database so a failed run can never
 * corrupt development or demo data, and so the suite can truncate freely.
 */
export default defineConfig({
  test: {
    include: ['src/**/*.test.ts'],
    reporters: ['verbose'],
    globalSetup: ['./src/test/global-setup.ts'],
    setupFiles: ['./src/test/setup.ts'],
    fileParallelism: false,
  },
});
