import React, { useEffect, useState } from 'react'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { absoluteURL, request } from './api'
import { Body, Button, Card, Choice, Expand, Field, Title, Toggle, Warning } from './ui'
import type { Catalogue, Document, DocumentPage, Run, SearchResult, Viewer } from './types'

export default function LibraryScreen({ run, busy, onViewer }: { run: Run; busy: boolean; onViewer: (v: Viewer) => void }) {
  const [catalogue, setCatalogue] = useState<Catalogue | null>(null)
  const [query, setQuery] = useState('')
  const [group, setGroup] = useState('all')
  const [drafts, setDrafts] = useState(false)
  const [savedOnly, setSavedOnly] = useState(false)
  const [favorites, setFavorites] = useState<string[]>([])
  const [storageError, setStorageError] = useState('')
  const [results, setResults] = useState<SearchResult[] | null>(null)
  const [page, setPage] = useState<DocumentPage | null>(null)
  const [visible, setVisible] = useState(12)
  useEffect(() => { void run(async () => setCatalogue(await request<Catalogue>('/api/catalogue'))) }, [run])
  useEffect(() => {
    let active = true
    void AsyncStorage.getItem('egova-favorites').then((raw) => {
      const parsed: unknown = JSON.parse(raw || '[]')
      if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === 'string' && /^[a-f0-9]{64}$/.test(x))) throw new Error('Format des favoris invalide.')
      if (active) setFavorites(parsed)
    }).catch((e: Error) => { if (active) setStorageError(`Favoris indisponibles : ${e.message}`) })
    return () => { active = false }
  }, [])
  const favorite = (id: string) => run(async () => {
    const next = favorites.includes(id) ? favorites.filter((x) => x !== id) : [...favorites, id]
    await AsyncStorage.setItem('egova-favorites', JSON.stringify(next)); setFavorites(next); setStorageError('')
  })
  const open = (id: string, number: number) => run(async () => setPage(await request<DocumentPage>(`/api/documents/${id}/pages/${number}`)))
  const pdf = (doc: Document, number = 1) => onViewer({ title: doc.title, uri: absoluteURL(doc.pdfUrl), mime: 'application/pdf', headers: {}, page: number })
  if (page) return <><Button title="Retour à la bibliothèque" secondary onPress={() => setPage(null)} /><Title>{page.document.title}</Title>
    <Warning>{page.document.status}. {page.warnings.join(' · ')}</Warning><Body>Page {page.pageNumber}/{page.document.pageCount} · méthode {page.method} · confiance OCR {page.confidence ?? 'non renseignée'}</Body>
    <Card><Body>{page.text || 'Extraction vide. Consultez le PDF original.'}</Body></Card>
    <Button title="Visualiser le PDF original" onPress={() => pdf(page.document, page.pageNumber)} />
    <Button secondary title="Page précédente" disabled={busy || page.pageNumber <= 1} onPress={() => void open(page.document.id, page.pageNumber - 1)} />
    <Button secondary title="Page suivante" disabled={busy || page.pageNumber >= page.document.pageCount} onPress={() => void open(page.document.id, page.pageNumber + 1)} />
  </>
  const rows = catalogue?.documents.filter((d) => (drafts || !d.draft) && (group === 'all' || d.group === group)
    && (!savedOnly || favorites.includes(d.id)) && d.title.toLowerCase().includes(query.toLowerCase())) || []
  return <><Title>Bibliothèque et sources</Title>
    {!!storageError && <Warning>{storageError}</Warning>}
    {catalogue && <Expand title={`${catalogue.stats.documents} sources · ${catalogue.stats.pages} pages · qualité`}>
      {Object.entries(catalogue.stats).map(([key, value]) => <Body key={key}>{key} : {value}</Body>)}
      <Warning>OCR non certifié. Une publication n’est pas une règle juridique ; la vigueur de chaque texte reste à vérifier.</Warning>
    </Expand>}
    <Card>
      <Field label="Mots-clés documentaires" value={query} onChange={(v) => { setQuery(v); setVisible(12) }} />
      <Choice label="Catégorie" value={group} onChange={setGroup} items={{ all: 'Toutes', ...Object.fromEntries((catalogue?.groups || []).map((g) => [g.id, g.label])) }} />
      <Toggle label="Inclure les projets non adoptés" value={drafts} onChange={setDrafts} />
      <Toggle label="Mes favoris uniquement" value={savedOnly} onChange={setSavedOnly} />
      <Button title="Chercher dans le texte des documents" disabled={busy} onPress={() => void run(async () => {
        const result = await request<{ results: SearchResult[] }>(`/api/search?q=${encodeURIComponent(query)}&group=${group}&drafts=${drafts}`)
        setResults(result.results)
      })} />
      <Button title="Afficher le catalogue" secondary onPress={() => setResults(null)} />
    </Card>
    {results ? <><Body>{results.length ? 'Passages correspondants, sans conclusion juridique.' : 'Aucun passage suffisamment concordant. Cela ne prouve pas l’absence de règle.'}</Body>
      {results.map((r) => <Card key={r.citation} title={r.document.title}><Body>Page {r.pageNumber} · {r.document.status}</Body><Body>{r.excerpt}</Body>
        <Button title={`Lire la page ${r.pageNumber}`} onPress={() => void open(r.document.id, r.pageNumber)} disabled={busy} /></Card>)}</>
      : <>{rows.slice(0, visible).map((d) => <Card key={d.id} title={d.title}><Body>{d.kindLabel} · {d.pageCount} pages</Body><Warning>{d.status}</Warning>
        {d.notes.map((n) => <Body key={n}>{n}</Body>)}<Button title="Lire le document" disabled={busy} onPress={() => void open(d.id, 1)} />
        <Button title={favorites.includes(d.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'} secondary disabled={busy} onPress={() => void favorite(d.id)} />
      </Card>)}{visible < rows.length && <Button title="Afficher davantage de documents" secondary onPress={() => setVisible(visible + 12)} />}</>}
    {!catalogue && <Button title="Recharger la bibliothèque" disabled={busy} onPress={() => void run(async () => setCatalogue(await request<Catalogue>('/api/catalogue')))} />}
  </>
}
