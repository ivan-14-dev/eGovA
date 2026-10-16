import assert from 'node:assert/strict'
import { after, before, test } from 'node:test'
import { createServer } from 'node:http'
import { createHash } from 'node:crypto'
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { loadCorpus, tokens, safePath } from './corpus.mjs'
import { createApi } from './http.mjs'

const corpus = await loadCorpus()
const classification = '87ba48fe1e7ca1dd6e073a5167c72863f9ff44cf46b2c92f7800276853fabb52'
const draft = '908abef267f59d33b31cae7b2776f208439fd1afc28873e6b0067a7016a1c10a'
let server
let origin
before(async () => {
  server = createServer(await createApi())
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve))
  origin = `http://127.0.0.1:${server.address().port}`
})
after(async () => {
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
})

test('inventory is globally deduplicated and quality counts cover physical pages', () => {
  assert.deepEqual(corpus.stats, {
    sourceFiles: 89, documents: 80, pages: 3011, duplicateFiles: 9,
    unreviewedOcr: 1174, lowConfidence: 136, emptyPages: 15, drafts: 2,
  })
  const docs = corpus.catalogue().documents
  assert.equal(new Set(docs.map((doc) => doc.id)).size, 80)
  assert.equal(docs.reduce((sum, doc) => sum + doc.sourcePaths.length, 0), 89)
})

test('every indexed page has a stable citation and PDF page link', () => {
  for (const doc of corpus.documents.values()) {
    for (let number = 1; number <= doc.pageCount; number++) {
      const page = corpus.page(doc.id, number)
      assert.equal(page.citation, `${doc.id}:p${String(number).padStart(4, '0')}`)
      assert.equal(page.pdfUrl, `/api/documents/${doc.id}/pdf#page=${number}`)
      assert.equal(page.document.id, doc.id)
      assert.ok(Array.isArray(page.warnings))
    }
  }
})

test('identical PDFs and the incorrect 2013 alias are not separate knowledge sources', () => {
  const doc = corpus.catalogue().documents.find((doc) => doc.sourcePaths.some((path) => path.endsWith('/Loi_2013-013_communications_electroniques.pdf')))
  assert.equal(doc.sourcePaths.length, 2)
  assert.ok(doc.notes.some((note) => note.includes('pas une nouvelle loi')))
  assert.ok(doc.title.includes('2010'))
})

test('the API nomination is not presented as an ART nomination', () => {
  const doc = corpus.documents.get('bfdac4b703858405ce867236f2a95c25b72423a735da5e215867ddecf652f00c')
  assert.match(doc.title, /API/)
  assert.match(doc.notes[0], /non l’ART/)
  assert.match(corpus.page(doc.id, 1).text, /Investissements/)
})

test('normalization handles French accents, capitals and plurals', () => {
  assert.deepEqual(tokens('LES CERTIFICATIONS ÉLECTRONIQUES'), tokens('certification electronique'))
  assert.deepEqual(corpus.search('CERTIFICATION ÉLECTRONIQUE').results.map((r) => r.citation),
    corpus.search('certification electronique').results.map((r) => r.citation))
})

test('search finds appropriate sources for the four suggested topics', () => {
  const topics = [
    ['cybersécurité cybercriminalité', /cybersecurite/],
    ['certification électronique', /Certification Electronique/],
    ['protection utilisateurs', /CEMAC/],
    ['identification abonnés', /Identification des Abonnes/],
  ]
  for (const [query, title] of topics) {
    const result = corpus.search(query)
    assert.ok(result.total > 0)
    assert.ok(result.results.length <= 6)
    assert.match(result.results[0].document.title, title)
    assert.equal(new Set(result.results.map((r) => r.document.id)).size, result.results.length)
  }
  assert.notEqual(corpus.search('cybersécurité cybercriminalité').results[0].pageNumber, 1)
})

test('search excerpts are verbatim substrings of the cited extraction (whitespace normalized)', () => {
  for (const query of ['certification électronique', 'identification abonnés', 'classification public establishments', 'cybersécurité']) {
    for (const result of corpus.search(query).results) {
      const source = corpus.page(result.document.id, result.pageNumber).text.replace(/\s+/g, ' ').trim()
      const excerpt = result.excerpt.replace(/^… /, '').replace(/ …$/, '')
      assert.ok(source.includes(excerpt), result.citation)
      assert.equal(result.warnings, corpus.page(result.document.id, result.pageNumber).warnings)
    }
  }
})

test('drafts are excluded by default and explicitly marked when included', () => {
  assert.ok(corpus.search('cartes couverture').results.every((result) => !result.document.draft))
  const results = corpus.search('cartes couverture', { includeDrafts: true }).results
  const found = results.find((result) => result.document.id === draft)
  assert.ok(found)
  assert.equal(found.document.status, 'Projet — adoption non confirmée')
})

test('category filters do not present publications as legal texts', () => {
  const result = corpus.search('investissements', { group: 'studies' })
  assert.ok(result.results.length)
  assert.ok(result.results.every((r) => r.document.group === 'studies' && r.document.status.includes('pas une règle')))
  assert.ok(corpus.search('nettoyage', { group: 'procurement' }).results.every((r) => r.document.kind === 'appel_offres_ou_consultation'))
})

test('no result and stopword-only queries do not invent answers', () => {
  for (const query of ['zzzzinexistant123', 'le et pour']) {
    const result = corpus.search(query)
    assert.equal(result.total, 0)
    assert.deepEqual(result.results, [])
    assert.ok(result.reason)
  }
})

test('OCR quality and empty extractions remain visible', () => {
  const page = corpus.page(classification, 1)
  assert.equal(page.method, 'ocr')
  assert.equal(page.confidence, 94.96)
  assert.ok(page.warnings.includes('ocr_non_revu'))
  const all = [...corpus.documents.values()].flatMap((doc) => Array.from({ length: doc.pageCount }, (_, index) => corpus.page(doc.id, index + 1)))
  assert.equal(all.filter((p) => !p.text.trim()).length, 15)
})

test('API catalogue and source page endpoints return the expected response shapes', async () => {
  const catalogue = await fetch(`${origin}/api/catalogue`)
  assert.equal(catalogue.status, 200)
  assert.equal((await catalogue.json()).documents.length, 80)
  const page = await fetch(`${origin}/api/documents/${classification}/pages/1`)
  assert.equal(page.status, 200)
  assert.equal((await page.json()).citation, `${classification}:p0001`)
})

test('API searches actual content and validates query inputs', async () => {
  const response = await fetch(`${origin}/api/search?q=certification%20electronique`)
  assert.equal(response.status, 200)
  assert.ok((await response.json()).results.length)
  for (const params of ['q=', 'q=a', `q=${'a'.repeat(301)}`, 'q=cyber&group=unknown', 'q=cyber&drafts=maybe']) {
    const invalid = await fetch(`${origin}/api/search?${params}`)
    assert.equal(invalid.status, 400)
    assert.ok((await invalid.json()).error)
  }
})

test('PDF endpoint serves the exact source PDF, HEAD and byte ranges', async () => {
  const path = `/api/documents/${classification}/pdf`
  const response = await fetch(`${origin}${path}`)
  assert.equal(response.status, 200)
  assert.equal(response.headers.get('content-type'), 'application/pdf')
  const bytes = Buffer.from(await response.arrayBuffer())
  assert.equal(createHash('sha256').update(bytes).digest('hex'), classification)
  assert.deepEqual(bytes, await readFile(corpus.pdfPath(classification)))
  const head = await fetch(`${origin}${path}`, { method: 'HEAD' })
  assert.equal(head.headers.get('content-length'), String(bytes.length))
  assert.equal((await head.arrayBuffer()).byteLength, 0)
  const range = await fetch(`${origin}${path}`, { headers: { Range: 'bytes=0-4' } })
  assert.equal(range.status, 206)
  assert.equal(await range.text(), '%PDF-')
  const suffix = await fetch(`${origin}${path}`, { headers: { Range: 'bytes=-10' } })
  assert.deepEqual(Buffer.from(await suffix.arrayBuffer()), bytes.subarray(-10))
  const invalid = await fetch(`${origin}${path}`, { headers: { Range: 'bytes=999999999-' } })
  assert.equal(invalid.status, 416)
})

test('missing documents, pages, routes and unsupported methods return explicit errors', async () => {
  for (const path of [`/api/documents/${classification}/pages/2`, `/api/documents/${'0'.repeat(64)}/pdf`, '/api/unknown', '/api/documents/../../README.md']) {
    const response = await fetch(`${origin}${path}`)
    assert.equal(response.status, 404)
    assert.ok((await response.json()).error)
  }
  const response = await fetch(`${origin}/api/catalogue`, { method: 'POST' })
  assert.equal(response.status, 405)
  assert.ok((await response.json()).error)
  assert.throws(() => safePath('/tmp/corpus', '../outside'), /hors du corpus/)
})

test('a missing corpus fails explicitly instead of returning an empty successful catalogue', async () => {
  await assert.rejects(loadCorpus(new URL('./missing-corpus-test-directory', import.meta.url).pathname), /ENOENT/)
})

test('a PDF changed after extraction is rejected instead of being cited as the original', async () => {
  const root = await mkdtemp(join(tmpdir(), 'telecom-corpus-integrity-'))
  try {
    for (const directory of ['donnees/markdown', 'donnees/publications', 'Reglementations']) {
      await mkdir(join(root, directory), { recursive: true })
    }
    const metadata = { document_id: classification, page_count: 1 }
    for (const collection of ['donnees', 'donnees/publications']) {
      await writeFile(join(root, collection, 'documents.jsonl'), JSON.stringify(metadata))
      await writeFile(join(root, collection, 'pages.jsonl'), JSON.stringify({ page_id: `${classification}:p0001` }))
    }
    await writeFile(join(root, 'donnees/markdown/manifest.json'), JSON.stringify({
      unique_document_count: 1,
      files: [{ document_id: classification, source_pdf: 'modified.pdf', page_count: 1 }],
    }))
    await writeFile(join(root, 'Reglementations/modified.pdf'), '%PDF-1.4\nChanged contents\n%%EOF')
    await assert.rejects(loadCorpus(root), /PDF modifié depuis l’extraction/)
  } finally {
    await rm(root, { recursive: true })
  }
})
