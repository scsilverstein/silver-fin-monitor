import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'url'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  server: {
    port: 5173,
    // Disable caching in development
    headers: {
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache',
      'Expires': '0'
    },
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: true,
        secure: false,
        // Disable proxy caching
        configure: (proxy, _options) => {
          proxy.on('proxyRes', (proxyRes, req, res) => {
            proxyRes.headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
            proxyRes.headers['Pragma'] = 'no-cache';
            proxyRes.headers['Expires'] = '0';
          });
        }
      },
    },
  },
})