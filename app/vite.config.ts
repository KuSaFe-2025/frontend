import path from 'path';

import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [react(), tsconfigPaths()],

  preview: {
    port: Number(process.env.PORT) || 4173,
    host: '0.0.0.0',

    allowedHosts: [
      'kusafe.ru',
      'web', // ← Добавьте это
    ],
  },

  server: {
    host: true, // или явно '0.0.0.0'
    allowedHosts: ['kusafe.ru', 'web'],
  },

  build: {
    outDir: 'dist',
    emptyOutDir: true,
  },

  css: {
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/shared/styles/variables.scss" as *;`,
      },
    },
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
      '@shared': path.resolve(__dirname, 'src/shared'),
    },
  },
});
