import { request as httpRequest } from 'node:http'

const paths = ['/workspace-api/', '/native-api/', '/admin/', '/accounts/', '/static/']
export const workspaceTarget = process.env.DJANGO_URL || 'http://127.0.0.1:8000'

export function proxyWorkspace(request, response) {
  if (!paths.some((prefix) => request.url.startsWith(prefix))) return false
  const upstream = httpRequest(new URL(request.url, workspaceTarget), {
    method: request.method, headers: request.headers, timeout: 45000,
  }, (incoming) => {
    incoming.on('error', () => response.destroy())
    response.writeHead(incoming.statusCode, incoming.headers)
    incoming.pipe(response)
  })
  upstream.on('timeout', () => upstream.destroy(new Error('Délai Django dépassé')))
  upstream.on('error', (error) => {
    console.error('Service Django indisponible :', error.code || error.message)
    if (response.headersSent) response.destroy()
    else {
      response.writeHead(503, { 'Content-Type': 'application/json' })
      response.end(JSON.stringify({ error: 'Service des comptes indisponible. Démarrez le backend Django sur le port configuré.' }))
    }
  })
  request.on('aborted', () => upstream.destroy())
  request.pipe(upstream)
  return true
}
