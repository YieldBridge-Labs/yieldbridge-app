import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    environment: 'jsdom',
    pool: 'forks',
  },
  resolve: {
    alias: {
      '@yieldbridge/sdk': path.resolve(__dirname, '../../packages/sdk/src/index.ts'),
    },
  },
});
