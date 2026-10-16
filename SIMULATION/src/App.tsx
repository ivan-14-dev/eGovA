import { useEffect, useRef, useState } from 'react'
import type { FormEvent } from 'react'
import {
  Accordion, AccordionDetails, AccordionSummary, Alert, Box, Breadcrumbs, Button,
  Card, Checkbox, Chip, Dialog, DialogActions, DialogContent, DialogTitle, Divider,
  FormControlLabel, InputAdornment, Link, MenuItem, Paper, Snackbar, Stack,
  Step, StepLabel, Stepper, Table, TableBody, TableCell, TableContainer, TableHead,
  TableRow, TextField, Typography,
} from '@mui/material'
import AccountBalanceOutlined from '@mui/icons-material/AccountBalanceOutlined'
import ArrowBack from '@mui/icons-material/ArrowBack'
import ArrowForward from '@mui/icons-material/ArrowForward'
import CheckCircleOutline from '@mui/icons-material/CheckCircleOutlined'
import ExpandMore from '@mui/icons-material/ExpandMore'
import FolderOutlined from '@mui/icons-material/FolderOutlined'
import ImageOutlined from '@mui/icons-material/ImageOutlined'
import Launch from '@mui/icons-material/Launch'
import Search from '@mui/icons-material/Search'
import ShieldOutlined from '@mui/icons-material/ShieldOutlined'
import { BotIcon } from './BotIcon'
import { categories, findInstitutions, GOVERNMENT_SOURCE, institutions, VERIFICATION_DATE } from './data/institutions'
import type { Institution } from './data/institutions'
import { DOSSIER_KEY, loadDossiers, saveDossiers, statuses } from './dossiers'
import type { Dossier } from './dossiers'
import { useAppTheme } from './theme-context'
import Workspace from './Workspace'
import './App.css'

const photoCount = institutions.filter((institution) => institution.photo).length
const isWorkspaceRoute = (route: string) => ['/', '/assistant', '/veille', '/offres', '/audit', '/tarifs'].includes(route)
const fieldLabels: Record<keyof Institution['verification'], string> = {
  name: 'Nom', acronym: 'Sigle', description: 'Missions', portal: 'Portail autonome',
  photo: 'Photographie', palette: 'Identité visuelle', services: 'Démarches', contact: 'Coordonnées',
}
const dateLabel = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(new Date(`${VERIFICATION_DATE}T12:00:00`))

function ExternalLink({ href, children }: { href: string; children: React.ReactNode }) {
  return <Link href={href} underline="always" target="_blank" rel="noopener noreferrer">{children}<Launch sx={{ fontSize: 12, ml: 0.5 }} /><span className="sr-only"> (nouvel onglet, site externe)</span></Link>
}

function InstitutionPhoto({ institution, large = false }: { institution: Institution; large?: boolean }) {
  const [failed, setFailed] = useState(false)
  const photo = institution.photo
  return (
    <figure className={`institution-photo ${large ? 'large' : ''}`} data-testid={`photo-${institution.id}`}>
      {photo && !failed ? (
        <img src={photo.src} alt={photo.alt} loading={large ? 'eager' : 'lazy'} decoding="async" onError={() => {
          console.warn(`Photographie indisponible : ${institution.id}`, photo.src)
          setFailed(true)
        }} />
      ) : (
        <div className="photo-placeholder">
          <ImageOutlined aria-hidden="true" />
          <strong>{institution.acronym}</strong>
          <span>{failed ? 'Photo indisponible' : 'Photographie non documentée'}</span>
          <small>Repère illustratif, pas un bâtiment réel</small>
        </div>
      )}
      <figcaption>
        {photo ? <><ExternalLink href={photo.sourceUrl}>Photo : {photo.credit}</ExternalLink><span> · </span><ExternalLink href={photo.licenseUrl}>{photo.license}</ExternalLink>{large && <p>{photo.note} Vérification : {dateLabel}.</p>}</> : <span>Emplacement de remplacement explicite · {institution.acronym}</span>}
      </figcaption>
    </figure>
  )
}

function InstitutionCard({ institution }: { institution: Institution }) {
  return (
    <Card variant="outlined" component="article" className="institution-card" data-testid="institution-card">
      <InstitutionPhoto institution={institution} />
      <div className="card-body">
        <div className="card-meta"><span>{institution.acronym}</span><span>Documentaire</span></div>
        <Typography component="h3" variant="h3">{institution.name}</Typography>
        <Typography variant="body2" color="text.secondary" className="card-description">{institution.description}</Typography>
        <div className="card-bottom">
          <span>{institution.services.length ? `${institution.services.length} ressource documentée` : 'Démarches à documenter'}</span>
          <Button href={`#/institutions/${institution.id}`} size="small" endIcon={<ArrowForward />} aria-label={`Découvrir ${institution.acronym}`}>Découvrir</Button>
        </div>
      </div>
    </Card>
  )
}

function Catalogue({ query, setQuery, category, setCategory, onlyPhotos, setOnlyPhotos }: {
  query: string; setQuery: (value: string) => void
  category: string; setCategory: (value: string) => void
  onlyPhotos: boolean; setOnlyPhotos: (value: boolean) => void
}) {
  const filtered = findInstitutions(query, category, onlyPhotos)
  return (
    <>
      <section className="catalogue-hero">
        <div className="hero-copy">
          <span className="eyebrow"><span className="small-dot" /> LE SERVICE PUBLIC, PLUS LISIBLE</span>
          <Typography component="h1" variant="h1">La bonne institution.<br /><span className="accent-text">Le bon point de départ.</span></Typography>
          <Typography color="text.secondary" className="hero-description">Explorez les administrations camerounaises, comprenez leurs missions et retrouvez les sources officielles. Un accompagnement commun, des institutions distinctes.</Typography>
          <div className="hero-pills"><span><CheckCircleOutline /> Sources traçables</span><span><ShieldOutlined /> Aucune connexion ministérielle</span></div>
        </div>
        <Paper variant="outlined" className="hero-note">
          <div className="note-icon"><AccountBalanceOutlined /></div>
          <Typography component="h2" variant="h3">Un annuaire, pas un portail gouvernemental unifié.</Typography>
          <Typography variant="body2" color="text.secondary">Chaque administration conserve ses propres services et outils. Mon Assistant est ici un prototype indépendant.</Typography>
          <Divider />
          <div className="hero-stats"><div><strong>{institutions.length}</strong><span>institutions recensées</span></div><div><strong>{photoCount}</strong><span>photos documentées</span></div></div>
          <Link href="#/sources">Voir les limites et les sources <ArrowForward sx={{ fontSize: 14, verticalAlign: 'middle' }} /></Link>
        </Paper>
      </section>

      <section aria-labelledby="catalogue-title" className="catalogue-section">
        <div className="section-heading"><div><span className="eyebrow">EXPLORER LES ADMINISTRATIONS</span><Typography variant="h2" component="h2" id="catalogue-title">Ministères & organismes</Typography></div><Typography variant="body2" color="text.secondary">Sources consultées le {dateLabel}</Typography></div>
        <Paper variant="outlined" className="search-toolbar">
          <TextField label="Rechercher une institution ou une démarche" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Ex. : finances, enseignement, NIU…" fullWidth size="small" slotProps={{ input: { startAdornment: <InputAdornment position="start"><Search /></InputAdornment> } }} />
          <TextField select label="Domaine" value={category} onChange={(event) => setCategory(event.target.value)} size="small" className="category-select">
            <MenuItem value="">Tous les domaines</MenuItem>
            {categories.map((item) => <MenuItem key={item} value={item}>{item}</MenuItem>)}
          </TextField>
        </Paper>
        <div className="filter-line">
          <Typography variant="body2" color="text.secondary" role="status">{filtered.length} institution{filtered.length > 1 ? 's' : ''} affichée{filtered.length > 1 ? 's' : ''}</Typography>
          <FormControlLabel control={<Checkbox size="small" checked={onlyPhotos} onChange={(event) => setOnlyPhotos(event.target.checked)} />} label={<Typography variant="body2">Avec photographie documentée</Typography>} />
        </div>
        {filtered.length ? <div className="institution-grid">{filtered.map((institution) => <InstitutionCard key={institution.id} institution={institution} />)}</div> : (
          <Paper variant="outlined" className="empty-state"><Search /><Typography variant="h2" component="h3">Aucune institution trouvée</Typography><Typography color="text.secondary">Essayez un sigle, un autre mot-clé ou un domaine plus large.</Typography><Button onClick={() => { setQuery(''); setCategory(''); setOnlyPhotos(false) }}>Réinitialiser les filtres</Button></Paper>
        )}
      </section>
    </>
  )
}

function InstitutionDetail({ institution, onSimulate }: { institution: Institution; onSimulate: (institution: Institution) => void }) {
  return (
    <div className="detail-page">
      <Breadcrumbs aria-label="Fil d'Ariane"><Link href="#/institutions">Institutions</Link><Typography color="text.primary">{institution.acronym}</Typography></Breadcrumbs>
      <section className="detail-hero">
        <div>
          <Chip label={institution.integration} color="info" size="small" variant="outlined" />
          <Typography component="h1" variant="h1" className="detail-title">{institution.name}</Typography>
          <Typography color="text.secondary">{institution.description}</Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Repère : {institution.acronym} · Sigle à confirmer individuellement</Typography>
          <Stack direction="row" sx={{ mt: 3, gap: 1, flexWrap: 'wrap' }}>
            <Button component="a" href={institution.portalUrl ?? institution.officialUrl} target="_blank" rel="noopener noreferrer" variant="contained" endIcon={<Launch />}>{institution.portalUrl ? 'Consulter le portail officiel' : 'Consulter la fiche officielle'}</Button>
            <Button href="#/institutions" startIcon={<ArrowBack />}>Retour au catalogue</Button>
          </Stack>
        </div>
        <InstitutionPhoto institution={institution} large />
      </section>
      <Alert severity="info" icon={<ShieldOutlined />}>Cet espace présente de l'information documentaire. Aucune demande n'est transmise à cette institution. Les couleurs sont celles de Mon Assistant, pas une charte officielle.</Alert>
      <div className="detail-columns">
        <div>
          <Paper variant="outlined" className="content-panel">
            <span className="eyebrow">S'INFORMER AVANT D'AGIR</span>
            <Typography component="h2" variant="h2">Démarches & ressources</Typography>
            {institution.services.length ? institution.services.map((service) => (
              <div key={service.id} className="service-item">
                <Typography component="h3" variant="h3">{service.title}</Typography>
                <Typography variant="body2" color="text.secondary">{service.description}</Typography>
                <Alert severity="warning" sx={{ my: 2 }}>Pièces requises, tarifs, délais et étapes de dépôt non vérifiés. Consultez l'administration avant toute démarche.</Alert>
                <ExternalLink href={service.sourceUrl}>Lire la source officielle</ExternalLink>
                <Typography variant="caption" sx={{ display: 'block' }} color="text.secondary">Consultée le {dateLabel} · {service.confidence}</Typography>
              </div>
            )) : <div className="service-item"><Typography color="text.secondary">Aucune démarche détaillée n'est encore suffisamment documentée dans ce registre.</Typography><Typography variant="body2" color="text.secondary">Nous n'inventons ni formulaire officiel, ni liste de pièces, ni frais. La fiche de la Primature reste accessible pour consulter les compétences de l'institution.</Typography></div>}
          </Paper>
          <Paper variant="outlined" className="content-panel">
            <span className="eyebrow">PROVENANCE & NIVEAUX DE CONFIANCE</span>
            <Typography component="h2" variant="h2">Ce que nous avons vérifié</Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>Une source consultée n'est pas une certification d'actualité. Les réserves sont détaillées champ par champ.</Typography>
            {(Object.keys(institution.verification) as (keyof Institution['verification'])[]).map((field) => {
              const check = institution.verification[field]
              return <Accordion key={field} disableGutters elevation={0} className="evidence-accordion">
                <AccordionSummary expandIcon={<ExpandMore />}><div className="evidence-summary"><strong>{fieldLabels[field]}</strong><span>{check.confidence}</span></div></AccordionSummary>
                <AccordionDetails>
                  <Typography variant="body2">{check.confirmed}</Typography>
                  {check.uncertainty && <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>{check.uncertainty}</Typography>}
                  <ul className="source-list">{check.sources.map((source, index) => <li key={source}><ExternalLink href={source}>Source {index + 1} · {new URL(source).hostname}</ExternalLink></li>)}</ul>
                  <Typography variant="caption" color="text.secondary">Consultation : {dateLabel}</Typography>
                </AccordionDetails>
              </Accordion>
            })}
          </Paper>
        </div>
        <aside>
          <Paper variant="outlined" className="content-panel demo-panel">
            <BotIcon size={24} style={{ color: 'var(--accent)', verticalAlign: 'middle' }} />
            <Chip label="Simulation locale" size="small" color="warning" variant="outlined" sx={{ ml: 1 }} />
            <Typography component="h2" variant="h3" sx={{ mt: 2 }}>Découvrir le suivi d'un dossier</Typography>
            <Typography variant="body2" color="text.secondary">Essayez un scénario générique avec des données fictives. Ce n'est pas une procédure de {institution.acronym}.</Typography>
            <Button variant="outlined" fullWidth sx={{ mt: 2 }} onClick={() => onSimulate(institution)}>Créer un dossier de démonstration</Button>
            <Typography variant="caption" color="text.secondary" sx={{ mt: 1, display: 'block' }}>Sans paiement, sans pièce jointe, sans transmission.</Typography>
          </Paper>
          <Paper variant="outlined" className="content-panel">
            <Typography component="h2" variant="h3">Coordonnées & accès</Typography>
            {institution.contact ? <><Typography variant="body2">Division de la communication et des relations publiques</Typography><Typography variant="body2">{institution.contact.phone}</Typography><Link href={`mailto:${institution.contact.email}`}>{institution.contact.email}</Link><p><ExternalLink href={institution.contact.sourceUrl}>Source des coordonnées</ExternalLink></p></> : <Typography variant="body2" color="text.secondary">Aucune adresse ni coordonnée non vérifiée n'est affichée. Consultez la source institutionnelle pour préparer votre déplacement.</Typography>}
            <Typography variant="body2" sx={{ mt: 2 }}><ExternalLink href={institution.officialUrl}>Fiche sur la Primature</ExternalLink></Typography>
          </Paper>
        </aside>
      </div>
    </div>
  )
}

function SourcesPage() {
  return (
    <section className="sources-page">
      <span className="eyebrow">TRANSPARENCE DU PROTOTYPE</span>
      <Typography component="h1" variant="h1">Des sources, pas des suppositions.</Typography>
      <Typography color="text.secondary" sx={{ my: 2 }}>Registre consulté le {dateLabel}. Objectif interne de fidélité : 90 %. Ce niveau n'est ni mesuré ni déclaré atteint.</Typography>
      <Alert severity="warning">Le catalogue comprend 36 portefeuilles ministériels sectoriels, les fonctions du Contrôle supérieur de l'État et des Relations avec les Assemblées, ainsi que la DGSN. Il reflète le recensement consulté, pas un organigramme certifié à jour.</Alert>
      <div className="report-stats">{[[institutions.length, 'fiches de la Primature'], [photoCount, 'photographies documentées'], [institutions.filter((item) => item.portalUrl).length, 'portails autonomes consultés'], [0, 'connexions aux systèmes publics']].map(([value, label]) => <Paper key={label} variant="outlined"><strong>{value}</strong><span>{label}</span></Paper>)}</div>
      <Paper variant="outlined" className="content-panel">
        <Typography variant="h2" component="h2">Périmètre et réserves</Typography>
        <ul className="method-list">
          <li>Point de départ : <ExternalLink href={GOVERNMENT_SOURCE}>Services du Premier Ministre</ExternalLink>. Les titulaires ne sont pas reproduits : certaines rubriques du portail peuvent être anciennes.</li>
          <li>Les missions sont synthétisées depuis les fiches officielles lorsqu'elles sont disponibles. Les sigles restent des repères à confirmer individuellement.</li>
          <li>Six photos Commons ont été contrôlées visuellement et documentées sous CC BY-SA 4.0. Celle du MINAC représente sa délégation régionale à Maroua, pas son siège central.</li>
          <li>Pour {institutions.length - photoCount} institutions, aucun visuel authentifié et réutilisable n'a été retenu. La recherche a été effectuée mais reste à approfondir ; les remplacements sont explicites.</li>
          <li>Une photo du MINDDEVEL apparaît sur sa page Contact, mais sa licence de réutilisation n'est pas établie : elle n'est pas reproduite. Le portail MINEDUB n'était pas accessible lors de la tentative de consultation.</li>
          <li>Aucune charte graphique ni autorisation de réutilisation de logo n'est établie. Le design neutre de Mon Assistant n'est pas une identité ministérielle.</li>
          <li>Trois ressources documentaires sont disponibles. Aucune liste de pièces, aucun tarif ou délai administratif n'est certifié dans cette version.</li>
          <li>Les dossiers, chronologies et notifications sont des simulations locales. Aucun ministère ne reçoit de données. Aucun assistant IA connecté n'est présenté.</li>
        </ul>
      </Paper>
      <Typography variant="h2" component="h2" sx={{ my: 3 }}>État du registre institutionnel</Typography>
      <TableContainer component={Paper} variant="outlined" tabIndex={0} aria-label="Tableau des sources, défilement horizontal disponible">
        <Table size="small">
          <TableHead><TableRow><TableCell>Institution</TableCell><TableCell>Missions</TableCell><TableCell>Photographie</TableCell><TableCell>Portail autonome</TableCell><TableCell>Source primaire</TableCell></TableRow></TableHead>
          <TableBody>{institutions.map((item) => <TableRow key={item.id}><TableCell><Link href={`#/institutions/${item.id}`}>{item.acronym}</Link></TableCell><TableCell>{item.verification.description.confidence}</TableCell><TableCell>{item.photo ? <ExternalLink href={item.photo.sourceUrl}>{item.photo.credit} · {item.photo.license}</ExternalLink> : 'Non retenue'}</TableCell><TableCell>{item.portalUrl ? <ExternalLink href={item.portalUrl}>Consulté</ExternalLink> : 'Non vérifié'}</TableCell><TableCell><ExternalLink href={item.officialUrl}>Primature</ExternalLink></TableCell></TableRow>)}</TableBody>
        </Table>
      </TableContainer>
    </section>
  )
}

function DossiersPage({ dossiers, onAdvance }: { dossiers: Dossier[]; onAdvance: (id: string) => void }) {
  return (
    <section>
      <span className="eyebrow">ESPACE DE DÉMONSTRATION</span>
      <Typography component="h1" variant="h1">Mes dossiers simulés</Typography>
      <Alert severity="warning" sx={{ my: 3 }}>Données conservées uniquement dans ce navigateur. Aucun dépôt officiel, numéro administratif ou retour d'une administration. N'utilisez pas de données personnelles.</Alert>
      {dossiers.length === 0 ? <Paper variant="outlined" className="empty-state"><FolderOutlined /><Typography component="h2" variant="h2">Votre espace est vide</Typography><Typography color="text.secondary">Ouvrez une institution pour créer un exemple de suivi local.</Typography><Button href="#/institutions" variant="contained">Explorer les institutions</Button></Paper> : (
        <Stack sx={{ gap: 3 }}>{dossiers.map((dossier) => {
          const institution = institutions.find((item) => item.id === dossier.institutionId)!
          return <Paper key={dossier.id} variant="outlined" className="content-panel" data-testid="dossier">
            <div className="section-heading"><div><Chip label="Simulation locale" color="warning" size="small" variant="outlined" /><Typography variant="h3" component="h2" sx={{ mt: 1 }}>{dossier.subject}</Typography></div><Typography variant="body2" color="text.secondary">{statuses[dossier.stage]}</Typography></div>
            <Typography variant="body2" color="text.secondary"><Link href={`#/institutions/${institution.id}`}>{institution.name}</Link><br />Référence locale : {dossier.id}<br />Créé le {new Date(dossier.createdAt).toLocaleString('fr-FR')}</Typography>
            <Stepper activeStep={dossier.stage} alternativeLabel sx={{ my: 3 }}>{statuses.map((status, index) => <Step key={status} completed={index <= dossier.stage}><StepLabel>{status}</StepLabel></Step>)}</Stepper>
            <Typography variant="body2" color="text.secondary">{dossier.stage === 2 ? "Réponse de scénario : votre exemple a terminé le parcours local. Aucun document n'a été délivré et aucun agent public n'est intervenu." : "La progression est déclenchée par vous, pour illustrer le suivi. Elle ne représente pas l'avancement d'une demande réelle."}</Typography>
            <Button variant="outlined" disabled={dossier.stage === 2} onClick={() => onAdvance(dossier.id)} sx={{ mt: 2 }}>{dossier.stage === 2 ? 'Scénario terminé' : "Simuler l'étape suivante"}</Button>
          </Paper>
        })}</Stack>
      )}
    </section>
  )
}

function App() {
  const { preference, setPreference } = useAppTheme()
  const [route, setRoute] = useState(location.hash.slice(1) || '/')
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('')
  const [onlyPhotos, setOnlyPhotos] = useState(false)
  const [initial] = useState(() => {
    try { return { dossiers: loadDossiers(), error: '' } }
    catch (error) { console.error('Lecture des dossiers impossible.', error); return { dossiers: [], error: "Le registre local est inaccessible ou invalide. Les données existantes ne sont pas écrasées." } }
  })
  const [dossiers, setDossiers] = useState<Dossier[]>(initial.dossiers)
  const [storageError, setStorageError] = useState(initial.error)
  const [storageBlocked, setStorageBlocked] = useState(Boolean(initial.error))
  const [simulation, setSimulation] = useState<Institution | null>(null)
  const [subject, setSubject] = useState('')
  const [accepted, setAccepted] = useState(false)
  const [formError, setFormError] = useState('')
  const [notification, setNotification] = useState('')
  const main = useRef<HTMLElement>(null)

  useEffect(() => {
    const onHash = () => setRoute(location.hash.slice(1) || '/')
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    const institution = institutions.find((item) => `/institutions/${item.id}` === route)
    document.title = `${institution?.name ?? (isWorkspaceRoute(route) ? 'Mon espace entreprise' : route === '/dossiers' ? 'Dossiers simulés' : route === '/sources' ? 'Sources et limites' : 'Institutions du Cameroun')} | Mon Assistant`
    main.current?.focus({ preventScroll: true })
    window.scrollTo(0, 0)
  }, [route])

  function commit(next: Dossier[]) {
    if (storageBlocked) {
      setStorageError('Le registre doit être rétabli avant de créer ou modifier un dossier.')
      return false
    }
    try {
      saveDossiers(next)
      setDossiers(next)
      setStorageError('')
      return true
    } catch (error) {
      console.error('Enregistrement local impossible.', error)
      setStorageError("Modification non enregistrée : le stockage du navigateur est indisponible ou saturé.")
      return false
    }
  }
  function createDossier(event: FormEvent) {
    event.preventDefault()
    if (!simulation || !accepted || subject.trim().length < 5 || subject.trim().length > 120) {
      setFormError("Renseignez un objet fictif de 5 à 120 caractères et confirmez le caractère simulé.")
      return
    }
    if (dossiers.length >= 50) { setFormError('La limite de 50 dossiers de démonstration est atteinte.'); return }
    const dossier: Dossier = { id: `DEMO-${crypto.randomUUID().slice(0, 8)}`, institutionId: simulation.id, subject: subject.trim(), createdAt: new Date().toISOString(), stage: 0 }
    if (commit([dossier, ...dossiers])) {
      setSimulation(null)
      setNotification('Dossier de démonstration enregistré localement. Rien n’a été transmis.')
      location.hash = '/dossiers'
    } else setFormError("Le dossier n'a pas pu être enregistré. Vérifiez le stockage du navigateur.")
  }
  function advance(id: string) {
    const next = dossiers.map((dossier): Dossier => dossier.id === id ? { ...dossier, stage: dossier.stage === 0 ? 1 : 2 } : dossier)
    if (commit(next)) setNotification('Étape simulée mise à jour dans ce navigateur uniquement.')
  }
  const detail = institutions.find((item) => route === `/institutions/${item.id}`)
  const isCatalogue = route === '/institutions'
  if (isWorkspaceRoute(route)) return <>{storageError && <Alert severity="error">{storageError}</Alert>}<Workspace route={route} dossiers={dossiers} /></>
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main-content" onClick={(event) => { event.preventDefault(); main.current?.focus() }}>Aller au contenu</a>
      <div className="prototype-strip"><ShieldOutlined /> Prototype indépendant · Informations documentaires et simulations locales · Aucun service public connecté</div>
      <header className="site-header">
        <a href="#/" className="brand" aria-label="Mon Assistant, accueil"><span className="brand-symbol"><BotIcon size={24} /></span><span>Mon Assistant<small>COMPRENDRE. S'ORIENTER. AVANCER.</small></span></a>
        <nav aria-label="Navigation principale">
          <Link href="#/">Mon espace</Link>
          <Link href="#/institutions" aria-current={isCatalogue || detail ? 'page' : undefined}>Institutions</Link>
          <Link href="#/dossiers" aria-current={route === '/dossiers' ? 'page' : undefined}>Mes dossiers <span className="nav-count">{dossiers.length}</span></Link>
          <Link href="#/sources" aria-current={route === '/sources' ? 'page' : undefined}>Sources & limites</Link>
        </nav>
        <div className="theme-select"><label htmlFor="theme-choice">Thème</label><select id="theme-choice" value={preference} onChange={(event) => { const value = event.target.value; if (value === 'light' || value === 'dark' || value === 'system') setPreference(value) }}><option value="system">Système</option><option value="light">Clair</option><option value="dark">Sombre</option></select></div>
      </header>
      <main id="main-content" ref={main} tabIndex={-1} className="main-content">
        {storageError && <Alert severity="error" sx={{ mb: 3 }}>{storageError}{storageBlocked && <Button color="inherit" onClick={() => {
          try { setDossiers(loadDossiers()); setStorageBlocked(false); setStorageError('') }
          catch (error) { console.error('Nouvelle lecture impossible.', error); setStorageError(`Le contenu de ${DOSSIER_KEY} reste invalide ou inaccessible. Aucun effacement automatique n'est effectué.`) }
        }}>Réessayer la lecture</Button>}</Alert>}
        {isCatalogue ? <Catalogue query={query} setQuery={setQuery} category={category} setCategory={setCategory} onlyPhotos={onlyPhotos} setOnlyPhotos={setOnlyPhotos} /> :
          detail ? <InstitutionDetail key={detail.id} institution={detail} onSimulate={(institution) => { setSubject(''); setAccepted(false); setFormError(''); setSimulation(institution) }} /> :
            route === '/sources' ? <SourcesPage /> :
              route === '/dossiers' ? <DossiersPage dossiers={dossiers} onAdvance={advance} /> :
                <Paper variant="outlined" className="empty-state"><Typography variant="h1" component="h1">Page introuvable</Typography><Typography>Cette institution ou cette page n'existe pas dans le catalogue.</Typography><Button href="#/institutions">Revenir aux institutions</Button></Paper>}
      </main>
      <footer className="site-footer"><div><strong>Mon Assistant</strong><span>Un repère commun. Des administrations distinctes.</span></div><Link href="#/sources">Méthode, crédits et limites</Link><span>Prototype · Cameroun · 2026</span></footer>
      <Dialog open={Boolean(simulation)} onClose={() => setSimulation(null)} fullWidth maxWidth="sm" aria-labelledby="simulation-title">
        <Box component="form" onSubmit={createDossier}>
          <DialogTitle id="simulation-title">Créer un dossier de démonstration</DialogTitle>
          <DialogContent>
            <Alert severity="warning" sx={{ mb: 3 }}>Simulation locale uniquement. Ce formulaire n'appartient pas à {simulation?.acronym}. Ne saisissez aucune donnée personnelle.</Alert>
            <TextField label="Objet fictif du dossier" value={subject} onChange={(event) => setSubject(event.target.value)} fullWidth required slotProps={{ htmlInput: { minLength: 5, maxLength: 120 } }} helperText="Exemple : Découverte du suivi administratif. Aucune pièce à joindre." />
            <FormControlLabel sx={{ mt: 2 }} control={<Checkbox checked={accepted} onChange={(event) => setAccepted(event.target.checked)} />} label="Je comprends que rien ne sera envoyé à une administration." />
            {formError && <Alert severity="error" sx={{ mt: 2 }}>{formError}</Alert>}
          </DialogContent>
          <DialogActions><Button onClick={() => setSimulation(null)}>Annuler</Button><Button type="submit" variant="contained" disabled={!accepted || storageBlocked}>Enregistrer localement</Button></DialogActions>
        </Box>
      </Dialog>
      <Snackbar open={Boolean(notification)} autoHideDuration={7000} onClose={() => setNotification('')}><Alert severity="success" onClose={() => setNotification('')}>{notification}</Alert></Snackbar>
    </div>
  )
}

export default App
