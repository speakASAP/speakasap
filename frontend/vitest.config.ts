import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    setupFiles: ['./vitest.setup.ts'],
    globals: true,
    include: ['{app,lib}/**/*.test.{ts,tsx}'],
    // `lib/gateway.ts` reads NEXT_PUBLIC_API_URL at module load, so any test of a client
    // built on it needs a base URL present before the first import. Pinning it here keeps
    // the suite independent of the developer's shell.
    env: { NEXT_PUBLIC_API_URL: 'https://api.test' },
  },
  resolve: { alias: { '@': resolve(__dirname, '.') } },
});
