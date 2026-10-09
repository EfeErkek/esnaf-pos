import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import path from 'path';

export default defineConfig({
  plugins: [react()],
  base: './',
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'src'),
    },
  },
  optimizeDeps: {
    exclude: ['sql.js'],
  },
  build: {
    outDir: 'dist',
    rollupOptions: {
      external: ['electron'],
    },
  },
  server: {
    port: 5173,
  },
});
