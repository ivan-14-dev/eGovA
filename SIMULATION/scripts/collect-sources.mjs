import { readFile, writeFile, mkdir } from 'node:fs/promises'

const seeds = JSON.parse(await readFile(new URL('../src/data/institution-seeds.json', import.meta.url), 'utf8'))
const outputDir = new URL('../source-audit/', import.meta.url)
await mkdir(outputDir, { recursive: true })
const clean = (text) => text.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '').replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;|&#160;/g, ' ').replace(/&amp;/g, '&').replace(/&#039;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/\s+/g, ' ').trim()

async function request(url) {
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(25000), headers: { 'User-Agent': 'MonAssistantResearch/0.1 (institutional source verification)' } })
    if (!response.ok) return { ok: false, url: response.url, error: `HTTP ${response.status}` }
    return { ok: true, url: response.url, text: await response.text() }
  } catch (error) {
    console.error(`Source inaccessible: ${url}: ${error.message}`)
    return { ok: false, url, error: error.message }
  }
}

const results = []
const cached = process.argv.includes('--cached')
const previous = cached ? JSON.parse(await readFile(new URL('research.json', outputDir), 'utf8')) : []
for (let offset = 0; offset < seeds.length; offset += 4) {
  const batch = await Promise.all(seeds.slice(offset, offset + 4).map(async (seed) => {
    const sourceUrl = `https://www.spm.gov.cm/site/?q=fr/content/${encodeURIComponent(seed.slug)}`
    const saved = previous.find((row) => row.id === seed.id)
    const primary = cached && saved?.primaryAvailable
      ? { ok: true, text: await readFile(new URL(`${seed.id}-spm.html`, outputDir), 'utf8') }
      : await request(sourceUrl)
    let excerpt = ''
    if (primary.ok) {
      await writeFile(new URL(`${seed.id}-spm.html`, outputDir), primary.text)
      const body = primary.text.match(/field-name-field-missions[\s\S]*?<div class="field-item even"[^>]*>([\s\S]*?)<\/div>/)
      excerpt = clean(body?.[1] ?? '').slice(0, 1800)
    }
    const searchUrl = new URL('https://commons.wikimedia.org/w/api.php')
    searchUrl.search = new URLSearchParams({ action: 'query', format: 'json', generator: 'search', gsrsearch: `${seed.name} Cameroun`, gsrnamespace: '6', gsrlimit: '3', prop: 'imageinfo', iiprop: 'url|extmetadata' }).toString()
    const commons = cached ? { ok: false } : await request(searchUrl.href)
    let candidates = saved?.candidates ?? []
    let searchError = saved?.photoSearchError ?? commons.error ?? null
    if (commons.ok && commons.text) {
      try {
        const data = JSON.parse(commons.text)
        candidates = Object.values(data.query?.pages ?? {}).map((p) => ({ title: p.title, image: p.imageinfo?.[0] ?? null }))
        if (data.error) searchError = JSON.stringify(data.error)
      } catch (error) {
        console.error(`${seed.id}: réponse Commons invalide: ${error.message}`)
        searchError = error.message
      }
    }
    const result = { id: seed.id, consultedAt: new Date().toISOString(), sourceUrl, primaryAvailable: primary.ok, primaryError: primary.error ?? null, excerpt, photoSearchUrl: searchUrl.href, photoSearchError: searchError, candidates }
    console.log(`${seed.id}: source=${primary.ok}; images=${candidates.length}; ${excerpt.slice(0, 260)}`)
    return result
  }))
  results.push(...batch)
}
await writeFile(new URL('research.json', outputDir), JSON.stringify(results, null, 2) + '\n')
