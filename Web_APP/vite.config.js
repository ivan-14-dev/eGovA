import { defineConfig } from 'vite'
import { createApi } from '../backend/http.mjs'
import { proxyWorkspace } from '../backend/workspace-proxy.mjs'

export default defineConfig({
  server: { host: '127.0.0.1', port: 5174, strictPort: true },
  preview: { host: '127.0.0.1', port: 4174, strictPort: true },
  plugins: [{
    name: 'local-document-corpus',
    async configureServer(server) {
      server.middlewares.use((request, response, next) => { if (!proxyWorkspace(request, response)) next() })
      server.middlewares.use(await createApi())
    },
    async configurePreviewServer(server) {
      server.middlewares.use((request, response, next) => { if (!proxyWorkspace(request, response)) next() })
      server.middlewares.use(await createApi())
    },
  }],
})
