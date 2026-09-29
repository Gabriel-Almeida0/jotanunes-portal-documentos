/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// `base: './'` permite servir o app em qualquer caminho (ex.: dentro do Fluig) — o roteamento é por hash.
export default defineConfig({
  plugins: [react()],
  base: './',
  server: { port: 5173, strictPort: true },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
    restoreMocks: true,
  },
});
