import { defineConfig } from 'vitest/config';
import { loadEnv } from 'vite';

// Load backend/.env into process.env before any test imports config.ts.
//
// Vitest does not read .env on its own, and the Prisma CLI does, which is why
// `prisma migrate deploy` would succeed while every database-backed test failed
// with "Environment variable not found: DATABASE_URL". The empty prefix returns
// every key rather than only VITE_-prefixed ones.
//
// Real environment wins: a value already exported in the shell (CI, or a one-off
// DATABASE_URL pointing at a scratch database) is not overwritten by the file.
const fileEnv: Record<string, string> = loadEnv('test', process.cwd(), '');
for (const [key, value] of Object.entries(fileEnv)) {
  if (process.env[key] === undefined) {
    process.env[key] = value;
  }
}

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['src/**/*.test.ts'],
    setupFiles: ['src/test/setup.ts'],
    testTimeout: 30000,
  },
});
