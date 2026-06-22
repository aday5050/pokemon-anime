import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/pkvideo': {
        target: 'https://pkproject.net',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/pkvideo/, ''),
        headers: {
          'Referer': 'https://pkproject.net/',
          'Origin': 'https://pkproject.net'
        }
      }
    }
  }
})
