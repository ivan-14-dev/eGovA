import React, { useEffect, useState } from 'react'
import { Platform, View } from 'react-native'
import * as DocumentPicker from 'expo-document-picker'
import { File } from 'expo-file-system'
import { api, privateViewer } from './api'
import { Body, Button, Card, Choice, Expand, Field, Title, Toggle, Warning } from './ui'
import { categories, money, statuses } from './options'
import type { Case, Run, Source, Viewer } from './types'

export default function CaseScreen({ item, run, reload, busy, onSource, onViewer, onUpdate }: {
  item: Case; run: Run; reload: () => Promise<void>; busy: boolean; onSource: (s: Source) => void; onViewer: (v: Viewer) => void; onUpdate: () => void;
}) {
  const [done, setDone] = useState(item.steps.map((s) => s.done))
  const [status, setStatus] = useState(item.status)
  const [receipt, setReceipt] = useState(item.receipt)
  const [due, setDue] = useState(item.due_date || '')
  const [asset, setAsset] = useState<DocumentPicker.DocumentPickerAsset | null>(null)
  const [replace, setReplace] = useState('')
  const [expires, setExpires] = useState('')
  const [budget, setBudget] = useState({ label: '', amount: '', category: 'initial', tax: 'inconnu', basis: '' })
  const [deleting, setDeleting] = useState<{ path: string; label: string } | null>(null)
  useEffect(() => () => {
    if (asset && Platform.OS !== 'web') {
      try { const file = new File(asset.uri); if (file.exists) file.delete() }
      catch (error) { console.error('Nettoyage de la pièce temporaire :', String(error)) }
    }
  }, [asset])
  const pick = () => run(async () => {
    const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/png', 'image/jpeg'], copyToCacheDirectory: true, multiple: false })
    if (result.canceled) return
    const next = result.assets[0]
    if (next.size && next.size > 10 * 1024 * 1024) throw new Error('Document de 10 Mo maximum.')
    setAsset(next)
  })
  const upload = () => run(async () => {
    if (!asset) throw new Error('Choisissez un document.')
    const form = new FormData()
    form.append('file', Platform.OS === 'web' && asset.file ? asset.file : new File(asset.uri), asset.name)
    form.append('expires_on', expires); form.append('replace', replace)
    await api(`cases/${item.id}/evidence/`, 'POST', form)
    setAsset(null); setReplace(''); setExpires(''); await reload()
  })
  return <><Title>{item.title}</Title>
    <Body>{item.procedure} · Version {item.version}</Body>
    {item.outdated && <Card><Warning>Référentiel modifié. Réexaminez les pièces avant de poursuivre.</Warning><Button title="Préparer la mise à jour" onPress={onUpdate} disabled={busy} /></Card>}
    <Expand title="Procédure et source"><Body>{item.description}</Body><Button title="Lire la source" secondary onPress={() => onSource(item.source)} /></Expand>
    <Card title="Votre progression">
      {item.steps.map((step, i) => <Toggle key={`${i}-${step.label}`} label={step.label} value={done[i]} onChange={(v) => setDone(done.map((d, j) => i === j ? v : d))} />)}
      <Choice label="Statut déclaré" value={status} items={statuses} onChange={setStatus} />
      <Field label="Référence du dépôt ou de la décision" value={receipt} onChange={setReceipt} />
      <Field label="Prochaine échéance (AAAA-MM-JJ)" value={due} onChange={setDue} />
      <Button title="Enregistrer ma progression" disabled={busy} onPress={() => void run(async () => { await api(`cases/${item.id}/`, 'POST', { done, status, receipt, due_date: due }); await reload() })} />
      <Warning>Aucun dépôt officiel. La progression cochée ne prouve pas la conformité.</Warning>
    </Card>
    <Card title="Justificatifs privés">
      {item.evidence.map((e) => <View key={e.id} style={{ gap: 8, marginBottom: 14 }}>
        <Body>{e.name}{e.superseded ? ' · ancienne version' : ''}{e.expired ? ' · EXPIRÉ' : ''}</Body><Body>Expiration : {e.expires_on || 'Non renseignée'}</Body>
        <Button title={`Visualiser ${e.name}`} secondary disabled={busy} onPress={() => void run(async () => onViewer(await privateViewer(e.preview_url, e.name)))} />
        <Button title={`Supprimer ${e.name}`} secondary onPress={() => setDeleting({ path: `evidence/${e.id}/`, label: e.name })} disabled={busy} />
      </View>)}
      <Button title="Choisir un document (PDF, PNG, JPEG)" secondary disabled={busy} onPress={() => void pick()} />
      {asset && <Body>Document choisi : {asset.name}</Body>}
      <Choice label="Document à remplacer" value={replace} items={{ '': 'Ajouter sans remplacer', ...Object.fromEntries(item.evidence.filter((e) => !e.superseded).map((e) => [String(e.id), e.name])) }} onChange={setReplace} />
      <Field label="Expiration de la pièce (AAAA-MM-JJ, facultatif)" value={expires} onChange={setExpires} />
      <Button title="Ajouter la pièce" disabled={busy || !asset} onPress={() => void upload()} />
      <Body>10 Mo maximum. Un remplacement conserve l’ancienne version et oblige à réexaminer les contrôles associés. Aucun fichier envoyé à Gemini.</Body>
    </Card>
    <Card title="Budget du dossier">
      {item.budget.map((line) => <View key={line.id} style={{ gap: 8 }}><Body>{line.label} · {money(line.amount)} · {line.category} · {line.tax}</Body><Body>{line.basis}</Body>
        <Button secondary title={`Retirer ${line.label}`} disabled={busy} onPress={() => setDeleting({ path: `budget/${line.id}/`, label: line.label })} /></View>)}
      {Object.entries(item.totals).map(([key, amount]) => <Body key={key}>Sous-total {key} : {money(amount)}</Body>)}
      <Body>{item.unknown_amounts} poste(s) inconnu(s). Aucun mélange de frais annuels, initiaux et garanties.</Body>
      <Field label="Poste de dépense" value={budget.label} onChange={(v) => setBudget({ ...budget, label: v })} />
      <Field label="Montant FCFA (vide si inconnu)" numeric value={budget.amount} onChange={(v) => setBudget({ ...budget, amount: v })} />
      <Choice label="Nature" value={budget.category} items={categories} onChange={(v) => setBudget({ ...budget, category: v })} />
      <Choice label="Taxes" value={budget.tax} items={{ inconnu: 'À confirmer', HT: 'HT', TTC: 'TTC' }} onChange={(v) => setBudget({ ...budget, tax: v })} />
      <Field label="Source, devis, période et zone" value={budget.basis} onChange={(v) => setBudget({ ...budget, basis: v })} />
      <Button title="Ajouter au budget" disabled={busy} onPress={() => void run(async () => { await api(`cases/${item.id}/budget/`, 'POST', { ...budget, amount: budget.amount.replace(',', '.') }); setBudget({ label: '', amount: '', category: 'initial', tax: 'inconnu', basis: '' }); await reload() })} />
    </Card>
    {deleting && <Card title="Confirmer la suppression"><Warning>Supprimer « {deleting.label} » ? Cette action est irréversible.</Warning>
      <Button title="Confirmer la suppression" disabled={busy} onPress={() => void run(async () => { await api(deleting.path, 'DELETE'); setDeleting(null); await reload() })} />
      <Button title="Annuler" secondary onPress={() => setDeleting(null)} /></Card>}
    {item.revisions.length > 0 && <Expand title="Historique des mises à jour">{item.revisions.map((r) => <View key={r.at}><Body>{new Date(r.at).toLocaleString('fr')}</Body><Body>{JSON.stringify(r.before, null, 2)}</Body></View>)}</Expand>}
  </>
}
