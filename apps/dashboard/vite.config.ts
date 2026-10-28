import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@yieldbridge/sdk': path.resolve(__dirname, '../../packages/sdk/src/index.ts'),
    },
  },
  build: {
    target: 'es2022',
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/stellar-sdk')) {
            return 'stellar-sdk';
          }
          if (
            id.includes('node_modules/@stellar/freighter-api') ||
            id.includes('node_modules/@albedo-link')
          ) {
            return 'stellar-wallets';
          }
          if (
            id.includes('node_modules/react') ||
            id.includes('node_modules/react-dom')
          ) {
            return 'react-core';
          }
        },
      },
    },
  },
});