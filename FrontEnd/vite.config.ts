import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Activado por el script start-tunnel.ps1 (VITE_TUNNEL=1). Cuando se sirve
// a través de ngrok (HTTPS) el HMR debe conectarse por wss al puerto 443.
const isTunnel = process.env.VITE_TUNNEL === '1' || process.env.VITE_TUNNEL === 'true'

// Rutas que deben reenviarse al backend Django (localhost:8000) en vez de
// ser resueltas por Vite. Así el frontend usa rutas relativas (mismo origen)
// y un único túnel de ngrok expone frontend + API juntos, sin CORS.
const backendProxy = {
  target: 'http://localhost:8000', // para ambiente docker ; substituir localhost por backend
  changeOrigin: true,
}

export default defineConfig({
  server: {
    host: true,
    port: 5173,
    strictPort: true,
    // Permite que ngrok (host dinámico *.ngrok-free.app) acceda al dev server.
    allowedHosts: true,
    proxy: {
      '/comercial': backendProxy,
      '/token': backendProxy,
      '/media': backendProxy,
      '/admin': backendProxy,
    },
    ...(isTunnel ? { hmr: { protocol: 'wss', clientPort: 443 } } : {}),
  },
  plugins: [
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
})
