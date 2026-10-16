import './workspace.css'
import { startDictation } from './speech.js'

const esc = (value) => String(value ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c])
const activities = { telecom: 'Télécoms / fournisseur', installation: 'Installation de réseaux', logiciel: 'Logiciels et informatique', commerce: 'Vente d’équipements', consommateur: 'Consommateur', autre: 'À qualifier' }
const kinds = { particulier: 'Particulier', entreprise: 'Entreprise', independant: 'Indépendant', cabinet: 'Cabinet / agence', investisseur: 'Investisseur' }
const statuses = { preparation: 'En préparation', pret: 'Prêt à déposer', depot_declare: 'Dépôt déclaré', instruction_declaree: 'Instruction déclarée', complement: 'Complément demandé', decision: 'Décision déclarée', refuse: 'Refus déclaré', archive: 'Archivé' }
const categories = { initial: 'Initial', annuel: 'Annuel', renouvellement: 'Renouvellement', garantie: 'Garantie', commercial: 'Prestation commerciale' }
const options = (items, selected) => Object.entries(items).map(([key, label]) => `<option value="${esc(key)}" ${key === selected ? 'selected' : ''}>${esc(label)}</option>`).join('')
const money = (value) => value === null ? 'À déterminer' : `${Number(value).toLocaleString('fr-FR', { maximumFractionDigits: 2 })} FCFA`
const s = { user: null, csrf: '', gemini: false, cases: [], procedures: [], bulletins: [], audit: null, history: [], selected: null, error: '', notice: '', loading: true, answer: null, question: '', source: null, notifications: null, preview: null, assistantMode: 'account', assistantCase: '' }
let root
let generation = 0
let pending = false
let stopVoice = null

function stopDictation() { stopVoice?.(); stopVoice = null }
function closePreview() {
  if (s.preview?.blobUrl) URL.revokeObjectURL(s.preview.blobUrl)
  s.preview = null
}
window.addEventListener('hashchange', () => { stopDictation(); closePreview() })

function clearPrivateState() {
  stopDictation()
  closePreview()
  Object.assign(s, { user: null, cases: [], audit: null, answer: null, source: null, selected: null, question: '', history: [], bulletins: [], procedures: [], notifications: null, preview: null, assistantMode: 'account', assistantCase: '' })
}

async function api(path, method = 'GET', data) {
  const headers = { Accept: 'application/json' }
  if (method !== 'GET') headers['X-CSRFToken'] = s.csrf
  const form = data instanceof FormData
  if (data && !form) headers['Content-Type'] = 'application/json'
  const response = await fetch(`/workspace-api/${path}`, {
    method, headers, credentials: 'same-origin', body: data ? form ? data : JSON.stringify(data) : undefined,
  })
  const type = response.headers.get('content-type') || ''
  if (!type.includes('application/json')) throw new Error(`Service indisponible ou session expirée (HTTP ${response.status}). Rechargez la page.`)
  const body = await response.json()
  if (!response.ok) {
    if (response.status === 401) clearPrivateState()
    throw new Error(body.error || `Erreur HTTP ${response.status}`)
  }
  if (body.csrf) s.csrf = body.csrf
  return body
}

const panel = () => location.hash.split('/')[2] || 'accueil'
const text = (value) => `<div class="ws-prose">${esc(value)}</div>`
const warning = (message) => `<aside class="ws-warning">${esc(message)}</aside>`
const sourceButton = (source) => `<button type="button" class="ws-link" data-ws="source" data-id="${esc(source.id)}">Source : ${esc(source.title)} · ${esc(source.locator)}</button>`
const field = (label, name, value = '', type = 'text', extra = '') => `<label>${label}<input name="${name}" type="${type}" value="${esc(value)}" ${extra}></label>`
const button = (label) => `<button class="ws-primary" type="submit" ${pending ? 'disabled' : ''}>${label}</button>`

function loginScreen() {
  return `<div class="ws-intro"><span class="eyebrow">MON ESPACE PERSONNEL</span><h1>Vos démarches,<br>pas à pas.</h1><p>Un compte pour retrouver vos dossiers, vos pièces et vos échéances. Aucune administration n’est connectée.</p></div>
    <form data-ws-form="login" class="ws-card ws-form"><h2>Connexion</h2>
      ${field('Courriel', 'email', '', 'email', 'required maxlength="150" autocomplete="username"')}
      ${field('Mot de passe', 'password', '', 'password', 'required maxlength="128" autocomplete="current-password"')}
      ${button('Se connecter')}
    </form>
    <details class="ws-card"><summary>Créer mon compte</summary><form data-ws-form="register" class="ws-form">
      ${field('Courriel du nouveau compte', 'email', '', 'email', 'required maxlength="150" autocomplete="username"')}
      ${field('Nouveau mot de passe', 'password', '', 'password', 'required minlength="10" maxlength="128" autocomplete="new-password"')}
      <p>Au moins 10 caractères. Un compte n’est pas une certification de l’entreprise.</p>${button('Créer mon compte')}
    </form></details>
    <details class="ws-card"><summary>Mot de passe oublié</summary><form data-ws-form="reset" class="ws-form">
      ${field('Courriel du compte à récupérer', 'email', '', 'email', 'required')}
      ${button('Recevoir les instructions')}<p>Nécessite un serveur de courriel configuré par l’administrateur.</p>
    </form></details><a href="/admin/" class="ws-link">Administration web</a>`
}

function dashboard() {
  const alerts = s.notifications?.unread ?? 0
  const deadlines = s.cases.filter((c) => c.due_date).sort((a, b) => a.due_date.localeCompare(b.due_date))
  const expired = s.cases.flatMap((c) => c.evidence).filter((e) => e.expired)
  return `<div class="ws-intro"><span class="eyebrow">${esc(s.user.organization || kinds[s.user.kind])}</span><h1>Votre prochaine étape.</h1><p>${esc(activities[s.user.activity])} ${s.user.city ? `· ${esc(s.user.city)}` : ''}</p></div>
    <div class="ws-stats"><a href="#/workspace/dossiers"><strong>${s.cases.length}</strong>Dossiers</a><a href="#/workspace/notifications"><strong>${alerts}</strong>Alertes à lire</a><a href="#/workspace/audit"><strong>${s.audit?.summaries.reglementaire.score ?? '—'}</strong>Auto-évaluation /100</a></div>
    <a class="ws-secondary" href="#/workspace/ia">Demander à l’assistant : où en est mon entreprise ?</a>
    <section class="ws-hero"><h2>${s.cases.length ? 'Continuez votre parcours' : 'Décrivez votre activité'}</h2><p>${s.cases.length ? 'Les étapes restent déclaratives. Conservez les preuves et vérifiez le destinataire avant tout dépôt.' : 'Un développeur logiciel, un vendeur d’équipements et un opérateur n’ont pas les mêmes obligations.'}</p><a href="#/workspace/${s.cases.length ? 'dossiers' : 'profil'}">Passer à l’action →</a></section>
    ${warning('Couverture documentaire : télécoms et numérique camerounais. Les activités hors périmètre nécessitent une vérification. Aucun score ne constitue une certification.')}
    <section class="ws-card"><h2>Échéances que vous avez enregistrées</h2>${deadlines.length ? deadlines.map((c) => `<p><strong>${esc(c.due_date)}</strong> · ${esc(c.title)}</p>`).join('') : '<p>Aucune échéance saisie. Les délais légaux se trouvent dans les procédures ; vérifiez le point de départ avant de fixer votre date.</p>'}
    ${expired.length ? `<p class="ws-danger">${expired.length} justificatif(s) expiré(s) à réexaminer.</p>` : ''}</section>
    <section class="ws-card"><h2>Dernières actions</h2>${s.history.slice(0, 5).map((e) => `<p>${esc(new Date(e.created_at).toLocaleString('fr'))} · ${esc(e.action)}</p>`).join('') || '<p>Votre historique apparaîtra ici.</p>'}</section>`
}

function profileScreen() {
  return `<div class="ws-intro"><h1>Votre situation</h1><p>Ces informations personnalisent les suggestions. Elles ne sont jamais jointes aux requêtes Gemini.</p></div>
    <form class="ws-form ws-card" data-ws-form="profile">
    <label>Vous êtes<select name="kind">${options(kinds, s.user.kind)}</select></label>
    ${field('Entreprise ou projet (facultatif)', 'organization', s.user.organization, 'text', 'maxlength="160"')}
    <label>Activité principale<select name="activity">${options(activities, s.user.activity)}</select></label>
    ${field('Ville / zone du projet', 'city', s.user.city, 'text', 'maxlength="100"')}
    ${button('Enregistrer mon profil')}</form>
    ${warning('Les suggestions sont à qualifier, pas des autorisations automatiquement exigibles. Les tarifs ne changent pas en fonction de la ville sans une règle ou un devis documenté.')}
    <section class="ws-card"><h2>Compte et confidentialité</h2><p>${esc(s.user.email)}</p><p>Les justificatifs restent dans votre espace privé. Cabinet et investisseur : ce compte ne donne aucun accès aux dossiers d’autres utilisateurs.</p><button data-ws="logout" class="ws-secondary">Se déconnecter</button></section>`
}

function journeyScreen() {
  const sorted = [...s.procedures].sort((a, b) => Number(b.suggested) - Number(a.suggested) || a.id.localeCompare(b.id))
  return `<div class="ws-intro"><h1>Choisir une démarche</h1><p>${sorted.length} parcours sourcés. Les suggestions ne remplacent pas la qualification de votre activité.</p></div>
    <label>Filtrer les démarches<input id="ws-procedure-filter" placeholder="Agrément, licence, plainte…" type="search"></label>
    <div id="ws-procedure-list">${sorted.map((p) => `<details class="ws-card ws-procedure" data-search="${esc(p.title.toLocaleLowerCase('fr'))}">
      <summary><span class="ws-tag">${esc(p.id)} ${p.suggested ? '· À examiner pour votre profil' : ''}</span><strong>${esc(p.title)}</strong></summary>
      ${text(p.description)}${sourceButton(p.source)}
      ${warning('Parcours indicatif. Confirmer les pièces, les frais et le service compétent. Préparation locale uniquement, aucun dépôt officiel.')}
      <button type="button" class="ws-primary" data-ws="create" data-id="${esc(p.id)}">Préparer ce dossier</button></details>`).join('')}</div>`
}

function casesScreen() {
  const item = s.cases.find((c) => c.id === s.selected)
  if (!item) return `<div class="ws-intro"><h1>Mes dossiers</h1><p>Progression enregistrée dans votre compte, disponible après reconnexion.</p></div><a class="ws-primary" href="#/workspace/parcours">Nouvelle démarche</a>
    ${s.cases.map((c) => `<button type="button" class="ws-card ws-case" data-ws="open" data-id="${c.id}"><span class="ws-tag">${esc(statuses[c.status])}</span><strong>${esc(c.title)}</strong><span>${c.steps.filter((x) => x.done).length}/${c.steps.length} étapes déclarées · ${c.evidence.length} pièce(s)</span>${c.outdated ? '<span class="ws-danger">Référentiel modifié — à réexaminer</span>' : ''}</button>`).join('') || '<p class="ws-card">Aucun dossier. Commencez par une démarche.</p>'}`
  return `<button data-ws="back" class="ws-link">← Tous mes dossiers</button><div class="ws-intro"><span class="eyebrow">${esc(item.procedure)} · VERSION ${item.version}</span><h1>${esc(item.title)}</h1></div>
    ${item.outdated ? `${warning('La procédure ou sa source a changé. Votre version initiale est conservée.')}<button class="ws-primary" data-ws="prepare-update" data-id="${item.id}">Préparer la mise à jour avec l’assistant</button>` : ''}
    <details class="ws-card"><summary>Procédure enregistrée et source</summary>${text(item.description)}${sourceButton(item.source)}</details>
    <form class="ws-card ws-form" data-ws-form="case" data-id="${item.id}"><h2>Votre progression</h2>
      ${item.steps.map((step, i) => `<label class="ws-check"><input type="checkbox" name="step-${i}" ${step.done ? 'checked' : ''}>${esc(step.label)}</label>`).join('')}
      <label>Statut déclaré<select name="status">${options(statuses, item.status)}</select></label>
      ${field('Référence du dépôt ou de la décision', 'receipt', item.receipt, 'text', 'maxlength="200"')}
      ${field('Votre prochaine échéance', 'due_date', item.due_date || '', 'date')}
      ${button('Enregistrer ma progression')}<p>Aucune transmission à l’administration. Les étapes cochées ne prouvent pas la conformité.</p>
    </form>
    <section class="ws-card"><h2>Justificatifs privés</h2><p>PDF, PNG ou JPEG, 10 Mo maximum. Téléchargement protégé ; aucune analyse de ces fichiers par Gemini.</p>
      ${item.evidence.map((e) => `<div class="ws-file"><a href="${esc(e.url)}">${esc(e.name)}</a><small>${e.superseded ? 'ANCIENNE VERSION — remplacée · ' : ''}${e.expires_on ? `Expiration : ${esc(e.expires_on)}` : 'Expiration non renseignée'} ${e.expired ? '— EXPIRÉ' : ''}</small><button data-ws="preview" data-id="${e.id}" class="ws-secondary">Visualiser ${esc(e.name)}</button><button data-ws="delete-evidence" data-id="${e.id}" class="ws-link">Supprimer cette pièce</button></div>`).join('') || '<p>Aucun justificatif.</p>'}
      <form class="ws-form" data-ws-form="upload" data-id="${item.id}"><label>Ajouter un document<input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg" required></label>
        <label>Document à remplacer<select name="replace"><option value="">Ajouter sans remplacer</option>${item.evidence.filter((e) => !e.superseded).map((e) => `<option value="${e.id}">${esc(e.name)}</option>`).join('')}</select></label>
        <p>Un remplacement conserve l’ancienne pièce pour consultation. Les contrôles qui l’utilisaient sont à réévaluer ; le nouveau fichier n’est pas certifié.</p>
        ${field('Date d’expiration (si applicable)', 'expires_on', '', 'date')}${button('Ajouter la pièce')}</form>
    </section>
    ${item.revisions?.length ? `<details class="ws-card"><summary>Historique des mises à jour confirmées</summary>${item.revisions.map((r) => `<h3>${esc(new Date(r.at).toLocaleString('fr'))}</h3><p>Version précédente : ${r.before.version}</p>${text(r.before.description)}${text(JSON.stringify(r.before.steps, null, 2))}`).join('')}</details>` : ''}
    <section class="ws-card"><h2>Budget du dossier</h2><p>Montants saisis par vous, sans liquidation officielle. Les taxes et périodicités restent séparées.</p>
      ${item.budget.map((l) => `<div class="ws-file"><strong>${esc(l.label)} · ${money(l.amount)}</strong><small>${esc(categories[l.category])} · ${esc(l.tax)} · ${esc(l.basis)}</small><button data-ws="delete-budget" data-id="${l.id}" class="ws-link">Retirer cette ligne</button></div>`).join('')}
      ${Object.entries(item.totals).map(([k, v]) => `<p><strong>Sous-total ${esc(k)} : ${money(v)}</strong></p>`).join('')}
      <p>${item.unknown_amounts} poste(s) de montant inconnu. Aucun total mélangeant frais annuels, garanties et coûts initiaux.</p>
      <form class="ws-form" data-ws-form="budget" data-id="${item.id}">${field('Poste de dépense', 'label', '', 'text', 'required maxlength="160"')}
        ${field('Montant FCFA (vide si inconnu)', 'amount', '', 'number', 'min="0" max="999999999999.99" step="0.01"')}
        <label>Nature<select name="category">${options(categories, 'initial')}</select></label>
        <label>Taxes<select name="tax">${options({ inconnu: 'À confirmer', HT: 'HT', TTC: 'TTC' }, 'inconnu')}</select></label>
        ${field('Source, devis, période et zone concernés', 'basis', '', 'text', 'required maxlength="300"')}${button('Ajouter au budget')}</form>
    </section>`
}

function auditScreen() {
  const a = s.audit
  if (!a) return warning('Audit indisponible. Réessayez le chargement de votre espace.')
  const evidence = s.cases.flatMap((c) => c.evidence).filter((e) => !e.superseded)
  return `<div class="ws-intro"><h1>Mes points à vérifier</h1><p>Auto-évaluation avec justificatifs. Les exclusions sont déclarées et attribuées à votre compte, pas validées par une autorité.</p></div>
    ${warning('Les exigences réglementaires et la préparation d’un marché sont évaluées séparément. Un contrôle critique non démontré bloque la conclusion « prêt ». Aucun texte n’est certifié actuel par ce score.')}
    ${Object.entries(a.groups).map(([name, controls]) => {
      const summary = a.summaries[name]
      return `<section class="ws-card"><h2>${name === 'marche' ? 'Préparation d’un marché' : 'Périmètre réglementaire'}</h2><p><strong>${summary.score === null ? 'Non évalué' : `${summary.score} % démontré — provisoire`}</strong></p><p>Couverture : ${summary.coverage ?? '—'} % · ${summary.blocking} point(s) critique(s) non démontré(s).</p></section>
        ${controls.map((c) => `<details class="ws-card"><summary><span class="ws-tag">${esc(c.id)} · ${c.critical ? 'CRITIQUE' : esc(c.domain)}</span>${esc(c.text)}</summary>
        <p>${esc(c.condition)}</p><small>${esc(c.source)}</small>${c.proof_invalid ? warning('La preuve a expiré ou a été remplacée. Ce contrôle est à réexaminer.') : ''}
        <form class="ws-form" data-ws-form="audit" data-id="${esc(c.id)}">
          <label>Applicabilité<select name="applicability">${options({ A_DETERMINER: 'À déterminer', OUI: 'Applicable', NON: 'Non applicable — à justifier' }, c.applicability)}</select></label>
          <label>Résultat déclaré<select name="status">${options({ NON_EVALUE: 'Non évalué', CONFORME: 'Conforme avec preuve', NON_CONFORME: 'Non conforme établi' }, c.status)}</select></label>
          <label>Justificatif<select name="evidence"><option value="">Aucun</option>${evidence.map((e) => `<option value="${e.id}" ${e.id === c.evidence ? 'selected' : ''}>${esc(e.name)} ${e.expired ? '(expiré)' : ''}</option>`).join('')}</select></label>
          <label>Justification / périmètre examiné<textarea name="justification" maxlength="2000">${esc(c.justification)}</textarea></label>
          ${button('Enregistrer le contrôle')}
        </form></details>`).join('')}`
    }).join('')}`
}

function watchScreen() {
  return `<div class="ws-intro"><h1>Les changements pertinents</h1><p>Fiches relues et publiées par l’administrateur, ciblées sur votre activité. Actualisation à l’ouverture ou avec le bouton ci-dessous ; pas de flux ministériel en direct.</p></div><button data-ws="refresh" class="ws-secondary">Actualiser la veille</button>
    ${s.bulletins.map((b) => `<article class="ws-card"><span class="ws-tag">${b.read ? 'Lu' : 'À lire'} · Révision ${b.revision}</span><h2>${esc(b.title)}</h2>
      ${text(b.body)}<h3>Ce que vous devez vérifier ou faire</h3>${text(b.action)}<h3>Conséquence documentée</h3>${text(b.consequence)}
      <p>Entrée en vigueur : ${esc(b.effective_on || 'Non établie')}. Publication dans l’application : ${esc(new Date(b.published_at).toLocaleString('fr'))}.</p>
      ${sourceButton(b.source)}${!b.read ? `<button data-ws="read" data-id="${b.id}" class="ws-secondary">Marquer comme lu</button>` : ''}</article>`).join('') || '<p class="ws-card">Aucune fiche publiée pour votre profil. Cela ne signifie pas qu’aucun texte n’a changé.</p>'}`
}

function scoreCards(summaries) {
  if (!summaries) return ''
  return Object.entries(summaries).map(([key, value]) => `<section class="ws-card"><h3>${key === 'reglementaire' ? 'Conformité réglementaire' : 'Préparation des marchés'}</h3><strong>${value.score === null ? 'Non évalué' : `${value.score} % démontré`}</strong><p>Couverture : ${value.coverage ?? '—'} % · ${value.blocking} point(s) critique(s) non démontré(s).</p><a href="#/workspace/audit">Vérifier les contrôles et les preuves</a></section>`).join('')
}

function alertCards(items) {
  return items.map((n) => `<article class="ws-card"><span class="ws-tag">${n.read ? 'Lu' : 'À lire'} · ${esc(n.kind)}</span><h2>${esc(n.title)}</h2>${text(n.message)}
    ${n.deadline ? `<p><strong>Date limite : ${esc(new Date(n.deadline).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' }))} (Douala)</strong></p>${text(n.body)}<h3>Action attendue</h3>${text(n.action)}<h3>Conséquence documentée</h3>${text(n.consequence)}<p>Contrôles demandés non démontrés : ${esc(n.missing_controls.join(', ') || (n.required_count ? 'Aucun parmi les contrôles renseignés ; vérifier le DAO complet.' : 'Exigences à qualifier.'))}</p>${scoreCards(n.summaries)}${sourceButton(n.source)}` : ''}
    ${n.case_id ? `<button class="ws-secondary" data-ws="alert-case" data-id="${n.case_id}">Ouvrir le dossier · pièces et mise à jour</button>` : `<a class="ws-secondary" href="#/workspace/${esc(n.target)}">Examiner les détails</a>`}
    ${!n.read ? `<button class="ws-link" data-ws="notification-read" data-id="${esc(n.id)}" data-revision="${esc(n.revision)}">Marquer cette alerte comme lue</button>` : ''}</article>`).join('')
}

function notificationsScreen() {
  return `<div class="ws-intro"><h1>Mes alertes et appels d’offres</h1><p>Opportunités ciblées, état de conformité et pièces à actualiser. Actualisation à l’ouverture et toutes les minutes tant que cet écran est visible.</p></div>
    <button class="ws-secondary" data-ws="refresh">Actualiser mes alertes</button>
    ${warning('Les appels d’offres sont ajoutés et relus par l’administrateur depuis vos sources. Aucun flux Internet automatique. Recevoir une alerte ne garantit pas l’éligibilité. Échéances et expirations : rappel 30 jours avant.')}
    ${s.notifications ? alertCards(s.notifications.items) || '<p class="ws-card">Aucune alerte active pour votre situation.</p>' : warning('Alertes indisponibles. Réessayez le chargement.')}`
}

function proposalCard(proposal) {
  return `<section class="ws-card ws-proposal"><h2>Votre confirmation est nécessaire</h2>${text(proposal.message)}
    <p>Proposition valable jusqu’à ${esc(new Date(proposal.expires_at).toLocaleTimeString('fr'))}.</p>
    <details><summary>Comparer avant / après</summary><h3>Avant</h3>${text(JSON.stringify(proposal.before, null, 2))}<h3>Changements proposés</h3>${text(JSON.stringify(proposal.changes, null, 2))}</details>
    <button type="button" class="ws-primary" data-ws="confirm-proposal" data-id="${esc(proposal.id)}">Confirmer et enregistrer ces changements</button>
    <button type="button" class="ws-secondary" data-ws="cancel-proposal" data-id="${esc(proposal.id)}">Annuler la proposition</button></section>`
}

function assistantScreen() {
  return `<div class="ws-intro"><span class="eyebrow">VOTRE COMPTE ET VOS SOURCES</span><h1>Comprendre avant d’agir.</h1><p>Consultez votre situation ou préparez une action en langage simple. Les données du compte sont traitées sur ce serveur, jamais transmises à Gemini.</p></div>
    <div class="ws-shortcuts">${['Mon pourcentage de conformité', 'Mes appels d’offres', 'Mes dossiers et documents', 'Mettre à jour le dossier sélectionné'].map((q) => `<button class="ws-secondary" data-ws="quick-command" data-question="${esc(q)}">${esc(q)}</button>`).join('')}</div>
    <form class="ws-card ws-form" data-ws-form="assistant"><label>Question sur les démarches ou les textes<textarea name="question" maxlength="600" required placeholder="Agrément installateur : durée et renouvellement ?">${esc(s.question)}</textarea></label>
      <label>Moteur<select name="mode">${options({ account: 'Mon entreprise — situation et actions locales', local: 'Recherche documentaire locale' }, s.assistantMode)}<option value="gemini" ${s.assistantMode === 'gemini' ? 'selected' : ''} ${!s.gemini ? 'disabled' : ''}>Gemini — sélection de citations publiques vérifiées</option></select></label>
      <label>Dossier concerné (pour une action)<select name="case_id"><option value="">Choisir un dossier</option>${s.cases.map((c) => `<option value="${c.id}" ${String(c.id) === s.assistantCase ? 'selected' : ''}>#${c.id} · ${esc(c.title)}</option>`).join('')}</select></label>
      <p>Exemple : « Échéance au 2026-12-01 » avec un dossier sélectionné. Toute modification nécessite votre confirmation.</p>
      <label class="ws-check"><input type="checkbox" name="voice_consent">J’autorise la dictée du navigateur : l’audio peut être envoyé à son fournisseur. Je ne dicte aucune donnée confidentielle.</label>
      <button type="button" class="ws-secondary" data-ws="voice">Dicter ma commande</button><p id="ws-voice-status" role="status">La dictée remplit le champ ; relisez avant d’envoyer. Aucune commande vocale n’est exécutée automatiquement.</p>
      ${!s.gemini ? '<p>Gemini non configuré côté serveur. Aucune clé n’est stockée dans le téléphone.</p>' : ''}
      <label class="ws-check"><input type="checkbox" name="public_question">Pour Gemini : ma question ne contient aucune information privée et j’autorise l’envoi de cette question et d’extraits publics à Google.</label>
      ${button(pending ? 'Traitement en cours…' : 'Envoyer à l’assistant')}
    </form>
    ${s.answer ? `<section aria-live="polite"><p class="ws-card">${esc(s.answer.message)}</p>
      ${s.answer.proposal ? proposalCard(s.answer.proposal) : ''}
      ${s.answer.notifications ? scoreCards(s.answer.notifications.summaries) : ''}
      ${s.answer.cases ? s.answer.cases.map((c) => `<div class="ws-card"><h3>${esc(c.title)}</h3><p>${esc(c.status)} · ${c.completed}/${c.total} étapes déclarées · ${c.outdated ? 'Référentiel à actualiser' : 'Version publiée à jour'}</p><p>Échéance : ${esc(c.due_date || 'Non renseignée')}</p><button class="ws-secondary" data-ws="alert-case" data-id="${c.id}">Ouvrir ce dossier</button></div>`).join('') : ''}
      ${s.answer.notifications ? alertCards(s.answer.notifications.items) : ''}
      ${s.answer.citations.map((c) => `<blockquote class="ws-card">${text(c.quote)}<small>${esc(c.id)}</small></blockquote>`).join('')}
      ${s.answer.sources.map((source) => `<details class="ws-card"><summary>${esc(source.title)} · ${esc(source.locator)}</summary>${warning(source.warning)}${text(source.text)}${sourceButton(source)}</details>`).join('')}
      <a class="ws-primary" href="#/workspace/parcours">Choisir une démarche à préparer</a></section>` : ''}`
}

function render() {
  if (!root?.isConnected) return
  const tabs = [['accueil', 'Vue d’ensemble'], ['notifications', `Alertes (${s.notifications?.unread ?? '—'})`], ['parcours', 'Démarches'], ['dossiers', 'Dossiers'], ['ia', 'Assistant IA'], ['audit', 'Audit'], ['veille', 'Veille'], ['profil', 'Profil']]
  const screens = { accueil: dashboard, notifications: notificationsScreen, parcours: journeyScreen, dossiers: casesScreen, ia: assistantScreen, audit: auditScreen, veille: watchScreen, profil: profileScreen }
  root.innerHTML = `${s.error ? `<div class="error-panel" role="alert">${esc(s.error)} <button class="ws-link" data-ws="refresh">Réessayer</button></div>` : ''}${s.notice ? `<p class="ws-success" role="status">${esc(s.notice)}</p>` : ''}
    ${s.loading ? '<p role="status">Chargement de votre espace…</p>' : s.user ? `<nav class="ws-tabs" aria-label="Mon espace">${tabs.map(([id, title]) => `<a href="#/workspace/${id}" ${panel() === id ? 'aria-current="page"' : ''}>${title}</a>`).join('')}</nav><p id="ws-notification-status" role="status"></p>
      ${s.preview ? `<section class="ws-card" aria-label="Visualisation du document"><button class="ws-link" data-ws="close-preview">Fermer le document</button><h2>${esc(s.preview.name)}</h2>${s.preview.mime.startsWith('image/') ? `<img class="ws-preview-image" alt="${esc(s.preview.name)}" src="${esc(s.preview.blobUrl)}">` : `<iframe class="ws-preview" title="${esc(s.preview.name)}" src="${esc(s.preview.blobUrl)}"></iframe>`}<p>Si votre navigateur ne peut pas afficher ce document, <a href="${esc(s.preview.url)}">téléchargez-le pour l’ouvrir</a>. Authenticité non vérifiée.</p></section>` : ''}
      ${s.source ? `<section class="ws-card"><button class="ws-link" data-ws="close-source">Fermer la source</button><h2>${esc(s.source.title)}</h2>${warning(s.source.warning)}${text(s.source.text)}<p>Empreinte : <code>${esc(s.source.version)}</code></p>${s.source.url ? `<a href="${esc(s.source.url)}" target="_blank" rel="noopener">Ouvrir le PDF local</a>` : ''}</section>` : ''}
      ${(screens[panel()] || dashboard)()}${s.user.staff ? '<a href="/admin/" class="ws-admin">Ouvrir l’administration web →</a>' : ''}` : loginScreen()}`
}

async function refresh() {
  const token = ++generation
  const session = await api('session/')
  if (token !== generation || !root?.isConnected) return
  if (s.user?.email !== session.user?.email || !session.user) clearPrivateState()
  s.user = session.user
  s.gemini = session.gemini_configured
  if (s.user) {
    const [cases, procedures, bulletins, audit, history, notifications] = await Promise.all([
      api('cases/'), api(`procedures/?activity=${encodeURIComponent(s.user.activity)}`),
      api('bulletins/'), api('audit/'), api('history/'), api('notifications/'),
    ])
    if (token !== generation || !root?.isConnected) return
    Object.assign(s, { cases: cases.cases, procedures: procedures.procedures, bulletins: bulletins.bulletins, audit, history: history.events, notifications })
    if (s.preview && !s.cases.some((c) => c.evidence.some((e) => e.id === s.preview.id))) closePreview()
  }
  s.loading = false
}

async function act(operation) {
  if (pending) return
  pending = true
  s.error = ''
  s.notice = ''
  root?.querySelectorAll('button[type="submit"]').forEach((b) => { b.disabled = true })
  try { await operation() } catch (error) {
    console.error('Opération espace impossible :', error.message)
    s.error = error.message
    s.loading = false
  } finally { pending = false; render() }
}

async function submit(event) {
  const form = event.target.closest('[data-ws-form]')
  if (!form) return
  stopDictation()
  event.preventDefault()
  const data = new FormData(form)
  const values = Object.fromEntries(data)
  const type = form.dataset.wsForm
  await act(async () => {
    if (type === 'login' || type === 'register') {
      const result = await api(`${type}/`, 'POST', values)
      clearPrivateState()
      s.user = result.user
      s.selected = null
      s.answer = null
      await refresh()
      s.notice = type === 'register' ? 'Compte créé. Complétez votre profil pour commencer.' : 'Connexion réussie.'
      if (type === 'register') location.hash = '/workspace/profil'
    } else if (type === 'reset') {
      const result = await api('password-reset/', 'POST', values)
      s.notice = result.message
    } else if (type === 'profile') {
      await api('profile/', 'POST', values); await refresh(); s.notice = 'Profil enregistré.'
    } else if (type === 'case') {
      const item = s.cases.find((c) => c.id === Number(form.dataset.id))
      await api(`cases/${item.id}/`, 'POST', { ...values, done: item.steps.map((_, i) => data.has(`step-${i}`)) })
      await refresh(); s.notice = 'Progression déclarée enregistrée.'
    } else if (type === 'upload') {
      await api(`cases/${form.dataset.id}/evidence/`, 'POST', data)
      await refresh(); s.notice = 'Justificatif enregistré. Authenticité non vérifiée.'
    } else if (type === 'budget') {
      await api(`cases/${form.dataset.id}/budget/`, 'POST', values)
      await refresh(); s.notice = 'Ligne ajoutée au budget.'
    } else if (type === 'audit') {
      s.audit = await api('audit/', 'POST', { ...values, control: form.dataset.id })
      s.notifications = await api('notifications/')
      s.notice = 'Auto-évaluation enregistrée.'
    } else if (type === 'assistant') {
      s.question = values.question
      s.assistantMode = values.mode
      s.assistantCase = values.case_id
      s.answer = null
      s.answer = await api('assistant/', 'POST', { ...values, public_question: data.has('public_question') })
    }
  })
}

async function click(event) {
  const target = event.target.closest('[data-ws]')
  if (!target) return
  const { ws, id } = target.dataset
  if (ws === 'voice') {
    if (stopVoice) { stopDictation(); return }
    const form = target.closest('form')
    const status = form.querySelector('#ws-voice-status')
    stopVoice = startDictation({
      consent: form.elements.voice_consent.checked,
      onText: (transcript) => {
        if (!form.isConnected) return
        const value = `${form.elements.question.value} ${transcript}`.trim()
        if (value.length > 600) { status.textContent = 'Commande trop longue : 600 caractères maximum. Raccourcissez le texte.'; return }
        form.elements.question.value = value
        s.question = value
      },
      onState: (active) => {
        target.textContent = active ? 'Arrêter la dictée' : 'Dicter ma commande'
        if (active) status.textContent = 'Écoute en cours… ne dictez aucune information confidentielle.'
        else { stopVoice = null; if (status.textContent.startsWith('Écoute')) status.textContent = 'Dictée terminée. Relisez et envoyez votre commande.' }
      },
      onError: (message) => { console.error('Dictée :', message); status.textContent = message },
    })
    return
  }
  if (ws === 'quick-command') {
    stopDictation(); s.question = target.dataset.question; s.assistantMode = 'account'; render(); return
  }
  if (ws.startsWith('delete-') && !window.confirm('Supprimer cet élément de votre espace ? Cette action est irréversible.')) return
  await act(async () => {
    if (ws === 'logout') {
      await api('logout/', 'POST', {})
      clearPrivateState()
    } else if (ws === 'notification-read') {
      s.notifications = await api('notifications/', 'POST', { id, revision: target.dataset.revision })
      if (s.answer?.notifications) s.answer.notifications = s.notifications
    } else if (ws === 'alert-case') {
      s.selected = Number(id); closePreview(); await refresh(); location.hash = '/workspace/dossiers'
    } else if (ws === 'preview') {
      const proof = s.cases.flatMap((c) => c.evidence).find((e) => e.id === Number(id))
      const response = await fetch(proof.preview_url, { credentials: 'same-origin', cache: 'no-store' })
      if (!response.ok) {
        if (response.status === 401) clearPrivateState()
        throw new Error(`Visualisation impossible (HTTP ${response.status}). Reconnectez-vous ou actualisez le dossier.`)
      }
      const mime = response.headers.get('content-type').split(';')[0]
      if (!['application/pdf', 'image/png', 'image/jpeg'].includes(mime)) throw new Error('Format non visualisable.')
      const blob = await response.blob()
      closePreview()
      s.preview = { ...proof, mime, blobUrl: URL.createObjectURL(blob) }
    } else if (ws === 'close-preview') closePreview()
    else if (ws === 'prepare-update') {
      s.assistantMode = 'account'; s.assistantCase = id; s.question = 'Mettre à jour le dossier sélectionné'
      s.answer = await api('assistant/', 'POST', { mode: 'account', question: s.question, case_id: id })
      location.hash = '/workspace/ia'
    } else if (ws === 'confirm-proposal' || ws === 'cancel-proposal') {
      const result = await api(`proposals/${id}/confirm/`, 'POST', ws === 'confirm-proposal' ? { confirm: true } : { cancel: true })
      s.answer = null
      if (result.case) { s.selected = result.case.id; await refresh(); location.hash = '/workspace/dossiers' }
      s.notice = result.case ? 'Mise à jour enregistrée après votre confirmation. Aucune transmission officielle.' : 'Proposition annulée. Aucun dossier modifié.'
    } else if (ws === 'create') {
      const result = await api('cases/', 'POST', { procedure: id }); s.selected = result.case.id
      await refresh(); location.hash = '/workspace/dossiers'; s.notice = 'Dossier préparé dans votre espace. Aucun dépôt officiel.'
    } else if (ws === 'open') s.selected = Number(id)
    else if (ws === 'back') s.selected = null
    else if (ws === 'source') s.source = await api(`source/${encodeURIComponent(id)}/`)
    else if (ws === 'close-source') s.source = null
    else if (ws === 'delete-evidence') { await api(`evidence/${id}/`, 'DELETE'); await refresh() }
    else if (ws === 'delete-budget') { await api(`budget/${id}/`, 'DELETE'); await refresh() }
    else if (ws === 'read') { await api('bulletins/', 'POST', { id: Number(id) }); await refresh() }
    else if (ws === 'refresh') await refresh()
  })
}

export function mountWorkspace(element) {
  stopDictation()
  root = element
  s.loading = true
  s.error = ''
  root.addEventListener('submit', (event) => { void submit(event) })
  root.addEventListener('click', (event) => { void click(event) })
  root.addEventListener('input', (event) => {
    if (event.target.closest('[data-ws-form="assistant"]')) {
      const form = event.target.form
      s.question = form.elements.question.value
      s.assistantMode = form.elements.mode.value
      s.assistantCase = form.elements.case_id.value
    }
    if (event.target.id !== 'ws-procedure-filter') return
    const query = event.target.value.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
    root.querySelectorAll('.ws-procedure').forEach((item) => {
      item.hidden = !item.dataset.search.normalize('NFD').replace(/\p{M}/gu, '').includes(query)
    })
  })
  render()
  void refresh().catch((error) => {
    console.error('Chargement espace impossible :', error.message)
    s.error = error.message
    s.loading = false
  }).finally(render)
}

setInterval(async () => {
  if (!root?.isConnected || !s.user || s.loading || pending || stopVoice || document.visibilityState !== 'visible') return
  const user = s.user.email
  const token = generation
  try {
    const notifications = await api('notifications/')
    if (token !== generation || s.user?.email !== user || !root?.isConnected) return
    s.notifications = notifications
    if (panel() === 'notifications') render()
    else {
      const badge = root.querySelector('a[href="#/workspace/notifications"]')
      if (badge) badge.textContent = `Alertes (${notifications.unread})`
      const status = root.querySelector('#ws-notification-status')
      if (status) status.textContent = ''
    }
  } catch (error) {
    console.error('Actualisation des alertes :', error.message)
    if (!s.user) render()
    else {
      const status = root?.querySelector('#ws-notification-status')
      if (status) status.textContent = `Alertes non actualisées : ${error.message}`
    }
  }
}, 60000)
