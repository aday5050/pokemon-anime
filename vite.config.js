import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import synopsisHandler from './api/synopsis.js'

function localSynopsis() {
  return {
    name: 'local-synopsis',
    configureServer(server) {
      server.middlewares.use('/api/synopsis', async (req, res) => {
        const url = new URL(req.url, 'http://localhost')
        const query = Object.fromEntries(url.searchParams)
        for (const key of ['season', 'episode']) {
          if (url.searchParams.getAll(key).length > 1) query[key] = url.searchParams.getAll(key)
        }
        const adapter = {
          setHeader: (name, value) => res.setHeader(name, value),
          status(code) { res.statusCode = code; return this },
          json(value) { res.setHeader('Content-Type', 'application/json; charset=utf-8'); res.end(JSON.stringify(value)); return this },
        }
        await synopsisHandler({ method: req.method, query }, adapter)
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), localSynopsis()],
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
