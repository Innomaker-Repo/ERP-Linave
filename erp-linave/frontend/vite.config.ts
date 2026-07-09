import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

const isTunnel = process.env.VITE_TUNNEL === '1' || process.env.VITE_TUNNEL === 'true'

const backendProxy = {
  target: 'http://backend:8000',
  changeOrigin: true,
}

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    allowedHosts: true,
    proxy: {
      '/comercial': backendProxy,
      '/token': backendProxy,
      '/media': backendProxy,
      '/jamanta-fiscal': backendProxy,
    },
    ...(isTunnel ? { hmr: { protocol: 'wss', clientPort: 443 } } : {}),
  },
  plugins: [
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },

  assetsInclude: ['**/*.svg', '**/*.csv'],
})
