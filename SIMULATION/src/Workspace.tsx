import { useState } from 'react'
import type { FormEvent, ReactNode } from 'react'
import { Alert, Button, Checkbox, Dialog, DialogActions, DialogContent, DialogTitle, FormControlLabel, TextField } from '@mui/material'
import {
  ArrowForwardRounded, ArrowOutwardRounded, AutoAwesomeRounded, AccountBalanceOutlined,
  AssignmentOutlined, CheckRounded, ChevronRightRounded, CloseRounded, DescriptionOutlined,
  GridViewRounded, HelpOutlineRounded, LocalOfferOutlined, MenuRounded, NotificationsNoneRounded,
  RadarRounded, SearchRounded, SendRounded, ShieldOutlined, WifiRounded,
  ScheduleRounded, AddRounded, NorthEastRounded,
} from '@mui/icons-material'
import { useAppTheme } from './theme-context'
import type { Dossier } from './dossiers'
import './Workspace.css'

const navigation = [
  { path: '/', label: "Vue d’ensemble", icon: GridViewRounded },
  { path: '/assistant', label: 'Mon assistant IA', icon: AutoAwesomeRounded },
  { path: '/dossiers', label: 'Mes démarches', icon: AssignmentOutlined },
  { path: '/institutions', label: 'Institutions', icon: AccountBalanceOutlined },
  { path: '/veille', label: 'Veille réglementaire', icon: RadarRounded },
  { path: '/offres', label: 'Appels d’offres', icon: DescriptionOutlined },
  { path: '/audit', label: 'Audit & conformité', icon: ShieldOutlined },
  { path: '/tarifs', label: 'Tarifs des prestations', icon: LocalOfferOutlined },
]
const tenders = [
  { id: 'AO-DEMO-01', title: 'Déploiement d’un réseau de fibre optique', organization: 'Infrastructure numérique', category: 'Réseaux', budget: '85 000 000', remaining: '12 jours', icon: WifiRounded },
  { id: 'AO-DEMO-02', title: 'Fourniture d’équipements de télécommunication', organization: 'Équipements & services', category: 'Équipements', budget: '32 000 000', remaining: '18 jours', icon: AssignmentOutlined },
  { id: 'AO-DEMO-03', title: 'Audit de la qualité des services mobiles', organization: 'Qualité de service', category: 'Conseil', budget: '24 000 000', remaining: '24 jours', icon: ShieldOutlined },
]
const auditItems = ['Périmètre de mon activité identifié', 'Autorisations applicables recensées', 'Conditions tarifaires documentées', 'Procédure de réclamation définie', 'Pièces administratives rassemblées']
const responseItems = ['Lire le dossier d’appel d’offres officiel', 'Vérifier les critères d’éligibilité', 'Rassembler les pièces administratives', 'Préparer l’offre technique et financière', 'Vérifier le délai et le canal de dépôt']
const updates = [
  { tag: 'AUTORISATIONS', title: 'Votre autorisation d’activité est-elle à jour ?', text: 'Identifiez les pièces et échéances à vérifier pour votre activité télécom.', icon: ShieldOutlined, color: 'orange' },
  { tag: 'QUALITÉ DE SERVICE', title: 'Faites le point sur vos engagements clients', text: 'Organisez le suivi des réclamations et la qualité de vos prestations.', icon: WifiRounded, color: 'green' },
  { tag: 'MARCHÉS PUBLICS', title: 'Anticipez votre prochaine candidature', text: 'Préparez votre dossier avant la publication d’une opportunité.', icon: DescriptionOutlined, color: 'blue' },
]

function PanelHeading({ title, subtitle, href, action = 'Tout voir' }: { title: string; subtitle?: string; href?: string; action?: string }) {
  return <div className="ws-panel-heading"><div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>{href && <a href={href}>{action}<ArrowForwardRounded /></a>}</div>
}

function DemoBadge() {
  return <span className="ws-demo-badge">Démonstration</span>
}

function getAnswer(question: string) {
  const normalized = question.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
  if (/decret|loi|reglement|sanction/.test(normalized)) return 'Pour analyser un nouveau texte : 1. Retrouvez sa publication officielle et sa date d’entrée en vigueur. 2. Vérifiez les activités concernées et les dispositions transitoires. 3. Identifiez les obligations et leur échéance. 4. Faites confirmer les sanctions par un juriste à partir des articles applicables. Aucun nouveau décret ni aucune sanction ne sont vérifiés ici. Consultez l’ART, le MINPOSTEL et les publications officielles avant toute décision.'
  if (/offre|marche|candidature/.test(normalized)) return 'Pour préparer une réponse : consultez le dossier officiel de l’appel d’offres, vérifiez votre éligibilité, rassemblez les pièces demandées, préparez vos offres technique et financière, puis contrôlez les modalités et la date limite de dépôt. L’espace Appels d’offres propose une checklist de démonstration ; aucun dépôt n’est effectué par cette application.'
  if (/prix|tarif|prestation/.test(normalized)) return 'Dans Tarifs des prestations, comparez votre prix à une référence que vous renseignez vous-même. Vérifiez la source, la date, la devise, les taxes et le périmètre de la prestation. Un écart de prix ne prouve pas une non-conformité : aucun tarif officiel n’est intégré dans ce prototype.'
  if (/audit|conform|satisfaction/.test(normalized)) return 'Commencez par l’auto-évaluation dans Audit & conformité. Elle mesure uniquement la préparation de votre dossier, pas votre conformité légale. Pour évaluer la satisfaction, recueillez de vrais avis clients avec leur consentement et documentez la méthode. Le score de satisfaction reste indisponible tant que ces données ne sont pas collectées.'
  return 'Je peux vous orienter vers une institution camerounaise, préparer une checklist d’appel d’offres, organiser un audit ou comparer des tarifs. Pour une démarche administrative, ouvrez Institutions, sélectionnez le ministère puis consultez ses ressources. Cette réponse est un guide prédéfini de démonstration, pas une réponse d’IA connectée ni un avis juridique.'
}

export default function Workspace({ route, dossiers }: { route: string; dossiers: Dossier[] }) {
  const { preference, setPreference } = useAppTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [dialog, setDialog] = useState<'notifications' | 'help' | 'update' | null>(null)
  const [selectedUpdate, setSelectedUpdate] = useState(0)
  const [selectedTender, setSelectedTender] = useState<(typeof tenders)[number] | null>(null)
  const [category, setCategory] = useState('Tous')
  const [search, setSearch] = useState('')
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<{ question: string; answer: string }[]>([])
  const [audit, setAudit] = useState<string[]>([])
  const [checklists, setChecklists] = useState<Record<string, string[]>>({})
  const [price, setPrice] = useState('')
  const [reference, setReference] = useState('')
  const [comparison, setComparison] = useState('')
  const [priceError, setPriceError] = useState('')
  const [notificationsRead, setNotificationsRead] = useState(false)
  const title = navigation.find((item) => item.path === route)?.label ?? 'Vue d’ensemble'
  const filteredTenders = tenders.filter((item) => (category === 'Tous' || item.category === category) && item.title.toLocaleLowerCase('fr').includes(search.toLocaleLowerCase('fr')))

  function ask(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return
    setMessages((previous) => [...previous, { question: trimmed, answer: getAnswer(trimmed) }])
    setQuestion('')
    window.location.assign('#/assistant')
  }

  function compare(event: FormEvent) {
    event.preventDefault()
    const proposed = Number(price)
    const baseline = Number(reference)
    if (!price.trim() || !reference.trim() || !Number.isFinite(proposed) || !Number.isFinite(baseline) || proposed < 0 || baseline <= 0) {
      setPriceError('Saisissez un prix positif ou nul et une référence strictement positive.')
      setComparison('')
      return
    }
    setPriceError('')
    const difference = ((proposed - baseline) / baseline) * 100
    setComparison(`Votre prix est ${difference === 0 ? 'identique à la référence' : `${Math.abs(difference).toLocaleString('fr-FR', { maximumFractionDigits: 1 })} % ${difference > 0 ? 'au-dessus' : 'en dessous'} de la référence`}. Cette comparaison ne constitue pas une évaluation de conformité réglementaire.`)
  }

  function renderTenders(compact = false) {
    return <div className={`ws-tenders ${compact ? 'compact' : ''}`}>{(compact ? tenders.slice(0, 2) : filteredTenders).map((item) => <article className="ws-tender" key={item.id}>
      <div className="ws-tender-top"><span className="ws-tender-icon"><item.icon /></span><span className="ws-tag">{item.category}</span><DemoBadge /></div>
      <p className="ws-overline">{item.organization}</p><h3>{item.title}</h3>
      <div className="ws-tender-meta"><span>Budget indicatif<strong>{item.budget} <small>FCFA</small></strong></span><span className="ws-deadline"><ScheduleRounded /> J − {item.remaining.split(' ')[0]}<small>Délai fictif</small></span></div>
      <button className="ws-tender-link" onClick={() => setSelectedTender(item)}>Voir l’opportunité <ArrowUpRight /></button>
    </article>)}{!compact && filteredTenders.length === 0 && <p className="ws-empty" role="status">Aucune opportunité ne correspond à votre recherche.</p>}</div>
  }

  function renderUpdates() {
    return <div className="ws-updates">{updates.map((update, index) => <button className="ws-update" key={update.tag} onClick={() => { setSelectedUpdate(index); setDialog('update') }}>
      <span className={`ws-update-icon ${update.color}`}><update.icon /></span><span className="ws-update-copy"><span className="ws-overline">{update.tag}</span><strong>{update.title}</strong><span>{update.text}</span></span><ChevronRightRounded />
    </button>)}</div>
  }

  let content: ReactNode
  if (route === '/assistant') {
    content = <section className="ws-panel ws-tool-panel">
      <PanelHeading title="Un assistant, à chaque étape." subtitle="Démarches, réglementation, appels d’offres : commençons par votre besoin." />
      <Alert severity="info">Assistant de démonstration à réponses prédéfinies. Aucune IA connectée. Ne saisissez aucune donnée confidentielle.</Alert>
      <div className="ws-conversation" aria-live="polite">{messages.length === 0 ? <div className="ws-chat-welcome"><AutoAwesomeRounded /><h3>Bonjour, comment puis-je vous accompagner ?</h3><p>Choisissez un sujet ou décrivez votre besoin.</p></div> : messages.map((message, index) => <div className="ws-message" key={index}><p className="ws-question">{message.question}</p><div className="ws-answer"><AutoAwesomeRounded /><p>{message.answer}</p></div></div>)}</div>
      <div className="ws-suggestions">{['Préparer un appel d’offres', 'Comprendre un nouveau décret', 'Évaluer ma conformité'].map((item) => <button key={item} onClick={() => ask(item)}>{item}<AddRounded /></button>)}</div>
      <form className="ws-chat-form" onSubmit={(event) => { event.preventDefault(); ask(question) }}><input aria-label="Votre question" placeholder="Posez votre question à votre assistant…" value={question} maxLength={2000} onChange={(event) => setQuestion(event.target.value)} /><button aria-label="Envoyer la question" disabled={!question.trim()}><SendRounded /></button></form>
    </section>
  } else if (route === '/offres') {
    content = <section className="ws-panel ws-tool-panel"><PanelHeading title="Les bonnes opportunités, au bon moment." subtitle="Préparez vos réponses aux marchés du secteur des télécommunications." /><Alert severity="info">Ces trois appels d’offres sont fictifs. Budgets et délais illustrent le design. Consultez les publications officielles de l’ARMP pour les avis réels.</Alert><div className="ws-offer-toolbar"><div className="ws-filter-tabs">{['Tous', 'Réseaux', 'Équipements', 'Conseil'].map((item) => <button aria-pressed={category === item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)} key={item}>{item}</button>)}</div><label className="ws-search"><SearchRounded /><input aria-label="Rechercher un appel d’offres" placeholder="Rechercher une opportunité" value={search} onChange={(event) => setSearch(event.target.value)} /></label></div>{renderTenders()}<a className="ws-source-link" href="https://armp.cm/" target="_blank" rel="noreferrer">Consulter l’ARMP <ArrowOutwardRounded /><span className="sr-only"> (nouvel onglet)</span></a></section>
  } else if (route === '/veille') {
    content = <section className="ws-panel ws-tool-panel"><PanelHeading title="Comprendre ce qui change. Savoir quoi faire." subtitle="Votre espace de veille pour les télécommunications au Cameroun." /><Alert severity="warning">Aucun flux d’actualité en direct n’est connecté. Les fiches ci-dessous sont des thèmes de préparation, pas des annonces de nouveaux décrets.</Alert>{renderUpdates()}<div className="ws-source-cards"><a href="https://www.art.cm/" target="_blank" rel="noreferrer"><ShieldOutlined /><strong>ART</strong><span>Régulation des télécommunications</span><ArrowOutwardRounded /></a><a href="#/institutions/minpostel"><AccountBalanceOutlined /><strong>MINPOSTEL</strong><span>Ministère des Postes et Télécommunications</span><ArrowForwardRounded /></a><a href="#/sources"><DescriptionOutlined /><strong>Sources & limites</strong><span>Consulter la méthode de vérification</span><ArrowForwardRounded /></a></div></section>
  } else if (route === '/audit') {
    content = <section className="ws-panel ws-tool-panel"><PanelHeading title="Un point clair sur votre préparation." subtitle="Identifiez les informations à réunir avant un audit professionnel." /><Alert severity="info">Auto-évaluation indicative, non persistée. Elle ne certifie pas la conformité à la législation camerounaise.</Alert><div className="ws-audit-layout"><div className="ws-audit-checks">{auditItems.map((item) => <FormControlLabel key={item} control={<Checkbox checked={audit.includes(item)} onChange={(_, checked) => setAudit((previous) => checked ? [...previous, item] : previous.filter((value) => value !== item))} />} label={item} />)}</div><div className="ws-audit-score"><strong>{audit.length * 20}<small>%</small></strong><h3>Préparation du dossier</h3><p>{audit.length} sur {auditItems.length} points déclarés</p><progress aria-label="Préparation du dossier" max={5} value={audit.length} /></div></div><div className="ws-audit-notes"><div><h3>Conformité réglementaire</h3><p>Non évaluée. Chaque obligation doit être reliée à un texte applicable, à ses articles et à une preuve.</p></div><div><h3>Satisfaction des clients</h3><p>Non mesurée. Une enquête et des réponses réelles sont nécessaires ; aucun score n’est inventé.</p></div></div><Button variant="contained" onClick={() => ask('Comment préparer un audit de conformité ?')}>Me faire accompagner <ArrowForwardRounded sx={{ ml: 1 }} /></Button></section>
  } else if (route === '/tarifs') {
    content = <section className="ws-panel ws-tool-panel"><PanelHeading title="Vos prestations, au juste prix ?" subtitle="Comparez un prix proposé à votre propre référence en francs CFA." /><Alert severity="info">Aucune grille tarifaire officielle intégrée. Comparez des prestations de même périmètre et de même régime de taxes.</Alert><form className="ws-price-form" onSubmit={compare}><TextField label="Votre prix (FCFA)" type="number" value={price} onChange={(event) => { setPrice(event.target.value); setComparison('') }} required slotProps={{ htmlInput: { min: 0, step: 'any' } }} /><TextField label="Prix de référence (FCFA)" type="number" value={reference} onChange={(event) => { setReference(event.target.value); setComparison('') }} required slotProps={{ htmlInput: { min: 0.01, step: 'any' } }} /><Button variant="contained" type="submit">Comparer les prix</Button></form>{priceError && <Alert severity="error">{priceError}</Alert>}{comparison && <Alert severity="info" role="status">{comparison}</Alert>}<div className="ws-guidance"><ShieldOutlined /><div><h3>Un écart de prix n’est pas une infraction.</h3><p>Documentez la source et la date de votre référence. Vérifiez les règles applicables à votre prestation auprès de l’organisme compétent.</p></div></div></section>
  } else {
    content = <>
      <section className="ws-hero">
        <div className="ws-hero-content"><span className="ws-hero-label"><span /> VOTRE PARTENAIRE AU QUOTIDIEN</span><h2>Vos démarches avancent.<br />Vous aussi.</h2><p>Un assistant à vos côtés pour comprendre les règles,<br className="ws-desktop-break" /> saisir les opportunités et faire grandir votre activité.</p><a className="ws-primary-button" href="#/assistant"><AutoAwesomeRounded /> Échanger avec mon assistant <ArrowForwardRounded /></a><span className="ws-hero-footnote"><ShieldOutlined /> Pensé pour les entreprises au Cameroun</span></div>
        <div className="ws-hero-art" aria-hidden="true"><div className="ws-orbit orbit-one" /><div className="ws-orbit orbit-two" /><div className="ws-orbit orbit-three" /><div className="ws-art-dot dot-one" /><div className="ws-art-dot dot-two" /><div className="ws-ai-core"><AutoAwesomeRounded /></div><div className="ws-art-chip chip-top"><span><CheckRounded /></span><div>Une longueur d’avance<strong>Veille réglementaire</strong></div></div><div className="ws-art-chip chip-bottom"><span><DescriptionOutlined /></span><div>De nouvelles perspectives<strong>Appels d’offres</strong></div></div><span className="ws-art-star star-one">✦</span><span className="ws-art-star star-two">✧</span></div>
      </section>
      <section className="ws-stats" aria-label="Indicateurs">
        <a className="ws-stat" href="#/dossiers"><span className="ws-stat-icon green"><AssignmentOutlined /></span><span className="ws-stat-label">Démarches en cours</span><strong>{dossiers.filter((item) => item.stage < 2).length.toString().padStart(2, '0')}<span className="ws-stat-note">Suivi local</span></strong><span className="ws-stat-footer">Gardez le fil de vos dossiers <ChevronRightRounded /></span></a>
        <a className="ws-stat" href="#/veille"><span className="ws-stat-icon orange"><RadarRounded /></span><span className="ws-stat-label">Points de vigilance</span><strong>03<span className="ws-stat-note orange-text">À explorer</span></strong><span className="ws-stat-footer">Thèmes de démonstration <ChevronRightRounded /></span></a>
        <a className="ws-stat" href="#/offres"><span className="ws-stat-icon blue"><DescriptionOutlined /></span><span className="ws-stat-label">Opportunités télécom</span><strong>03<span className="ws-stat-note">Exemples</span></strong><span className="ws-stat-footer">Préparez votre prochaine réponse <ChevronRightRounded /></span></a>
        <a className="ws-stat" href="#/audit"><span className="ws-stat-icon purple"><ShieldOutlined /></span><span className="ws-stat-label">Mon niveau de préparation</span><strong>{audit.length * 20}<small>%</small><span className="ws-stat-note">{audit.length ? 'En progression' : 'À démarrer'}</span></strong><span className="ws-stat-footer">Auto-évaluation, non certification <ChevronRightRounded /></span></a>
      </section>
      <div className="ws-middle-grid">
        <section className="ws-panel ws-watch-panel"><PanelHeading title="L’essentiel de votre veille" subtitle="Comprendre, anticiper et passer à l’action." href="#/veille" /><div className="ws-panel-label"><span className="ws-live-dot" /> VOTRE SECTEUR : TÉLÉCOMMUNICATIONS <DemoBadge /></div>{renderUpdates()}</section>
        <section className="ws-assistant-card"><div className="ws-assistant-card-top"><span className="ws-assistant-icon"><AutoAwesomeRounded /></span><span>VOTRE COPILOTE</span><span className="ws-demo-badge">Démo</span></div><h2>Moins de complexité.<br />Plus de clarté.</h2><p>Une question sur une démarche ou une obligation ? Faisons le point ensemble.</p><button onClick={() => ask('Quelles démarches pour mon entreprise télécom ?')}>Quelles démarches pour mon entreprise ?<ArrowOutwardRounded /></button><button onClick={() => ask('Comment répondre à un appel d’offres ?')}>Comment répondre à un appel d’offres ?<ArrowOutwardRounded /></button><a href="#/assistant">Discuter avec mon assistant <ArrowForwardRounded /></a><span className="ws-assistant-disclaimer">Réponses guidées · Aucune IA connectée</span></section>
      </div>
      <div className="ws-bottom-grid"><section className="ws-panel ws-opportunities"><PanelHeading title="Votre prochaine opportunité" subtitle="Des marchés à explorer dans votre secteur." href="#/offres" />{renderTenders(true)}</section><section className="ws-panel ws-journey"><PanelHeading title="Mes démarches" href="#/dossiers" /><div className="ws-journey-illustration"><AssignmentOutlined /><span><CheckRounded /></span></div><h3>Chaque démarche commence<br />par le bon interlocuteur.</h3><p>{dossiers.length ? `${dossiers.length} dossier(s) enregistré(s) dans ce navigateur. Retrouvez votre progression locale.` : 'Retrouvez les institutions et préparez votre premier dossier, à votre rythme.'}</p><a href={dossiers.length ? '#/dossiers' : '#/institutions'}>{dossiers.length ? 'Voir mes dossiers' : 'Explorer les institutions'}<ArrowForwardRounded /></a><span className="ws-local-note">Aucune transmission aux administrations</span></section></div>
      <section className="ws-country-note"><span className="ws-cameroon-flag" aria-hidden="true"><i /><i>★</i><i /></span><div><strong>Un accompagnement local. Une ambition qui grandit.</strong><p>Les institutions camerounaises à portée de main, où que vous soyez.</p></div><a href="#/institutions">Découvrir les institutions <ArrowForwardRounded /></a></section>
    </>
  }

  return <div className="ws-app">
    <a className="skip-link" href="#workspace-main" onClick={(event) => { event.preventDefault(); document.getElementById('workspace-main')?.focus() }}>Aller au contenu</a>
    {menuOpen && <button className="ws-mobile-overlay" aria-label="Fermer la navigation" onClick={() => setMenuOpen(false)} />}
    <aside className={`ws-sidebar ${menuOpen ? 'is-open' : ''}`}>
      <a className="ws-brand" href="#/" onClick={() => setMenuOpen(false)}><span className="ws-brand-icon"><AutoAwesomeRounded /></span><span>mon assistant<span className="ws-brand-dot">.</span><small>VOTRE ACTIVITÉ, BIEN ACCOMPAGNÉE</small></span></a>
      <button className="ws-close-menu" aria-label="Fermer le menu" onClick={() => setMenuOpen(false)}><CloseRounded /></button>
      <div className="ws-workspace-switch"><span className="ws-business-avatar"><WifiRounded /></span><div>Espace entreprise<small>Télécommunications</small></div><span className="ws-workspace-marker" /></div>
      <span className="ws-nav-label">MON ESPACE</span>
      <nav aria-label="Navigation principale">{navigation.map((item, index) => <div key={item.path}>{index === 4 && <span className="ws-nav-label ws-nav-second">PILOTER MON ACTIVITÉ</span>}<a href={`#${item.path}`} aria-current={route === item.path ? 'page' : undefined} onClick={() => setMenuOpen(false)}><item.icon /><span>{item.label}</span>{item.path === '/assistant' && <span className="ws-ai-label">IA</span>}{item.path === '/offres' && <span className="ws-nav-badge">3</span>}</a></div>)}</nav>
      <div className="ws-sidebar-bottom"><div className="ws-help-card"><span><AutoAwesomeRounded /> Avançons ensemble</span><p>Un repère pour chaque étape<br />de votre parcours.</p><button onClick={() => setDialog('help')}>Découvrir mon assistant <ArrowUpRight /></button></div><button className="ws-help-link" onClick={() => setDialog('help')}><HelpOutlineRounded /> Aide & accompagnement</button><a className="ws-profile" href="#/sources"><span>ME</span><div>Mon entreprise<small>Espace de démonstration</small></div><ChevronRightRounded /></a></div>
    </aside>
    <div className="ws-main-shell">
      <header className="ws-header">
        <div className="ws-header-title"><button className="ws-mobile-menu" aria-label="Ouvrir le menu" onClick={() => setMenuOpen(true)}><MenuRounded /></button><span>Mon espace</span><ChevronRightRounded /><strong>{title}</strong></div>
        <div className="ws-header-actions">
          <span className="ws-country"><span className="ws-cameroon-flag" aria-hidden="true"><i /><i>★</i><i /></span>Cameroun</span>
          <div className="ws-theme">
            <label className="sr-only" htmlFor="workspace-theme">Thème</label>
            <select id="workspace-theme" value={preference} onChange={(event) => { const value = event.target.value; if (value === 'light' || value === 'dark' || value === 'system') setPreference(value) }}>
              <option value="system">Système</option><option value="light">Clair</option><option value="dark">Sombre</option>
            </select>
          </div>
          <button className="ws-notification-button" aria-label="Ouvrir les notifications" onClick={() => { setDialog('notifications'); setNotificationsRead(true) }}><NotificationsNoneRounded />{!notificationsRead && <i />}</button>
          <span className="ws-header-avatar">ME</span>
        </div>
      </header>
      <main id="workspace-main" tabIndex={-1} className="ws-main"><div className="ws-page-heading"><div><span className="ws-date">VENDREDI 16 OCTOBRE 2026 · APERÇU DE DÉMONSTRATION</span><h1>{route === '/' ? 'Bienvenue dans votre espace' : title}{route === '/' && <span className="ws-greeting-dot">.</span>}</h1><p>{route === '/' ? 'L’esprit tranquille pour vous concentrer sur ce qui compte.' : 'Votre activité au Cameroun, accompagnée à chaque étape.'}</p></div>{route === '/' && <a className="ws-outline-button" href="#/institutions"><AddRounded /> Nouvelle démarche</a>}</div>{content}<footer className="ws-footer"><span>© 2026 Mon Assistant · Conçu pour avancer ensemble.</span><a href="#/sources">Prototype indépendant · Sources & limites <ArrowUpRight /></a></footer></main>
    </div>
    <Dialog open={dialog !== null} onClose={() => setDialog(null)} fullWidth maxWidth="sm" aria-labelledby="ws-dialog-title"><DialogTitle id="ws-dialog-title">{dialog === 'notifications' ? 'Vos notifications' : dialog === 'update' ? updates[selectedUpdate].title : 'Votre activité, bien accompagnée'}</DialogTitle><DialogContent>
      {dialog === 'notifications' ? <><Alert severity="info">Notifications de démonstration uniquement. Aucune veille automatique ni notification sur votre téléphone n’est activée.</Alert><div className="ws-dialog-notification"><DescriptionOutlined /><div><strong>3 opportunités à explorer</strong><p>Découvrez les exemples et préparez une checklist de réponse.</p><a href="#/offres" onClick={() => setDialog(null)}>Voir les appels d’offres</a></div></div><div className="ws-dialog-notification"><ShieldOutlined /><div><strong>Votre préparation commence ici</strong><p>Faites le point sur les pièces à réunir pour votre activité.</p><a href="#/audit" onClick={() => setDialog(null)}>Commencer l’auto-évaluation</a></div></div></> : dialog === 'update' ? <><Alert severity="warning">Fiche pédagogique, sans nouveau décret vérifié.</Alert><div className="ws-update-detail"><h3>Ce qu’il faut vérifier</h3><p>{updates[selectedUpdate].text} Consultez le texte officiel, sa date d’entrée en vigueur et son champ d’application.</p><h3>Votre prochaine action</h3><p>Recensez les exigences applicables, les justificatifs attendus et le responsable de chaque action. Faites valider ce plan par un professionnel compétent.</p><h3>En cas de non-respect</h3><p>Les conséquences ne peuvent pas être déterminées sans le texte applicable. Aucune amende, suspension ou autre sanction n’est affirmée dans cette démonstration.</p><a href="#/institutions/minpostel" onClick={() => setDialog(null)}>Consulter les ressources du MINPOSTEL</a></div></> : <><p>Mon Assistant réunit un annuaire des institutions camerounaises, un suivi local des dossiers et un espace de préparation pour les entreprises télécoms.</p><Alert severity="info" sx={{ mt: 2 }}>Prototype indépendant : aucun ministère connecté, aucun dépôt officiel, aucune IA ni veille en direct. Les checklists et conversations sont conservées uniquement pendant cette session de navigation ; les dossiers de démonstration restent dans votre navigateur.</Alert></>}
    </DialogContent><DialogActions><Button onClick={() => setDialog(null)}>Fermer</Button>{dialog === 'update' && <Button onClick={() => { setDialog(null); ask('Comment comprendre un nouveau décret ?') }}>Comprendre avec mon assistant</Button>}</DialogActions></Dialog>
    <Dialog open={selectedTender !== null} onClose={() => setSelectedTender(null)} fullWidth maxWidth="sm" aria-labelledby="ws-tender-title"><DialogTitle id="ws-tender-title">{selectedTender?.title}</DialogTitle><DialogContent><Alert severity="warning">Appel d’offres fictif · {selectedTender?.id}. Aucun dossier officiel ni dépôt disponible. Votre checklist n’est pas enregistrée après rechargement.</Alert><h3>Préparer ma réponse</h3><div className="ws-response-checks">{responseItems.map((item) => <FormControlLabel key={item} label={item} control={<Checkbox checked={selectedTender ? (checklists[selectedTender.id] ?? []).includes(item) : false} onChange={(_, checked) => { if (selectedTender) setChecklists((previous) => ({ ...previous, [selectedTender.id]: checked ? [...(previous[selectedTender.id] ?? []), item] : (previous[selectedTender.id] ?? []).filter((value) => value !== item) })) }} />} />)}</div><p role="status">{selectedTender ? (checklists[selectedTender.id] ?? []).length : 0} / {responseItems.length} étapes préparées</p></DialogContent><DialogActions><Button onClick={() => setSelectedTender(null)}>Fermer</Button><Button variant="contained" onClick={() => { setSelectedTender(null); ask('Comment préparer ma candidature à un appel d’offres ?') }}>Me faire accompagner</Button></DialogActions></Dialog>
  </div>
}

function ArrowUpRight() {
  return <NorthEastRounded />
}
