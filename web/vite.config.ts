import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// 开发时把接口和扩展资源转发给 Go 服务（127.0.0.1:8730）。
export default defineConfig({
  base: '/',
  plugins: [react()],
  server: {
    host: '127.0.0.1',
    port: 5173,
    strictPort: true,
    proxy: {
      '/api': { target: 'http://127.0.0.1:8730', changeOrigin: true },
      '/ext': { target: 'http://127.0.0.1:8730', changeOrigin: true },
    },
  },
  preview: { host: '127.0.0.1', port: 4173 },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'es2020',
  },
});
