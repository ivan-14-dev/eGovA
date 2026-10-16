import { createServer } from 'node:http'
import { access } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { projectRoot, safePath } from './corpus.mjs'
import { createApi, sendFile } from './http.mjs'
import { proxyWorkspace } from './workspace-proxy.mjs'

const dist = resolve(projectRoot, 'Mobile_APP/dist')
await access(resolve(dist, 'index.html'))
const api = await createApi()
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' }
const port = Number(process.env.PORT || 4174)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT doit être un entier entre 1 et 65535.')
const server = createServer((request, response) => {
  if (proxyWorkspace(request, response)) return
  void api(request, response, async () => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.writeHead(405, { Allow: 'GET, HEAD' })
        response.end('Méthode non autorisée.')
        return
      }
      if (pathname !== '/' && pathname !== '/index.html' && !/^\/assets\/[\w.-]+$/.test(pathname)) {
        response.writeHead(404)
        response.end('Fichier introuvable.')
        return
      }
      const path = safePath(dist, pathname === '/' ? 'index.html' : pathname.slice(1))
      await sendFile(request, response, path, types[extname(path)] || 'application/octet-stream')
    } catch (error) {
      console.error('Erreur de lecture du site :', error)
      if (response.headersSent) response.destroy()
      else {
        response.writeHead(error.code === 'ENOENT' ? 404 : 500)
        response.end('Fichier indisponible.')
      }
    }
  })
})
server.listen(port, '127.0.0.1', () => console.log(`Assistant documentaire : http://127.0.0.1:${port}`))
