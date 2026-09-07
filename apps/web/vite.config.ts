import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  // GitHub Pages serves a project site from /<repo>/, so assets need that prefix.
  // Local dev and the API-backed build stay at the root.
  base: process.env['VITE_BASE'] ?? '/',
  server: {
    port: 5173,
    proxy: { '/api': { target: 'http://localhost:4000', changeOrigin: true } },
  },
  build: { target: 'es2022', sourcemap: true },
});
