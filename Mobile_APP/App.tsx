import React, { useCallback, useEffect, useRef, useState } from 'react'
import { AppState, BackHandler, KeyboardAvoidingView, Linking, Modal, Platform, ScrollView, Text, View } from 'react-native'
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context'
import { StatusBar } from 'expo-status-bar'
import { router, useLocalSearchParams } from 'expo-router'
import { api, absoluteURL, ApiError, baseURL, restoreToken, storeToken } from './src/api'
import { AlertCards, AuditScreen, LoginScreen, ProfileScreen } from './src/AccountScreens'
import AssistantScreen from './src/AssistantScreen'
import CaseScreen from './src/CaseScreen'
import LibraryScreen from './src/LibraryScreen'
import DocumentViewer from './src/DocumentViewer'
import { Body, Button, Card, colors, Expand, Field, Scores, Spinner, Title, Warning } from './src/ui'
import { label, statuses } from './src/options'
import type { Audit, Bulletin, Case, Notifications, Procedure, Source, User, Viewer } from './src/types'

const tabs = { accueil: 'Accueil', notifications: 'Alertes', parcours: 'Démarches', dossiers: 'Dossiers', ia: 'Assistant IA', audit: 'Audit', veille: 'Veille', bibliotheque: 'Bibliothèque', profil: 'Profil' }
type Tab = keyof typeof tabs
type Workspace = { cases: Case[]; procedures: Procedure[]; notifications: Notifications; audit: Audit; bulletins: Bulletin[]; history: { action: string; created_at: string }[] }

export default function App() {
  return <SafeAreaProvider><WorkspaceApp /></SafeAreaProvider>
}

function WorkspaceApp() {
  const [user, setUser] = useState<User | null>(null)
  const [data, setData] = useState<Workspace | null>(null)
  const [gemini, setGemini] = useState(false)
  const params = useLocalSearchParams<{ tab?: string }>()
  const tab: Tab = params.tab && params.tab in tabs ? params.tab as Tab : 'accueil'
  const setTab = useCallback((next: Tab) => router.setParams({ tab: next }), [])
  const [selectedCase, setSelectedCase] = useState<number | null>(null)
  const [source, setSource] = useState<Source | null>(null)
  const [viewer, setViewer] = useState<Viewer | null>(null)
  const [initialCommand, setInitialCommand] = useState<{ question: string; case_id: string }>()
  const [filter, setFilter] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const working = useRef(false)
  const epoch = useRef(0)
  const scroll = useRef<React.ComponentRef<typeof ScrollView>>(null)

  const clear = useCallback(() => {
    epoch.current++; setUser(null); setData(null); setSource(null); setViewer(null); setSelectedCase(null); setInitialCommand(undefined); setTab('accueil')
  }, [setTab])
  const run = useCallback(async (operation: () => Promise<void>) => {
    if (working.current) return
    working.current = true; setBusy(true); setError('')
    try { await operation() }
    catch (e) {
      if (e instanceof ApiError && e.status === 401) {
        clear()
        try { await storeToken(null) } catch (storage) { console.error('Suppression du jeton :', String(storage)) }
      }
      setError(e instanceof Error ? e.message : 'Opération impossible. Réessayez.')
    } finally { working.current = false; setBusy(false) }
  }, [clear])
  const reload = useCallback(async () => {
    const current = epoch.current
    const session = await api<{ user: User; gemini_configured: boolean }>('session/')
    const [cases, procedures, notifications, audit, bulletins, history] = await Promise.all([
      api<{ cases: Case[] }>('cases/'), api<{ procedures: Procedure[] }>(`procedures/?activity=${encodeURIComponent(session.user.activity)}`),
      api<Notifications>('notifications/'), api<Audit>('audit/'), api<{ bulletins: Bulletin[] }>('bulletins/'),
      api<{ events: Workspace['history'] }>('history/'),
    ])
    if (current !== epoch.current) return
    setUser(session.user); setGemini(session.gemini_configured)
    setData({ cases: cases.cases, procedures: procedures.procedures, notifications, audit, bulletins: bulletins.bulletins, history: history.events })
  }, [])
  useEffect(() => { void run(async () => { if (await restoreToken()) await reload() }) }, [run, reload])
  useEffect(() => {
    if (!user) return
    const tick = () => {
      if (AppState.currentState !== 'active' || working.current) return
      const current = epoch.current
      void run(async () => {
        const notifications = await api<Notifications>('notifications/')
        if (current === epoch.current) setData((old) => old ? { ...old, notifications } : old)
      })
    }
    const timer = setInterval(tick, 60000)
    const listener = AppState.addEventListener('change', (state) => { if (state === 'active') tick() })
    return () => { clearInterval(timer); listener.remove() }
  }, [user?.email, run])
  useEffect(() => {
    const listener = BackHandler.addEventListener('hardwareBackPress', () => {
      if (viewer) setViewer(null)
      else if (source) setSource(null)
      else if (selectedCase) setSelectedCase(null)
      else if (tab !== 'accueil') setTab('accueil')
      else return false
      return true
    })
    return () => listener.remove()
  }, [viewer, source, selectedCase, tab])
  useEffect(() => { scroll.current?.scrollTo({ y: 0, animated: false }) }, [tab, viewer, source, selectedCase])
  const navigate = (next: string) => {
    if (!(next in tabs)) return
    setViewer(null); setSource(null); setSelectedCase(null); setInitialCommand(undefined); setFilter('')
    setTab(next as Tab)
    if (user) void run(reload)
  }
  const openCase = (id: number) => { setSelectedCase(id); setSource(null); setViewer(null); setTab('dossiers') }
  const openSource = (s: Source) => { void run(async () => setSource(await api<Source>(`source/${encodeURIComponent(s.id)}/`))) }
  const openViewer = (document: Viewer) => setViewer(document)
  const authenticate = async (route: string, email: string, password: string) => {
    const result = await api<{ token: string }>(`${route}/`, 'POST', { email, password })
    await storeToken(result.token); await reload()
    setTab(route === 'register' ? 'profil' : 'accueil')
  }
  const logout = () => { void run(async () => {
    try { await api('logout/', 'POST', {}) }
    finally { await storeToken(null); clear() }
  }) }
  const item = data?.cases.find((c) => c.id === selectedCase)

  let content: React.ReactNode
  if (tab === 'bibliotheque') content = <LibraryScreen run={run} busy={busy} onViewer={openViewer} />
  else if (!user || !data) content = <LoginScreen busy={busy} run={run} authenticate={authenticate} />
  else if (tab === 'profil') content = <ProfileScreen user={user} run={run} reload={reload} busy={busy} logout={logout} />
  else if (tab === 'ia') content = <AssistantScreen key={initialCommand?.case_id || 'assistant'} cases={data.cases} gemini={gemini} busy={busy} run={run} reload={reload}
    onCase={openCase} onSource={openSource} onTarget={navigate} initial={initialCommand} />
  else if (tab === 'audit') content = <AuditScreen audit={data.audit} cases={data.cases} busy={busy} run={run} reload={reload} />
  else if (tab === 'notifications') content = <><Title>Mes alertes et appels d’offres</Title>
    <Warning>Appels relus et publiés, sans flux Internet automatique. Recevoir une alerte ne garantit pas l’éligibilité. Rappels à 30 jours.</Warning>
    <Button title="Actualiser mes alertes" disabled={busy} secondary onPress={() => void run(reload)} />
    <AlertCards items={data.notifications.items} run={run} busy={busy} refresh={reload} onCase={openCase} onTarget={navigate} onSource={openSource} />
    {!data.notifications.items.length && <Body>Aucune alerte active pour votre situation.</Body>}</>
  else if (tab === 'parcours') content = <><Title>Choisir une démarche</Title><Field label="Filtrer les démarches" value={filter} onChange={setFilter} />
    {[...data.procedures].sort((a, b) => Number(b.suggested) - Number(a.suggested)).filter((p) => `${p.id} ${p.title}`.toLowerCase().includes(filter.toLowerCase())).map((p) =>
      <Expand key={p.id} title={`${p.id} · ${p.title}`}><Body>{p.suggested ? 'À examiner pour votre profil.' : 'Applicabilité à qualifier.'}</Body><Body>{p.description}</Body>
        <Button title="Lire la source" secondary onPress={() => openSource(p.source)} />
        <Warning>Pièces, coûts, modalités et validité à vérifier. Préparation locale, aucun dépôt officiel.</Warning>
        <Button title="Préparer ce dossier" disabled={busy} onPress={() => void run(async () => { const result = await api<{ case: Case }>('cases/', 'POST', { procedure: p.id }); await reload(); openCase(result.case.id) })} />
      </Expand>)}</>
  else if (tab === 'dossiers') content = item ? <><Button title="Tous mes dossiers" secondary onPress={() => setSelectedCase(null)} />
    <CaseScreen key={`${item.id}:${item.version}:${item.status}:${item.due_date}`} item={item} run={run} reload={reload} busy={busy} onSource={openSource} onViewer={openViewer}
      onUpdate={() => { setInitialCommand({ question: 'Mettre à jour le dossier sélectionné', case_id: String(item.id) }); setTab('ia') }} /></>
    : <><Title>Mes dossiers</Title><Button title="Nouvelle démarche" onPress={() => navigate('parcours')} />
      {data.cases.map((c) => <Card key={c.id} title={c.title}><Body>{label(statuses, c.status)} · {c.steps.filter((s) => s.done).length}/{c.steps.length} étapes · {c.evidence.length} pièce(s)</Body>
        {c.outdated && <Warning>Référentiel modifié : à réexaminer.</Warning>}<Button title="Ouvrir le dossier" onPress={() => openCase(c.id)} /></Card>)}
      {!data.cases.length && <Body>Aucun dossier. Choisissez une démarche pour commencer.</Body>}</>
  else if (tab === 'veille') content = <><Title>Les changements pertinents</Title><Warning>Veille relue par l’administrateur, pas un flux ministériel en direct.</Warning>
    {!data.bulletins.length && <Body>Aucune fiche publiée pour votre profil. Cela ne signifie pas qu’aucun texte n’a changé.</Body>}
    {data.bulletins.map((b) => <Card key={b.id} title={b.title}><Body>{b.body}</Body><Body>Action : {b.action}</Body><Body>Conséquence : {b.consequence}</Body><Body>Date d’effet : {b.effective_on || 'Non établie'}</Body>
      <Button title="Consulter la source" secondary onPress={() => openSource(b.source)} />{!b.read && <Button title="Marquer comme lu" disabled={busy} onPress={() => void run(async () => { await api('bulletins/', 'POST', { id: b.id }); await reload() })} />}</Card>)}</>
  else content = <><Title>{user.organization || 'Votre prochaine étape'}</Title>
    <Card><Body>{data.cases.length} dossier(s) · {data.notifications.unread} alerte(s) à lire</Body><Button title="Consulter mes alertes" onPress={() => navigate('notifications')} /><Button secondary title="Parler à mon assistant" onPress={() => navigate('ia')} /></Card>
    <Scores summaries={data.notifications.summaries} />
    <Card title="Échéances saisies">{data.cases.filter((c) => c.due_date).map((c) => <Body key={c.id}>{c.due_date} · {c.title}</Body>)}<Button title="Voir mes dossiers" secondary onPress={() => navigate('dossiers')} /></Card>
    <Card title="Dernières actions">{data.history.slice(0, 6).map((e, i) => <Body key={`${e.created_at}-${i}`}>{new Date(e.created_at).toLocaleString('fr')} · {e.action}</Body>)}</Card>
  </>

  return <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }} edges={['top', 'bottom']}>
    <StatusBar style="dark" /><View style={{ paddingHorizontal: 18, paddingVertical: 12, backgroundColor: 'white', borderBottomWidth: 1, borderColor: colors.line }}>
      <Text accessibilityRole="header" style={{ color: colors.ink, fontSize: 20, fontWeight: '700' }}>Mon Assistant · Cameroun</Text>
      <Text style={{ color: colors.muted, fontSize: 11, marginTop: 4 }}>Outil indépendant · Aucun service public connecté</Text>
    </View>
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 16, gap: 12, maxWidth: 700, width: '100%', alignSelf: 'center' }}>
        {!!error && <View accessibilityRole="alert"><Warning>{error}</Warning><Button secondary title="Réessayer le chargement" disabled={busy} onPress={() => void run(reload)} /></View>}
        {busy && <Spinner />}{content}
        {user?.staff && <Button title="Ouvrir l’administration web" secondary onPress={() => void run(async () => { await Linking.openURL(`${baseURL}/admin/`) })} />}
      </ScrollView>
    </KeyboardAvoidingView>
    <View style={{ borderTopWidth: 1, borderColor: colors.line, backgroundColor: 'white', paddingVertical: 8 }}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12 }}>
        {Object.entries(tabs).filter(([key]) => user || ['accueil', 'bibliotheque'].includes(key)).map(([key, text]) =>
          <Button key={key} title={`${text}${key === 'notifications' && data ? ` (${data.notifications.unread})` : ''}`} secondary={tab !== key} disabled={busy} onPress={() => navigate(key)} />)}
      </ScrollView>
    </View>
    <Modal visible={!!source && !viewer} onRequestClose={() => setSource(null)} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Button title="Fermer la source" secondary onPress={() => setSource(null)} />
        {source && <><Title>{source.title}</Title><Warning>{source.warning}</Warning>
          <Card><Body>{source.text}</Body><Body>Empreinte : {source.version}</Body></Card>
          {source.url && <Button title="Visualiser le PDF source" onPress={() => {
            const uri = absoluteURL(source.url!)
            setViewer({ title: source.title, uri: uri.split('#')[0], mime: 'application/pdf', headers: {}, page: Number(new URL(uri).hash.replace('#page=', '')) || 1 })
          }} />}</>}
      </ScrollView></SafeAreaView>
    </Modal>
    <Modal visible={!!viewer} onRequestClose={() => setViewer(null)} animationType="slide">
      <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}><ScrollView contentContainerStyle={{ padding: 16, gap: 12 }}>
        <Button title="Fermer le document" secondary onPress={() => setViewer(null)} />
        {viewer && <><Title>{viewer.title}</Title><DocumentViewer document={viewer} /></>}
      </ScrollView></SafeAreaView>
    </Modal>
  </SafeAreaView>
}
