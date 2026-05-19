import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    testTimeout: 30000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html', 'json-summary'],
      reportsDirectory: './coverage',
      include: ['src/**/*.ts'],
      exclude: [
        'src/**/*.test.ts',
        'src/**/schemas.ts',
        'src/**/routes.ts',
        'src/server.ts',
        'src/config.ts',
      ],
      // Soft thresholds — fail CI only if we regress on currently-covered code.
      // Bump these as more modules get tests.
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 60,
        statements: 50,
      },
    },
  },
});
