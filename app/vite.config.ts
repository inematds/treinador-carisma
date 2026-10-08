import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  build: { outDir: '../treinar', emptyOutDir: true, chunkSizeWarningLimit: 900 },
  server: { fs: { allow: ['..'] }, proxy: { '/api': 'http://127.0.0.1:8787' } },
  test: { environment: 'node', include: ['src/**/*.test.ts'] },
});
