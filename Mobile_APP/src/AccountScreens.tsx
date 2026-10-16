import React, { useState } from 'react'
import { View } from 'react-native'
import { api, baseURL } from './api'
import { activities, kinds } from './options'
import { Body, Button, Card, Choice, Expand, Field, Scores, Title, Warning } from './ui'
import type { Audit, Case, Control, Notice, Run, Source, User } from './types'

export function LoginScreen({ busy, run, authenticate }: { busy: boolean; run: Run; authenticate: (route: string, email: string, password: string) => Promise<void> }) {
  const [mode, setMode] = useState('login')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [message, setMessage] = useState('')
  return <><Title>Vos démarches, pas à pas.</Title><Warning>Outil indépendant. Aucun service public connecté.</Warning>
    <Card title={mode === 'register' ? 'Créer mon compte' : mode === 'password-reset' ? 'Récupérer mon compte' : 'Connexion'}>
      <Field label="Courriel" value={email} onChange={setEmail} />
      {mode !== 'password-reset' && <Field label="Mot de passe" value={password} onChange={setPassword} secret />}
      {mode === 'register' && <Body>Au moins 10 caractères. Un compte ne certifie pas votre entreprise.</Body>}
      <Button title={mode === 'register' ? 'Créer mon compte' : mode === 'password-reset' ? 'Recevoir les instructions' : 'Se connecter'} disabled={busy}
        onPress={() => void run(async () => {
          setMessage('')
          if (mode === 'password-reset') {
            const result = await api<{ message: string }>(`${mode}/`, 'POST', { email }); setMessage(result.message)
          } else { await authenticate(mode, email, password); setPassword('') }
        })} />
      {!!message && <Body>{message}</Body>}
      <Button secondary title={mode === 'login' ? 'Inscription' : 'Retour à la connexion'} disabled={busy} onPress={() => { setMode(mode === 'login' ? 'register' : 'login'); setMessage('') }} />
      <Button secondary title="Mot de passe oublié" disabled={busy} onPress={() => setMode('password-reset')} />
    </Card><Body>Serveur : {baseURL}</Body><Body>Sur un téléphone, configurez EXPO_PUBLIC_API_URL avec l’adresse réseau du serveur, pas localhost.</Body></>
}

export function ProfileScreen({ user, busy, run, reload, logout }: { user: User; busy: boolean; run: Run; reload: () => Promise<void>; logout: () => void }) {
  const [profile, setProfile] = useState(user)
  return <><Title>Votre situation</Title><Card>
    <Choice label="Vous êtes" value={profile.kind} items={kinds} onChange={(v) => setProfile({ ...profile, kind: v })} />
    <Field label="Entreprise ou projet" value={profile.organization} onChange={(v) => setProfile({ ...profile, organization: v })} />
    <Choice label="Activité principale" value={profile.activity} items={activities} onChange={(v) => setProfile({ ...profile, activity: v })} />
    <Field label="Ville / zone" value={profile.city} onChange={(v) => setProfile({ ...profile, city: v })} />
    <Button title="Enregistrer mon profil" disabled={busy} onPress={() => void run(async () => { await api('profile/', 'POST', profile); await reload() })} />
    <Body>{user.email}</Body><Warning>Un espace privé par compte. Les profils cabinet et investisseur ne donnent aucun accès aux autres entreprises.</Warning>
    <Button title="Se déconnecter" secondary disabled={busy} onPress={logout} />
  </Card></>
}

export function AlertCards({ items, busy, run, refresh, onCase, onTarget, onSource }: {
  items: Notice[]; busy: boolean; run: Run; refresh: () => Promise<void>;
  onCase: (id: number) => void; onTarget: (target: string) => void; onSource: (source: Source) => void;
}) {
  return <>{items.map((n) => <Card key={n.id} title={n.title}>
    <Body>{n.read ? 'Lu' : 'À lire'} · {n.kind}</Body><Body>{n.message}</Body>
    {!!n.deadline && <><Body>Date limite : {new Date(n.deadline).toLocaleString('fr-FR', { timeZone: 'Africa/Douala' })} (Douala)</Body>
      <Body>{n.body}</Body><Body>Action : {n.action}</Body><Body>Conséquence : {n.consequence}</Body>
      <Body>Contrôles non démontrés : {n.missing_controls?.join(', ') || (n.required_count ? 'Aucun parmi les contrôles renseignés ; vérifier le DAO complet.' : 'Exigences à qualifier.')}</Body>
      {n.summaries && <Scores summaries={n.summaries} />}</>}
    {n.source && <Button title="Consulter la source" secondary onPress={() => onSource(n.source!)} />}
    <Button title={n.case_id ? 'Ouvrir le dossier' : 'Examiner les détails'} onPress={() => n.case_id ? onCase(n.case_id) : onTarget(n.target)} />
    {!n.read && <Button title="Marquer cette alerte comme lue" secondary disabled={busy} onPress={() => void run(async () => { await api('notifications/', 'POST', { id: n.id, revision: n.revision }); await refresh() })} />}
  </Card>)}</>
}

function AuditItem({ control, cases, busy, run, reload }: { control: Control; cases: Case[]; busy: boolean; run: Run; reload: () => Promise<void> }) {
  const [app, setApp] = useState(control.applicability)
  const [status, setStatus] = useState(control.status)
  const [proof, setProof] = useState(control.evidence ? String(control.evidence) : '')
  const [reason, setReason] = useState(control.justification)
  const proofs = cases.flatMap((c) => c.evidence).filter((e) => !e.superseded)
  return <Expand title={`${control.id} · ${control.critical ? 'CRITIQUE · ' : ''}${control.text}`}>
    <Body>{control.condition}</Body><Body>{control.source}</Body>
    {control.proof_invalid && <Warning>Preuve expirée ou remplacée. Réexamen requis.</Warning>}
    <Choice label={`Applicabilité ${control.id}`} value={app} onChange={setApp} items={{ A_DETERMINER: 'À déterminer', OUI: 'Applicable', NON: 'Non applicable — à justifier' }} />
    <Choice label={`Résultat ${control.id}`} value={status} onChange={setStatus} items={{ NON_EVALUE: 'Non évalué', CONFORME: 'Conforme avec preuve', NON_CONFORME: 'Non conforme' }} />
    <Choice label={`Justificatif ${control.id}`} value={proof} onChange={setProof} items={{ '': 'Aucun', ...Object.fromEntries(proofs.map((e) => [String(e.id), `${e.name}${e.expired ? ' (expiré)' : ''}`])) }} />
    <Field label={`Justification ${control.id}`} value={reason} onChange={setReason} multiline />
    <Button title={`Enregistrer ${control.id}`} disabled={busy} onPress={() => void run(async () => {
      await api('audit/', 'POST', { control: control.id, applicability: app, status, evidence: proof, justification: reason }); await reload()
    })} />
  </Expand>
}
export function AuditScreen({ audit, cases, busy, run, reload }: { audit: Audit; cases: Case[]; busy: boolean; run: Run; reload: () => Promise<void> }) {
  const [filter, setFilter] = useState('')
  return <><Title>Mes points à vérifier</Title><Scores summaries={audit.summaries} />
    <Field label="Filtrer les contrôles" value={filter} onChange={setFilter} />
    {Object.entries(audit.groups).map(([group, controls]) => <View key={group}>
      <Title>{group === 'marche' ? 'Marchés' : 'Réglementation'}</Title>
      {controls.filter((c) => `${c.id} ${c.text}`.toLowerCase().includes(filter.toLowerCase())).map((c) =>
        <AuditItem key={`${c.id}:${c.status}:${c.evidence}:${c.applicability}`} control={c} cases={cases} busy={busy} run={run} reload={reload} />)}
    </View>)}</>
}
