import { createReadStream } from 'node:fs'
import { stat } from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import { loadCorpus } from './corpus.mjs'

function json(response, status, body) {
  response.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' })
  response.end(JSON.stringify(body))
}

export async function sendFile(request, response, path, contentType) {
  const info = await stat(path)
  if (!info.isFile()) throw new Error('Le fichier demandé n’est pas disponible.')
  let start = 0
  let end = info.size - 1
  const range = request.headers.range
  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match || (!match[1] && !match[2])) {
      response.writeHead(416, { 'Content-Range': `bytes */${info.size}` })
      response.end()
      return
    }
    start = match[1] ? Number(match[1]) : Math.max(0, info.size - Number(match[2]))
    end = match[1] && match[2] ? Math.min(Number(match[2]), end) : end
    if (!Number.isSafeInteger(start) || !Number.isSafeInteger(end) || start > end || start >= info.size) {
      response.writeHead(416, { 'Content-Range': `bytes */${info.size}` })
      response.end()
      return
    }
  }
  response.writeHead(range ? 206 : 200, {
    'Content-Type': contentType, 'Content-Length': end - start + 1,
    'Accept-Ranges': 'bytes', 'X-Content-Type-Options': 'nosniff',
    ...(range ? { 'Content-Range': `bytes ${start}-${end}/${info.size}` } : {}),
  })
  if (request.method === 'HEAD') {
    response.end()
    return
  }
  try {
    await pipeline(createReadStream(path, { start, end }), response)
  } catch (error) {
    if (error.code !== 'ERR_STREAM_PREMATURE_CLOSE') throw error
  }
}

export async function createApi(root) {
  const corpus = await loadCorpus(root)
  return async function api(request, response, next = () => json(response, 404, { error: 'Route inconnue.' })) {
    try {
      const url = new URL(request.url, 'http://localhost')
      if (!url.pathname.startsWith('/api/')) return next()
      if (!['GET', 'HEAD'].includes(request.method)) {
        response.setHeader('Allow', 'GET, HEAD')
        return json(response, 405, { error: 'Méthode non autorisée.' })
      }
      if (url.pathname === '/api/catalogue') return json(response, 200, corpus.catalogue())
      if (url.pathname === '/api/search') {
        const query = (url.searchParams.get('q') || '').trim()
        const group = url.searchParams.get('group') || 'all'
        const drafts = url.searchParams.get('drafts') || 'false'
        if (query.length < 2 || query.length > 300) return json(response, 400, { error: 'La recherche doit contenir entre 2 et 300 caractères.' })
        if (group !== 'all' && !corpus.groups.some((item) => item.id === group)) return json(response, 400, { error: 'Catégorie inconnue.' })
        if (!['true', 'false'].includes(drafts)) return json(response, 400, { error: 'Le filtre des projets doit être true ou false.' })
        return json(response, 200, corpus.search(query, { group, includeDrafts: drafts === 'true' }))
      }
      const route = /^\/api\/documents\/([a-f0-9]{64})\/(pdf|pages\/([1-9]\d*))$/.exec(url.pathname)
      if (!route || !corpus.documents.has(route[1])) return json(response, 404, { error: 'Document introuvable.' })
      if (route[2] === 'pdf') return await sendFile(request, response, corpus.pdfPath(route[1]), 'application/pdf')
      const page = corpus.page(route[1], Number(route[3]))
      if (!page) return json(response, 404, { error: 'Page introuvable dans ce document.' })
      return json(response, 200, page)
    } catch (error) {
      console.error('Erreur du service documentaire :', error)
      if (response.headersSent) response.destroy()
      else json(response, 500, { error: 'Le service documentaire a rencontré une erreur. Consultez le journal du serveur.' })
    }
  }
}
