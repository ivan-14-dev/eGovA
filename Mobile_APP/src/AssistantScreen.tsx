import React, { useState } from 'react'
import { View } from 'react-native'
import { api } from './api'
import { AlertCards } from './AccountScreens'
import Voice from './Voice'
import { Body, Button, Card, Choice, Expand, Field, Scores, Title, Toggle, Warning } from './ui'
import type { Answer, Case, Run, Source } from './types'

export default function AssistantScreen({ cases, gemini, busy, run, reload, onCase, onSource, onTarget, initial }: {
  cases: Case[]; gemini: boolean; busy: boolean; run: Run; reload: () => Promise<void>;
  onCase: (id: number) => void; onSource: (s: Source) => void; onTarget: (target: string) => void;
  initial?: { question: string; case_id: string };
}) {
  const [question, setQuestion] = useState(initial?.question || '')
  const [mode, setMode] = useState('account')
  const [caseId, setCaseId] = useState(initial?.case_id || '')
  const [consent, setConsent] = useState(false)
  const [answer, setAnswer] = useState<Answer | null>(null)
  const [voiceError, setVoiceError] = useState('')
  const submit = () => run(async () => {
    if (!question.trim() || question.length > 600) throw new Error('Une commande de 1 à 600 caractères est requise.')
    setAnswer(null)
    setAnswer(await api<Answer>('assistant/', 'POST', { question, mode, case_id: caseId, public_question: consent }))
  })
  return <><Title>Comprendre avant d’agir</Title>
    <Warning>Mon entreprise : traitement local de votre compte. Gemini : citations publiques uniquement après accord. Aucune donnée d’une autre entreprise.</Warning>
    <View style={{ gap: 8, marginBottom: 14 }}>{['Mon pourcentage de conformité', 'Mes appels d’offres', 'Mes dossiers et documents', 'Mettre à jour le dossier sélectionné'].map((q) =>
      <Button key={q} title={q} secondary disabled={busy} onPress={() => { setQuestion(q); setMode('account') }} />)}</View>
    <Card>
      <Field label="Votre commande ou question" value={question} onChange={setQuestion} multiline />
      <Choice label="Moteur" value={mode} onChange={setMode} items={{
        account: 'Mon entreprise — situation et actions', local: 'Recherche documentaire locale', ...(gemini ? { gemini: 'Gemini — citations publiques vérifiées' } : {}),
      }} />
      {!gemini && <Body>Gemini non configuré côté serveur. Les fonctions de compte et la recherche locale restent disponibles.</Body>}
      <Choice label="Dossier concerné" value={caseId} onChange={setCaseId} items={{ '': 'Choisir un dossier', ...Object.fromEntries(cases.map((c) => [String(c.id), `#${c.id} · ${c.title}`])) }} />
      <Body>Exemple : « Échéance au 2027-05-01 ». Relisez puis envoyez ; aucune modification sans confirmation.</Body>
      <Voice disabled={busy} onText={(value) => {
        const next = `${question} ${value}`.trim()
        if (next.length > 600) setVoiceError('Dictée trop longue. Limite : 600 caractères. Raccourcissez la commande.')
        else { setVoiceError(''); setQuestion(next) }
      }} />
      {!!voiceError && <Warning>{voiceError}</Warning>}
      {mode === 'gemini' && <Toggle label="Ma question est publique ; j’autorise son envoi et celui d’extraits publics à Google." value={consent} onChange={setConsent} />}
      <Button title="Envoyer à l’assistant" disabled={busy} onPress={() => void submit()} />
    </Card>
    {answer && <>
      <Card><Body>{answer.message}</Body></Card>
      {answer.proposal && <Card title="Votre confirmation est nécessaire">
        <Body>{answer.proposal.message}</Body><Body>Valable jusqu’à {new Date(answer.proposal.expires_at).toLocaleTimeString('fr')}</Body>
        <Expand title="Comparer avant / après"><Body>Avant : {JSON.stringify(answer.proposal.before, null, 2)}</Body><Body>Changements : {JSON.stringify(answer.proposal.changes, null, 2)}</Body></Expand>
        <Button title="Confirmer et enregistrer ces changements" disabled={busy} onPress={() => void run(async () => {
          const result = await api<{ case: Case }>(`proposals/${answer.proposal!.id}/confirm/`, 'POST', { confirm: true })
          setAnswer(null); await reload(); onCase(result.case.id)
        })} />
        <Button title="Annuler la proposition" secondary disabled={busy} onPress={() => void run(async () => {
          await api(`proposals/${answer.proposal!.id}/confirm/`, 'POST', { cancel: true }); setAnswer(null)
        })} />
      </Card>}
      {answer.notifications && <Scores summaries={answer.notifications.summaries} />}
      {answer.cases?.map((c) => <Card key={c.id} title={c.title}>
        <Body>{c.status} · {c.completed}/{c.total} étapes déclarées{c.outdated ? ' · version à réexaminer' : ''}</Body>
        <Body>Échéance : {c.due_date || 'Non renseignée'}</Body><Button title="Ouvrir ce dossier" onPress={() => onCase(c.id)} />
      </Card>)}
      {answer.notifications && <AlertCards items={answer.notifications.items} busy={busy} run={run} onCase={onCase} onTarget={onTarget} onSource={onSource}
        refresh={async () => { await reload(); setAnswer(await api<Answer>('assistant/', 'POST', { question: 'Mes alertes', mode: 'account' })) }} />}
      {answer.citations.map((c, i) => <Card key={`${c.id}-${i}`}><Body>{c.quote}</Body><Body>{c.id}</Body></Card>)}
      {answer.sources.map((s) => <Expand key={s.id} title={`${s.title} · ${s.locator}`}><Warning>{s.warning}</Warning><Body>{s.text}</Body><Button title="Lire la source" secondary onPress={() => onSource(s)} /></Expand>)}
    </>}
  </>
}
