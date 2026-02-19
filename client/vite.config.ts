/// <reference types="vite/client" />
import path from 'path'
import { defineConfig } from 'vite'

import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:5002',
        changeOrigin: true,
        secure: false,
        ws: true, // Enable WebSocket proxying
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req) => {
            // Silent error handling - backend might not be running
            // Proxy only runs in development, so log errors here
            console.error('Proxy error:', err.message);
          });
        },
      },
    },
    hmr: {
      overlay: false, // Disable HMR overlay to prevent browser extension crashes
      clientPort: 5173, // Explicit port for HMR
    },
    watch: {
      // Ignore changes that might trigger extension errors
      ignored: ['**/node_modules/**', '**/.git/**'],
    },
  },
  logLevel: 'info',
  build: {
    // Suppress chunk size warnings
    chunkSizeWarningLimit: 1000,
  },
})
