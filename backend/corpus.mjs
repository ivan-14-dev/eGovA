import { readFile, stat } from 'node:fs/promises'
import { createReadStream } from 'node:fs'
import { createHash } from 'node:crypto'
import { fileURLToPath } from 'node:url'
import { resolve, relative, isAbsolute } from 'node:path'

export const projectRoot = fileURLToPath(new URL('../', import.meta.url))
const stopWords = new Set(`a au aux avec ce ces cette comme comment dans de des du en est et etre faire il je la le les leur leurs ma me mes mon ne nos notre nous on ou par pas plus pour pourquoi qu que quel quelle quelles quels qui sa se ses son sont sur un une vos votre vous y the a an and are for how in is of on or that the to what which with savoir indique dit dire dois doit peut puis faut texte textes document documents sujet`.split(' '))
export const groups = [
  { id: 'texts', label: 'Textes & guides' },
  { id: 'studies', label: 'Études & statistiques' },
  { id: 'news', label: 'Actualités' },
  { id: 'procurement', label: 'Marchés publics' },
]
const kindLabels = {
  arrete: 'Arrêté', decret: 'Décret', loi: 'Loi', decision: 'Décision',
  directive_ou_document_technique: 'Directive', guide_technique: 'Guide technique',
  recueil: 'Recueil', statistiques: 'Statistiques', rapport: 'Rapport',
  bulletin_information: 'Bulletin', communique: 'Communiqué',
  appel_offres_ou_consultation: 'Appel d’offres / consultation',
}
const apiNominationId = 'bfdac4b703858405ce867236f2a95c25b72423a735da5e215867ddecf652f00c'

export function normalize(value) {
  return value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
}

export function tokens(value) {
  return (normalize(value).match(/[a-z0-9]+/g) || [])
    .filter((word) => word.length > 1 && !stopWords.has(word))
    .map((word) => word.length > 4 && word.endsWith('s') && !word.endsWith('ss') ? word.slice(0, -1) : word)
}

function groupFor(kind) {
  if (['statistiques', 'rapport'].includes(kind)) return 'studies'
  if (['bulletin_information', 'communique'].includes(kind)) return 'news'
  if (kind === 'appel_offres_ou_consultation') return 'procurement'
  return 'texts'
}

export function safePath(root, path) {
  const absolute = resolve(root, path)
  const rel = relative(root, absolute)
  if (rel.startsWith('..') || isAbsolute(rel)) throw new Error('Chemin hors du corpus autorisé.')
  return absolute
}

async function jsonLines(path) {
  const text = await readFile(path, 'utf8')
  return text.trim().split('\n').map((line, index) => {
    try {
      return JSON.parse(line)
    } catch (error) {
      throw new Error(`JSON invalide dans ${path}, ligne ${index + 1}.`, { cause: error })
    }
  })
}

function excerpt(text, terms) {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (compact.length <= 600) return compact
  let bestStart = 0
  let bestScore = -1
  for (let start = 0; start < compact.length; start += 180) {
    const windowTokens = new Set(tokens(compact.slice(start, start + 600)))
    const score = terms.filter((term) => windowTokens.has(term)).length
    if (score > bestScore) {
      bestScore = score
      bestStart = start
    }
  }
  const start = bestStart === 0 ? 0 : compact.indexOf(' ', bestStart) + 1
  const end = compact.length <= start + 600 ? compact.length : compact.lastIndexOf(' ', start + 600)
  return `${start ? '… ' : ''}${compact.slice(start, end)}${end < compact.length ? ' …' : ''}`
}

export async function loadCorpus(root = projectRoot) {
  const manifest = JSON.parse(await readFile(resolve(root, 'donnees/markdown/manifest.json'), 'utf8'))
  const documents = new Map()
  const metadata = new Map()
  const pageMap = new Map()
  for (const directory of ['donnees', 'donnees/publications']) {
    for (const row of await jsonLines(resolve(root, directory, 'documents.jsonl'))) {
      if (!metadata.has(row.document_id)) metadata.set(row.document_id, row)
    }
    for (const row of await jsonLines(resolve(root, directory, 'pages.jsonl'))) {
      if (!pageMap.has(row.page_id)) pageMap.set(row.page_id, row)
    }
  }
  for (const file of manifest.files) {
    const source = safePath(resolve(root, 'Reglementations'), file.source_pdf)
    if (!(await stat(source)).isFile()) throw new Error(`PDF introuvable : ${file.source_pdf}`)
    const hash = createHash('sha256')
    for await (const chunk of createReadStream(source)) hash.update(chunk)
    if (hash.digest('hex') !== file.document_id) throw new Error(`PDF modifié depuis l’extraction : ${file.source_pdf}. Régénérez le corpus.`)
    const row = metadata.get(file.document_id)
    if (!row || row.page_count !== file.page_count) throw new Error(`Métadonnées incohérentes : ${file.source_pdf}`)
    if (documents.has(file.document_id)) {
      documents.get(file.document_id).sourcePaths.push(file.source_pdf)
      continue
    }
    const title = file.document_id === apiNominationId
      ? 'Nomination au conseil d’administration de l’API (2022)'
      : row.display_title.replace(/[_-]+/g, ' ').replace(/\s+/g, ' ').trim()
    const notes = ['Intitulé et références à vérifier dans le PDF original.']
    if (file.document_id === apiNominationId) {
      notes.unshift('Nom de fichier trompeur : le contenu concerne l’Agence de Promotion des Investissements (API), et non l’ART. Intitulé d’affichage corrigé d’après la page 1.')
    }
    if (row.warnings.includes('alias_2013_incorrect_contenu_loi_2010_013')) {
      notes.unshift('Le fichier nommé « 2013-013 » est une copie du texte de 2010/013, pas une nouvelle loi.')
    }
    const draft = row.legal_status === 'projet_a_verifier'
    const normative = ['arrete', 'decret', 'loi', 'decision', 'directive_ou_document_technique', 'recueil'].includes(row.document_kind)
    documents.set(file.document_id, {
      id: file.document_id, title, kind: row.document_kind,
      kindLabel: kindLabels[row.document_kind] || row.document_kind,
      group: groupFor(row.document_kind), pageCount: row.page_count,
      draft, status: draft ? 'Projet — adoption non confirmée' : normative
        ? 'Validité juridique non vérifiée' : 'Publication — pas une règle juridique',
      notes, sourcePaths: [file.source_pdf],
      pdfUrl: `/api/documents/${file.document_id}/pdf`,
    })
  }
  const pages = []
  const postings = new Map()
  let totalLength = 0
  for (const doc of documents.values()) {
    for (let number = 1; number <= doc.pageCount; number++) {
      const id = `${doc.id}:p${String(number).padStart(4, '0')}`
      const row = pageMap.get(id)
      if (!row || row.document_id !== doc.id || row.page_number !== number || typeof row.text !== 'string') {
        throw new Error(`Page manquante ou incohérente : ${id}`)
      }
      const frequencies = new Map()
      const words = tokens(row.text)
      for (const word of words) frequencies.set(word, (frequencies.get(word) || 0) + 1)
      const index = pages.length
      for (const [word, frequency] of frequencies) {
        if (!postings.has(word)) postings.set(word, new Map())
        postings.get(word).set(index, frequency)
      }
      pages.push({
        id, documentId: doc.id, number, text: row.text, length: words.length,
        method: row.extraction_method, confidence: row.ocr_mean_word_confidence,
        warnings: row.warnings, titleTokens: new Set(tokens(doc.title)),
      })
      totalLength += words.length
    }
  }
  const averageLength = totalLength / pages.length || 1
  const byPageId = new Map(pages.map((page) => [page.id, page]))
  const sortedDocuments = [...documents.values()].sort((a, b) => a.title.localeCompare(b.title, 'fr'))
  const stats = {
    sourceFiles: manifest.files.length, documents: documents.size, pages: pages.length,
    duplicateFiles: manifest.files.length - documents.size,
    unreviewedOcr: pages.filter((page) => page.warnings.includes('ocr_non_revu')).length,
    lowConfidence: pages.filter((page) => page.warnings.includes('confiance_ocr_faible')).length,
    emptyPages: pages.filter((page) => !page.text.trim()).length,
    drafts: sortedDocuments.filter((doc) => doc.draft).length,
  }
  if (documents.size !== manifest.unique_document_count) throw new Error('Le nombre de documents ne correspond pas au manifeste.')

  function publicPage(page, terms) {
    const doc = documents.get(page.documentId)
    return {
      citation: page.id, pageNumber: page.number, document: doc,
      method: page.method, confidence: page.confidence, warnings: page.warnings,
      pdfUrl: `${doc.pdfUrl}#page=${page.number}`,
      ...(terms ? { excerpt: excerpt(page.text, terms) } : { text: page.text }),
    }
  }

  return {
    documents, stats, groups,
    catalogue: () => ({ documents: sortedDocuments, stats, groups }),
    page(id, number) {
      const page = byPageId.get(`${id}:p${String(number).padStart(4, '0')}`)
      return page ? publicPage(page) : null
    },
    pdfPath(id) {
      const doc = documents.get(id)
      return doc ? safePath(resolve(root, 'Reglementations'), doc.sourcePaths[0]) : null
    },
    search(query, { group = 'all', includeDrafts = false } = {}) {
      const terms = [...new Set(tokens(query))]
      if (!terms.length) return { query, terms, total: 0, results: [], reason: 'Précisez un sujet, par exemple « certification électronique ».' }
      const scores = new Map()
      const matches = new Map()
      for (const term of terms) {
        const posting = postings.get(term)
        if (!posting) continue
        const inverseFrequency = Math.log(1 + (pages.length - posting.size + 0.5) / (posting.size + 0.5))
        for (const [index, frequency] of posting) {
          const page = pages[index]
          const doc = documents.get(page.documentId)
          if ((!includeDrafts && doc.draft) || (group !== 'all' && doc.group !== group)) continue
          const score = inverseFrequency * frequency * 2.2 / (frequency + 1.2 * (0.25 + 0.75 * page.length / averageLength))
          scores.set(index, (scores.get(index) || 0) + score + (page.titleTokens.has(term) ? 3 : 0))
          matches.set(index, (matches.get(index) || 0) + 1)
        }
      }
      const ranked = [...scores.entries()]
        .filter(([index]) => matches.get(index) >= Math.ceil(terms.length * 0.6))
        .map(([index, score]) => {
          const page = pages[index]
          const cover = page.number === 1 && page.text.length < 400 && documents.get(page.documentId).pageCount > 1
          return [index, cover ? score * 0.25 : score]
        })
        .sort((a, b) => b[1] - a[1] || a[0] - b[0])
      const usedDocuments = new Set()
      const results = []
      for (const [index] of ranked) {
        const page = pages[index]
        if (usedDocuments.has(page.documentId)) continue
        usedDocuments.add(page.documentId)
        if (results.length < 6) results.push(publicPage(page, terms))
      }
      return {
        query, terms, total: usedDocuments.size, results,
        reason: results.length ? null : 'Aucun passage suffisamment concordant trouvé. Essayez des mots-clés plus précis. Cette absence ne prouve pas qu’aucune règle n’existe.',
      }
    },
  }
}
