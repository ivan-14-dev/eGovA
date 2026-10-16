import './styles.css'
import { mountWorkspace } from './workspace.js'

const icons = {
  home: '<path d="m3 10 9-7 9 7v10H15v-6H9v6H3z"/>',
  book: '<path d="M12 5v16M3 3c4-1 6 0 9 2 3-2 5-3 9-2v16c-4-1-6 0-9 2-3-2-5-3-9-2z"/>',
  bot: '<rect x="4" y="7" width="16" height="13" rx="4"/><path d="M12 3v4m-4 6h.01M16 13h.01M9 17h6"/>',
  bookmark: '<path d="M6 3h12v19l-6-4-6 4z"/>',
  shield: '<path d="m12 3 8 3v5c0 6-8 11-8 11S4 17 4 11V6z"/><path d="M12 8v5m0 3h.01"/>',
  search: '<circle cx="10" cy="10" r="6"/><path d="m15 15 6 6"/>',
  arrow: '<path d="M19 12H5m7 7-7-7 7-7"/>',
  next: '<path d="m9 18 6-6-6-6"/>',
  file: '<path d="M14 2H5v20h14V7zM14 2v6h5M8 13h8m-8 4h8"/>',
  send: '<path d="m22 2-7 20-4-9-9-4ZM22 2 11 13"/>',
  link: '<path d="M14 3h7v7m0-7L10 14M10 3H3v18h18v-7"/>',
}
const escapeHtml = (value) => String(value).replace(/[&<>"']/g, (char) => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
})[char])
const icon = (name, size = 20) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${icons[name] || icons.file}</svg>`
const normalized = (value) => value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
const storageKey = 'telecom-document-favorites-v1'
let storageError = ''
let favorites = []
try {
  const saved = JSON.parse(localStorage.getItem(storageKey) || '[]')
  if (!Array.isArray(saved) || saved.some((id) => typeof id !== 'string' || !/^[a-f0-9]{64}$/.test(id))) {
    throw new Error('Le format des favoris enregistrés est invalide.')
  }
  favorites = [...new Set(saved)]
} catch (error) {
  console.error('Lecture des favoris impossible.', error)
  storageError = 'Les favoris enregistrés sont illisibles ou le stockage est bloqué. Ils ne sont pas disponibles.'
}

const state = {
  catalogue: null, loading: true, error: '', route: readRoute(),
  libraryQuery: '', libraryGroup: 'all', libraryDrafts: false, visible: 12,
  question: '', searchGroup: 'all', searchDrafts: false, searching: false, answer: null, searchError: '',
  page: null, pageError: '', pageLoading: false,
}
let pageRequest = 0
let documentOrigin = '/library'
let searchController
let toastTimer

function readRoute() {
  const hash = location.hash.slice(1) || '/home'
  if (/^\/workspace(?:\/[a-z]+)?$/.test(hash)) return { name: 'workspace' }
  const documentRoute = /^\/document\/([a-f0-9]{64})\/([1-9]\d*)$/.exec(hash)
  if (documentRoute) return { name: 'document', id: documentRoute[1], page: Number(documentRoute[2]) }
  return { name: ['home', 'library', 'assistant', 'saved', 'quality'].find((name) => hash === `/${name}`) || 'unknown' }
}

function navigate(route) {
  if (location.hash === `#${route}`) render()
  else location.hash = route
}

async function fetchJson(url, signal) {
  const response = await fetch(url, { signal, headers: { Accept: 'application/json' } })
  const body = await response.json()
  if (!response.ok) throw new Error(body.error || `Erreur HTTP ${response.status}`)
  return body
}

function errorPanel(message, action = '') {
  return `<div class="error-panel" role="alert"><strong>Impossible de terminer l’opération</strong><p>${escapeHtml(message)}</p>${action ? `<button class="outline-action" data-action="${action}">Réessayer</button>` : ''}</div>`
}

function notice(title, message) {
  return `<aside class="quality-warning">${icon('shield', 18)}<div><strong>${escapeHtml(title)}</strong><p>${escapeHtml(message)}</p></div></aside>`
}

function header() {
  const names = { home: 'Télécoms & Numérique', workspace: 'Mon espace · démarches', library: 'Bibliothèque', assistant: 'Assistant documentaire', saved: 'Mes favoris', quality: 'Sources & fiabilité', document: 'Lire une source', unknown: 'Page introuvable' }
  return `<header class="topbar">${state.route.name === 'document'
    ? `<button class="icon-button" data-action="back" aria-label="Retour">${icon('arrow')}</button>`
    : '<a class="wordmark" href="#/home" aria-label="Accueil">🇨🇲</a>'}
    <span class="topbar-title">${names[state.route.name]}</span>
    <a class="icon-button" href="#/quality" aria-label="Qualité des sources">${icon('shield')}</a></header>
    <div class="independence">Outil indépendant · Aucun service public connecté</div>`
}

function bottomNav() {
  return `<nav class="bottom-nav" aria-label="Navigation principale">${[
    ['home', 'Accueil', 'home'], ['workspace', 'Mon espace', 'file'], ['library', 'Bibliothèque', 'book'],
    ['assistant', 'Assistant', 'bot'], ['saved', 'Favoris', 'bookmark'], ['quality', 'Sources', 'shield'],
  ].map(([target, label, glyph]) => `<a href="#/${target}" class="nav-item ${target === 'assistant' ? 'assistant-nav' : ''} ${state.route.name === target ? 'active' : ''}" ${state.route.name === target ? 'aria-current="page"' : ''}><span class="nav-icon">${icon(glyph)}</span><span>${label}</span></a>`).join('')}</nav>`
}

function saveButton(doc) {
  const saved = favorites.includes(doc.id)
  return `<button class="icon-button save-button ${saved ? 'is-saved' : ''}" data-action="favorite" data-id="${doc.id}" aria-label="${saved ? 'Retirer des favoris' : 'Ajouter aux favoris'}" aria-pressed="${saved}">${icon('bookmark', 18)}</button>`
}

function documentCard(doc) {
  return `<article class="document-card"><span class="document-symbol">${icon('file')}</span><a class="document-copy" href="#/document/${doc.id}/1"><span class="document-kind">${escapeHtml(doc.kindLabel)} · ${doc.pageCount} p.</span><h3>${escapeHtml(doc.title)}</h3><small class="${doc.draft ? 'draft-label' : ''}">${escapeHtml(doc.status)}</small></a>${saveButton(doc)}</article>`
}

function statsCards(stats) {
  return `<div class="stat-grid"><a href="#/library" class="stat-card blue-stat"><strong>${stats.documents}</strong><span>Sources distinctes</span></a><a href="#/library" class="stat-card green-stat"><strong>${stats.pages.toLocaleString('fr')}</strong><span>Pages indexées</span></a><a href="#/quality" class="stat-card orange-stat"><strong>${stats.drafts}</strong><span>Projets signalés</span></a></div>`
}

const suggestions = [
  ['Cybersécurité', 'cybersécurité cybercriminalité'],
  ['Certification électronique', 'certification électronique'],
  ['Droits des utilisateurs', 'protection utilisateurs'],
  ['Identification des abonnés', 'identification abonnés'],
]

function homeScreen() {
  const { stats } = state.catalogue
  return `<section class="greeting"><span class="eyebrow">VOTRE ESPACE DOCUMENTAIRE</span><p>Le numérique camerounais,<br><strong>avec ses sources.</strong></p></section>
    <section class="hero-card"><div class="hero-copy"><span class="eyebrow">ASSISTANT TÉLÉCOMS</span><h1>Une question.<br>Des passages à vérifier.</h1><p>Explorez les textes et publications du corpus local.</p><a class="hero-cta" href="#/assistant">Interroger les documents ${icon('next', 16)}</a></div><div class="bot-orb" aria-hidden="true"><span class="bot-face"><i></i><i></i></span></div></section>
    <section class="section-block"><div class="section-heading"><h2>Votre base de connaissances</h2><a href="#/quality">Détails</a></div>${statsCards(stats)}</section>
    <section class="section-block"><div class="section-heading"><h2>Par où commencer ?</h2></div><div class="topic-grid">${suggestions.map(([title, query]) => `<button class="topic-card" data-action="ask" data-query="${escapeHtml(query)}">${icon('search', 17)}<span>${title}</span>${icon('next', 15)}</button>`).join('')}</div></section>
    <a class="reference-banner" href="#/library">${icon('book', 23)}<span><strong>Explorer la bibliothèque</strong><small>Textes, guides, statistiques et actualités</small></span>${icon('next', 17)}</a>
    <a class="reference-banner" href="#/workspace">${icon('file', 23)}<span><strong>Mon espace et mon assistant IA</strong><small>Compte, démarches, documents, budget, audit et veille</small></span>${icon('next', 17)}</a>
    ${notice('Des sources, pas un avis juridique', 'Recherche documentaire locale. Gemini est optionnel dans Mon espace, sur des extraits publics uniquement et après accord. Aucune démarche administrative transmise ; validité des textes à vérifier.')}`
}

function groupOptions(selected) {
  return `<option value="all" ${selected === 'all' ? 'selected' : ''}>Toutes les catégories</option>${state.catalogue.groups.map((group) => `<option value="${group.id}" ${selected === group.id ? 'selected' : ''}>${escapeHtml(group.label)}</option>`).join('')}`
}

function libraryScreen(savedOnly = false) {
  const words = normalized(state.libraryQuery).split(/\s+/).filter(Boolean)
  const docs = state.catalogue.documents.filter((doc) => savedOnly ? favorites.includes(doc.id)
    : (state.libraryDrafts || !doc.draft)
      && (state.libraryGroup === 'all' || doc.group === state.libraryGroup)
      && words.every((word) => normalized(`${doc.title} ${doc.kindLabel}`).includes(word)))
  return `<div class="page-intro"><span class="eyebrow">${savedOnly ? 'VOTRE SÉLECTION LOCALE' : 'CORPUS DÉDOUBLONNÉ'}</span><h1>${savedOnly ? 'À retrouver facilement' : 'Les documents, à portée de main'}</h1><p>${savedOnly ? 'Vos favoris sont conservés dans ce navigateur. Aucun compte requis.' : 'Filtrez les titres ici. Pour chercher dans le contenu des pages, utilisez l’assistant.'}</p></div>
    ${savedOnly ? '' : `<form id="library-form" class="search-form"><label for="library-query">Rechercher un titre</label><div class="search-box">${icon('search', 18)}<input id="library-query" type="search" placeholder="Ex. : observatoire, cybersécurité…" value="${escapeHtml(state.libraryQuery)}" maxlength="150"><button type="submit">Filtrer</button></div></form>
    <div class="filters"><div><label for="library-group">Catégorie</label><select id="library-group">${groupOptions(state.libraryGroup)}</select></div><label class="checkbox-label"><input type="checkbox" id="library-drafts" ${state.libraryDrafts ? 'checked' : ''}> Inclure les projets non confirmés</label></div>`}
    <div class="section-heading"><h2>${docs.length} document${docs.length > 1 ? 's' : ''}</h2>${!savedOnly ? '<a href="#/assistant">Chercher dans les pages</a>' : ''}</div>
    <div class="document-list">${docs.slice(0, savedOnly ? docs.length : state.visible).map(documentCard).join('') || '<div class="empty-state">Aucun document dans cette sélection.</div>'}</div>
    ${!savedOnly && docs.length > state.visible ? '<button class="outline-action" data-action="more">Afficher 12 documents de plus</button>' : ''}`
}

function pageQuality(page) {
  const notes = []
  if (page.warnings.includes('ocr_non_revu')) notes.push('OCR non revu')
  if (page.warnings.includes('confiance_ocr_faible')) notes.push('Confiance OCR faible')
  if (page.warnings.includes('contenu_limite_a_verifier')) notes.push('Contenu limité')
  if (page.warnings.includes('ocr_moins_complet_texte_natif_conserve')) notes.push('Texte natif conservé après comparaison OCR')
  return `<div class="page-quality"><span>${page.method === 'ocr' ? 'Extraction OCR' : 'Texte natif'}${page.confidence !== null ? ` · score OCR ${page.confidence}/100` : ''}</span>${notes.map((note) => `<span class="warning-tag">${note}</span>`).join('')}<span>Ce score ne mesure pas la validité juridique.</span></div>`
}

function resultCard(result, index) {
  return `<article class="source-card"><div class="source-heading"><span class="source-number">${index + 1}</span><span class="document-kind">${escapeHtml(result.document.kindLabel)} · Page ${result.pageNumber}</span>${saveButton(result.document)}</div>
    <h3><a href="#/document/${result.document.id}/${result.pageNumber}">${escapeHtml(result.document.title)}</a></h3>
    <p class="source-status ${result.document.draft ? 'draft-label' : ''}">${escapeHtml(result.document.status)}</p>
    <blockquote>${escapeHtml(result.excerpt)}</blockquote>${pageQuality(result)}
    <details class="citation-details"><summary>Référence de citation</summary><code>${result.citation}</code><p>${escapeHtml(result.document.sourcePaths[0])}</p></details>
    <div class="source-actions"><a href="#/document/${result.document.id}/${result.pageNumber}">Lire la page entière</a><a href="${result.pdfUrl}" target="_blank" rel="noopener">PDF · p. ${result.pageNumber} ${icon('link', 14)}</a></div></article>`
}

function assistantScreen() {
  const answer = state.answer
  return `<div class="page-intro"><span class="eyebrow">RECHERCHE LOCALE · FR / EN</span><h1>Interrogez vos sources</h1><p>Posez une question ou utilisez des mots-clés. Les passages sont extraits des documents, sans réponse juridique inventée.</p></div>
    <form id="assistant-form" class="assistant-form"><label for="question">Votre question</label><textarea id="question" name="question" rows="3" minlength="2" maxlength="300" required placeholder="Que disent les textes sur la certification électronique ?">${escapeHtml(state.question)}</textarea>
    <div><label for="search-group">Rechercher dans</label><select id="search-group">${groupOptions(state.searchGroup)}</select></div><label class="checkbox-label"><input type="checkbox" id="search-drafts" ${state.searchDrafts ? 'checked' : ''}> Inclure les projets non confirmés</label>
    <button class="primary-action" type="submit" ${state.searching ? 'disabled' : ''}>${icon('search', 18)} ${state.searching ? 'Recherche dans le corpus…' : 'Rechercher les passages'}</button></form>
    ${state.searchError ? errorPanel(state.searchError, 'retry-search') : ''}
    <div aria-live="polite" aria-busy="${state.searching}">${state.searching ? '<p class="loading-status">Recherche en cours…</p>' : answer ? `<section class="answer"><h2>${answer.results.length ? 'Passages retrouvés' : 'Aucun passage concordant'}</h2><p class="answer-query">Recherche : « ${escapeHtml(answer.query)} »</p><p>${answer.results.length ? `${answer.total} document(s) concordant(s). ${answer.results.length} passage(s) présentés, un par document. Il s’agit de résultats de recherche, pas d’une synthèse validée.` : escapeHtml(answer.reason)}</p>${answer.results.map(resultCard).join('')}</section>` : `<div class="suggestions"><h2>Quelques pistes</h2>${suggestions.map(([title, query]) => `<button class="suggestion-chip" data-action="ask" data-query="${escapeHtml(query)}">${title} ${icon('next', 15)}</button>`).join('')}</div>`}</div>
    ${notice('Périmètre limité', 'Ce corpus porte surtout sur les télécommunications et le numérique. Il ne permet pas de suivre un dossier de CNI ni de confirmer toutes les formalités administratives. Les projets sont exclus par défaut.')}`
}

function documentScreen() {
  if (state.pageLoading) return '<p class="loading-status" role="status">Chargement de la page source…</p>'
  if (state.pageError) return errorPanel(state.pageError, 'retry-page')
  if (!state.page) return ''
  const page = state.page
  const doc = page.document
  return `<section class="document-cover"><span class="eyebrow">${escapeHtml(doc.kindLabel)} · ${doc.pageCount} PAGES</span><h1>${escapeHtml(doc.title)}</h1><div class="cover-actions"><a href="${page.pdfUrl}" target="_blank" rel="noopener">Ouvrir le PDF · p. ${page.pageNumber} ${icon('link', 15)}</a>${saveButton(doc)}</div></section>
    ${notice(doc.status, doc.draft ? 'Ce document est signalé comme projet. Ne le présentez pas comme un texte adopté.' : 'Ni l’authenticité, ni la vigueur, ni la consolidation juridique de ce document ne sont certifiées par l’application.')}
    <details class="metadata"><summary>Provenance et précautions</summary>${doc.notes.map((note) => `<p>${escapeHtml(note)}</p>`).join('')}<strong>${doc.sourcePaths.length} fichier(s) source(s) pour ce contenu</strong><ul>${doc.sourcePaths.map((path) => `<li>${escapeHtml(path)}</li>`).join('')}</ul></details>
    <form id="page-form" class="page-controls"><button type="button" class="icon-button" data-action="page" data-number="${page.pageNumber - 1}" aria-label="Page précédente" ${page.pageNumber === 1 ? 'disabled' : ''}>${icon('arrow', 18)}</button><label for="page-number">Page physique</label><input id="page-number" type="number" min="1" max="${doc.pageCount}" value="${page.pageNumber}" required><span>/ ${doc.pageCount}</span><button type="submit">Lire</button><button type="button" class="icon-button" data-action="page" data-number="${page.pageNumber + 1}" aria-label="Page suivante" ${page.pageNumber === doc.pageCount ? 'disabled' : ''}>${icon('next', 18)}</button></form>
    ${pageQuality(page)}<section class="page-text" aria-label="Texte intégral extrait">${page.text.trim() ? `<pre>${escapeHtml(page.text)}</pre>` : '<p>Aucun texte extrait pour cette page. Ouvrez le PDF original : cela ne signifie pas que la page est blanche.</p>'}</section>
    <div class="citation-box"><strong>Citation · page physique ${page.pageNumber}</strong><code>${page.citation}</code><button class="outline-action" data-action="copy">Copier la référence</button></div>`
}

function qualityScreen() {
  const stats = state.catalogue.stats
  return `<div class="page-intro"><span class="eyebrow">TRANSPARENCE</span><h1>Savoir d’où vient l’information</h1><p>La bibliothèque et cette recherche utilisent le serveur local. Dans Mon espace, Gemini peut sélectionner des citations publiques après accord explicite ; les dossiers privés ne lui sont pas transmis.</p></div>
    ${statsCards(stats)}
    <section class="info-card"><h2>Un inventaire, pas une certification</h2><dl><dt>Fichiers PDF</dt><dd>${stats.sourceFiles}</dd><dt>Copies binaires supplémentaires</dt><dd>${stats.duplicateFiles}</dd><dt>Pages OCR non revues</dt><dd>${stats.unreviewedOcr}</dd><dt>Pages à faible confiance OCR</dt><dd>${stats.lowConfidence}</dd><dt>Pages sans texte extrait</dt><dd>${stats.emptyPages}</dd></dl><p>Les textes répétés dans plusieurs recueils ne sont pas dédupliqués juridiquement. Deux fichiers différents peuvent contenir la même disposition.</p></section>
    <section class="info-card"><h2>Comment fonctionne l’assistant ?</h2><p>Un moteur local classe les pages par pertinence lexicale. Il affiche jusqu’à six passages avec leur document, leur page physique et leur identifiant de citation. Il ne génère pas de conseil juridique et n’utilise pas de modèle de langage.</p><p>La recherche ignore les accents et rapproche certains pluriels. Elle n’effectue ni traduction automatique ni consolidation des lois modifiées.</p></section>
    <section class="info-card"><h2>Points de vigilance</h2><ul><li>Les projets ne sont pas des textes adoptés ; ils sont exclus de la recherche par défaut.</li><li>Les rapports, statistiques, bulletins et marchés publics ne prouvent pas qu’une règle est en vigueur aujourd’hui.</li><li>Les montants, dates, références et tableaux OCR doivent être contrôlés sur le PDF.</li><li>Le fichier de nomination intitulé « ART » concerne en réalité l’API : l’intitulé d’affichage est corrigé, le fichier original est conservé.</li><li>L’alias « Loi 2013-013 » est regroupé avec la loi 2010/013.</li></ul></section>
    <section class="info-card"><h2>Vos données</h2><p>Les favoris restent dans ce navigateur. Les questions documentaires ne sont pas enregistrées. Mon espace conserve les dossiers, justificatifs et évaluations sur le serveur Django avec accès par compte. Le mode Gemini envoie seulement la question déclarée publique et des passages publics sélectionnés ; aucun accès web n’est fourni au modèle.</p><button class="outline-action" data-action="clear-favorites">Effacer mes favoris</button></section>`
}

function render() {
  if (state.route.name === 'workspace') {
    document.querySelector('#app').innerHTML = `${header()}<main class="screen" id="main-content"><div id="workspace-root"></div></main>${bottomNav()}`
    mountWorkspace(document.querySelector('#workspace-root'))
    return
  }
  const screens = {
    home: homeScreen, library: () => libraryScreen(), assistant: assistantScreen,
    saved: () => libraryScreen(true), quality: qualityScreen, document: documentScreen,
    unknown: () => '<div class="empty-state"><h1>Page introuvable</h1><a href="#/home">Revenir à l’accueil</a></div>',
  }
  document.querySelector('#app').innerHTML = `${header()}<main class="screen" id="main-content">${storageError ? `<div class="error-panel" role="alert">${escapeHtml(storageError)}</div>` : ''}${state.loading ? '<p class="loading-status" role="status">Indexation du corpus documentaire…</p>' : state.error ? errorPanel(state.error, 'retry-catalogue') : screens[state.route.name]()}</main>${bottomNav()}`
}

async function loadCatalogue() {
  state.loading = true
  state.error = ''
  render()
  try {
    state.catalogue = await fetchJson('/api/catalogue')
  } catch (error) {
    console.error('Chargement du corpus impossible.', error)
    state.error = `Le corpus est indisponible. Vérifiez que le serveur documentaire est démarré. ${error.message}`
  } finally {
    state.loading = false
    render()
  }
  if (state.catalogue && state.route.name === 'document') await loadPage()
}

async function loadPage() {
  const request = ++pageRequest
  const { id, page } = state.route
  state.pageLoading = true
  state.pageError = ''
  state.page = null
  render()
  try {
    const result = await fetchJson(`/api/documents/${id}/pages/${page}`)
    if (request === pageRequest) state.page = result
  } catch (error) {
    if (request === pageRequest) state.pageError = error.message
  } finally {
    if (request === pageRequest) {
      state.pageLoading = false
      render()
    }
  }
}

async function search() {
  const query = state.question.trim()
  if (query.length < 2 || query.length > 300) {
    state.searchError = 'Saisissez une recherche entre 2 et 300 caractères.'
    render()
    return
  }
  searchController?.abort()
  const controller = new AbortController()
  searchController = controller
  state.searching = true
  state.searchError = ''
  state.answer = null
  render()
  try {
    const params = new URLSearchParams({ q: query, group: state.searchGroup, drafts: String(state.searchDrafts) })
    const result = await fetchJson(`/api/search?${params}`, controller.signal)
    if (!controller.signal.aborted) state.answer = result
  } catch (error) {
    if (!controller.signal.aborted) state.searchError = `Recherche impossible : ${error.message}`
  } finally {
    if (!controller.signal.aborted) {
      state.searching = false
      render()
    }
  }
}

function persistFavorites(next) {
  try {
    localStorage.setItem(storageKey, JSON.stringify(next))
    favorites = next
    storageError = ''
    showToast(next.length ? 'Favoris mis à jour dans ce navigateur.' : 'Aucun favori enregistré.')
  } catch (error) {
    console.error('Enregistrement des favoris impossible.', error)
    storageError = 'Impossible d’enregistrer les favoris. Vérifiez les autorisations de stockage du navigateur.'
  }
  render()
}

function showToast(message) {
  const toast = document.querySelector('#toast') || document.body.appendChild(Object.assign(document.createElement('div'), { id: 'toast', className: 'toast' }))
  toast.setAttribute('role', 'status')
  toast.textContent = message
  toast.classList.add('visible')
  clearTimeout(toastTimer)
  toastTimer = setTimeout(() => toast.classList.remove('visible'), 3000)
}

document.addEventListener('input', (event) => {
  if (event.target.id === 'question') state.question = event.target.value
})
document.addEventListener('change', (event) => {
  const { id, value, checked } = event.target
  if (id === 'library-group') state.libraryGroup = value
  else if (id === 'library-drafts') state.libraryDrafts = checked
  else if (id === 'search-group') state.searchGroup = value
  else if (id === 'search-drafts') state.searchDrafts = checked
  else return
  if (id.startsWith('library')) {
    state.visible = 12
    render()
  }
})
document.addEventListener('submit', (event) => {
  event.preventDefault()
  if (event.target.id === 'assistant-form') void search()
  if (event.target.id === 'library-form') {
    state.libraryQuery = document.querySelector('#library-query').value.trim()
    state.visible = 12
    render()
  }
  if (event.target.id === 'page-form') navigate(`/document/${state.route.id}/${document.querySelector('#page-number').value}`)
})
document.addEventListener('click', async (event) => {
  const button = event.target.closest('[data-action]')
  if (!button) return
  const { action, id, query, number } = button.dataset
  if (action === 'ask') {
    state.question = query
    navigate('/assistant')
    await search()
  } else if (action === 'favorite') persistFavorites(favorites.includes(id) ? favorites.filter((value) => value !== id) : [...favorites, id])
  else if (action === 'clear-favorites') persistFavorites([])
  else if (action === 'more') { state.visible += 12; render() }
  else if (action === 'retry-catalogue') await loadCatalogue()
  else if (action === 'retry-search') await search()
  else if (action === 'retry-page') await loadPage()
  else if (action === 'page') navigate(`/document/${state.route.id}/${number}`)
  else if (action === 'back') navigate(documentOrigin)
  else if (action === 'copy') {
    try {
      const page = state.page
      await navigator.clipboard.writeText(`${page.document.title}\n${page.document.sourcePaths[0]}\nPage physique ${page.pageNumber}\n${page.citation}\n${new URL(page.pdfUrl, location.origin)}`)
      showToast('Référence copiée avec son document et sa page.')
    } catch (error) {
      console.error('Copie impossible.', error)
      showToast('Copie indisponible. Sélectionnez la référence affichée pour la copier.')
    }
  }
})
window.addEventListener('hashchange', () => {
  ++pageRequest
  const next = readRoute()
  if (next.name === 'document' && !['document', 'unknown'].includes(state.route.name)) {
    documentOrigin = `/${state.route.name}`
  }
  state.route = next
  if (state.route.name === 'document' && state.catalogue) void loadPage()
  else render()
  window.scrollTo({ top: 0 })
})
void loadCatalogue()
