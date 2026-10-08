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

// WebSocket (tempo real) roda num processo à parte do HTTP normal — daphne, não o
// `manage.py runserver` (Channels 4.x não faz mais o runserver virar ASGI sozinho).
// Em produção é o Traefik quem roteia /ws pro serviço do daphne por path prefix; aqui
// o proxy do Vite replica o mesmo roteamento pra dev local.
const wsProxy = {
  target: 'http://localhost:8001',
  changeOrigin: true,
  ws: true,
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
      '/ws': wsProxy,
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