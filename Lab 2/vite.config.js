import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      '/api/identity': {
        target: 'https://cloud-identity.uitiot.vn',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/identity/, '')
      },
      '/api/compute': {
        target: 'https://cloud-compute.uitiot.vn',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/compute/, '')
      },
      '/api/network': {
        target: 'https://cloud-network.uitiot.vn',
        changeOrigin: true,
        secure: true,
        rewrite: (path) => path.replace(/^\/api\/network/, '')
      }
    }
  }
});
