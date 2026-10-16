import { createServer } from 'node:http'
import { access } from 'node:fs/promises'
import { resolve, extname } from 'node:path'
import { projectRoot, safePath } from './corpus.mjs'
import { createApi, sendFile } from './http.mjs'
import { proxyWorkspace } from './workspace-proxy.mjs'

const dist = resolve(projectRoot, 'Web_APP/dist')
await access(resolve(dist, 'index.html'))
const api = await createApi()
const types = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml' }
const port = Number(process.env.PORT || 4174)
if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('PORT doit être un entier entre 1 et 65535.')
const server = createServer((request, response) => {
  if (request.url.startsWith('/native-api/') || request.url.startsWith('/api/')) {
    const origin = request.headers.origin
    const allowed = (process.env.CLIENT_ORIGINS || 'http://localhost:8081,http://127.0.0.1:8081').split(',')
    if (origin && !allowed.includes(origin)) {
      response.writeHead(403, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Origine du client non autorisée.' }))
      return
    }
    if (origin) {
      response.setHeader('Access-Control-Allow-Origin', origin)
      response.setHeader('Vary', 'Origin')
      response.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type')
      response.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS')
    }
    if (request.method === 'OPTIONS') { response.writeHead(204); response.end(); return }
  }
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
const host = process.env.HOST || '127.0.0.1'
server.listen(port, host, () => console.log(`Assistant documentaire : http://${host}:${port}`))
