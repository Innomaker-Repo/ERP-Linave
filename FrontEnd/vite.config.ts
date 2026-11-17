import { defineConfig } from 'vite'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// 'http://backend:8000' é o hostname interno do Docker (nome do serviço no
// docker-compose) — só resolve dentro da rede do container. Rodando o
// backend nativamente (fora do Docker) com `python manage.py runserver`,
// ele fica exposto em localhost:8000.
// const backendProxy = {
//   target: 'http://backend:8000',
//   changeOrigin: true,
// }
const backendProxy = {
  target: 'http://localhost:8000',
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