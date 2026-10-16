import { test, expect } from '@playwright/test'
import { execFileSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'

async function createAccount(page) {
  await page.goto('/#/workspace')
  await page.getByText('Créer mon compte', { exact: true }).first().click()
  const register = page.locator('[data-ws-form="register"]')
  await register.getByLabel('Courriel du nouveau compte').fill(`e2e-${Date.now()}@example.test`)
  await register.getByLabel('Nouveau mot de passe').fill('Only-for-e2e-98!Tests')
  await register.getByRole('button', { name: 'Créer mon compte' }).click()
  await expect(page.getByRole('heading', { name: 'Votre situation' })).toBeVisible()
}

test('private workspace: registration, journey, evidence, budget, audit and logout', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await createAccount(page)
  await page.getByLabel('Vous êtes').selectOption('entreprise')
  await page.getByLabel('Activité principale').selectOption('installation')
  await page.getByLabel('Entreprise ou projet').fill('Entreprise test navigateur')
  await page.getByRole('button', { name: 'Enregistrer mon profil' }).click()
  await expect(page.getByText('Profil enregistré.', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Démarches', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choisir une démarche' })).toBeVisible()
  const procedure = page.locator('details').filter({ has: page.locator('[data-ws="create"][data-id="P08"]') })
  await procedure.locator('summary').click()
  await procedure.getByRole('button', { name: 'Préparer ce dossier' }).click()
  await expect(page.getByRole('heading', { name: 'Votre progression' })).toBeVisible()
  for (const checkbox of await page.locator('[data-ws-form="case"] input[type="checkbox"]').all()) await checkbox.check()
  await page.getByLabel('Statut déclaré').selectOption('pret')
  await page.getByRole('button', { name: 'Enregistrer ma progression' }).click()
  await expect(page.getByText('Progression déclarée enregistrée.')).toBeVisible()
  await page.getByLabel('Ajouter un document').setInputFiles({
    name: 'preuve-e2e.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4\nTest browser evidence'),
  })
  await page.getByRole('button', { name: 'Ajouter la pièce' }).click()
  await expect(page.getByRole('link', { name: 'preuve-e2e.pdf' })).toBeVisible()
  await page.getByLabel('Poste de dépense').fill('Frais documentés test')
  await page.getByLabel('Montant FCFA').fill('15000')
  await page.getByRole('combobox', { name: 'Nature', exact: true }).selectOption('annuel')
  await page.getByRole('combobox', { name: 'Taxes', exact: true }).selectOption('HT')
  await page.getByLabel('Source, devis').fill('Montant de test, non réglementaire')
  await page.getByRole('button', { name: 'Ajouter au budget' }).click()
  await expect(page.getByText(/Sous-total annuel · HT/)).toBeVisible()
  await page.reload()
  await page.locator('[data-ws="open"]').first().click()
  await expect(page.getByLabel('Statut déclaré')).toHaveValue('pret')
  await expect(page.getByRole('link', { name: 'preuve-e2e.pdf' })).toBeVisible()
  await page.getByRole('link', { name: 'Audit', exact: true }).click()
  const control = page.locator('details').filter({ has: page.locator('form[data-id="C001"]') })
  await control.locator('summary').click()
  await control.getByLabel('Applicabilité').selectOption('OUI')
  await control.getByLabel('Résultat déclaré').selectOption('CONFORME')
  await control.getByRole('combobox', { name: 'Justificatif', exact: true }).selectOption({ label: 'preuve-e2e.pdf' })
  await control.getByLabel('Justification').fill('Test de saisie, sans certification réelle')
  await control.getByRole('button', { name: 'Enregistrer le contrôle' }).click()
  await expect(page.getByText('1 % démontré — provisoire', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Assistant IA', exact: true }).click()
  await page.getByRole('combobox', { name: 'Moteur' }).selectOption('local')
  await page.getByLabel('Question sur les démarches').fill('agrément installateur')
  await page.getByRole('button', { name: 'Envoyer à l’assistant' }).click()
  await expect(page.getByText('Passages du corpus local. Applicabilité et actualité à vérifier.', { exact: true })).toBeVisible()
  await page.getByRole('link', { name: 'Veille', exact: true }).click()
  await expect(page.getByText(/Aucune fiche publiée pour votre profil/)).toBeVisible()
  await page.getByRole('link', { name: 'Profil', exact: true }).click()
  await page.getByRole('button', { name: 'Se déconnecter' }).click()
  await expect(page.getByRole('heading', { name: 'Connexion', exact: true })).toBeVisible()
  await expect(page.getByText('preuve-e2e.pdf')).toHaveCount(0)
  expect(errors).toEqual([])
})

test('web administration is protected and displays its login form', async ({ page }) => {
  await page.goto('/admin/')
  await expect(page.getByRole('link', { name: 'Mon Assistant — Administration documentaire' })).toBeVisible()
  await expect(page.locator('input[name="username"]')).toBeVisible()
  await expect(page.locator('input[name="password"]')).toBeVisible()
})

test('alerts, voiced proposal confirmation and private image replacement', async ({ page }) => {
  const errors = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.addInitScript(() => {
    window.SpeechRecognition = class {
      start() {
        window.voiceStarts = (window.voiceStarts || 0) + 1
        setTimeout(() => {
          this.onresult?.({ results: [Object.assign([{ transcript: 'Échéance au 2027-05-01' }], { isFinal: true })] })
          this.onend?.()
        }, 30)
      }
      abort() { this.onend?.() }
    }
  })
  await createAccount(page)
  const session = await (await page.request.get('/workspace-api/session/')).json()
  const created = await page.request.post('/workspace-api/cases/', {
    headers: { 'X-CSRFToken': session.csrf }, data: { procedure: 'P08' },
  })
  expect(created.status()).toBe(201)
  const dossier = (await created.json()).case
  await page.goto('/#/workspace/ia')
  await page.getByRole('combobox', { name: 'Dossier concerné' }).selectOption(String(dossier.id))
  await page.getByRole('button', { name: 'Dicter ma commande' }).click()
  await expect(page.locator('#ws-voice-status')).toContainText('Autorisez la dictée')
  expect(await page.evaluate(() => window.voiceStarts || 0)).toBe(0)
  await page.getByRole('checkbox', { name: /J’autorise la dictée/ }).check()
  await page.getByRole('button', { name: 'Dicter ma commande' }).click()
  await expect(page.getByLabel('Question sur les démarches')).toHaveValue('Échéance au 2027-05-01')
  await expect(page.getByRole('heading', { name: 'Votre confirmation est nécessaire' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Envoyer à l’assistant' }).click()
  await expect(page.getByRole('heading', { name: 'Votre confirmation est nécessaire' })).toBeVisible()
  let cases = await (await page.request.get('/workspace-api/cases/')).json()
  expect(cases.cases[0].due_date).toBeNull()
  await page.getByRole('button', { name: 'Confirmer et enregistrer ces changements' }).click()
  await expect(page.getByLabel('Votre prochaine échéance')).toHaveValue('2027-05-01')
  const png = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jWZkAAAAASUVORK5CYII=', 'base64')
  await page.getByLabel('Ajouter un document').setInputFiles({ name: 'preuve.png', mimeType: 'image/png', buffer: png })
  await page.getByLabel('Date d’expiration').fill('2000-01-01')
  await page.getByRole('button', { name: 'Ajouter la pièce' }).click()
  await page.getByRole('button', { name: 'Visualiser preuve.png' }).click()
  await expect(page.getByRole('img', { name: 'preuve.png' })).toBeVisible()
  await expect.poll(() => page.getByRole('img', { name: 'preuve.png' }).evaluate((img) => img.naturalWidth)).toBe(1)
  await page.getByRole('button', { name: 'Fermer le document' }).click()
  await page.getByRole('link', { name: /^Alertes/ }).click()
  await expect(page.getByRole('heading', { name: 'preuve.png : expiré' })).toBeVisible()
  const card = page.locator('article').filter({ has: page.getByRole('heading', { name: 'preuve.png : expiré' }) })
  await card.getByRole('button', { name: 'Marquer cette alerte comme lue' }).click()
  await expect(card.locator('.ws-tag')).toContainText('Lu')
  await card.getByRole('button', { name: /Ouvrir le dossier/ }).click()
  await page.getByLabel('Ajouter un document').setInputFiles({ name: 'renouvelee.png', mimeType: 'image/png', buffer: png })
  await page.getByRole('combobox', { name: 'Document à remplacer' }).selectOption({ label: 'preuve.png' })
  await page.getByLabel('Date d’expiration').fill('2099-01-01')
  await page.getByRole('button', { name: 'Ajouter la pièce' }).click()
  await expect(page.getByText(/ANCIENNE VERSION — remplacée/)).toBeVisible()
  await page.getByRole('link', { name: /^Alertes/ }).click()
  await expect(page.getByRole('heading', { name: 'preuve.png : expiré' })).toHaveCount(0)

  const backend = fileURLToPath(new URL('../../django_backend/', import.meta.url))
  const seed = (code) => execFileSync(`${backend}.venv/bin/python`, [`${backend}manage.py`, 'shell', '-c', code],
    { env: { ...process.env, DJANGO_DEBUG: '1', DJANGO_DB_PATH: `${backend}db.e2e.sqlite3` } })
  try {
    seed("from workspace.models import Bulletin,Source,AuditControl; from django.utils import timezone; from datetime import timedelta; b=Bulletin.objects.create(title='Appel fictif navigateur',body='Avis de test uniquement',source=Source.objects.filter(draft=False).first(),kind='appel_offres',activity='all',verified=True,published_at=timezone.now(),closes_at=timezone.now()+timedelta(days=2),action='Examiner le DAO test',consequence='Pièces à préparer'); b.required_controls.add(AuditControl.objects.get(pk='C001'))")
    await page.getByRole('button', { name: 'Actualiser mes alertes' }).click()
    await expect(page.getByRole('heading', { name: 'Appel fictif navigateur' }).first()).toBeVisible()
    await expect(page.getByText(/Contrôles demandés non démontrés : C001/).first()).toBeVisible()
  } finally {
    seed("from workspace.models import Bulletin; Bulletin.objects.filter(title='Appel fictif navigateur').delete()")
  }
  expect(errors).toEqual([])
})

test('unsupported dictation remains explicit and text stays available', async ({ page }) => {
  await page.addInitScript(() => {
    window.SpeechRecognition = undefined
    window.webkitSpeechRecognition = undefined
  })
  await createAccount(page)
  await page.getByRole('link', { name: 'Assistant IA', exact: true }).click()
  await page.getByRole('checkbox', { name: /J’autorise la dictée/ }).check()
  await page.getByRole('button', { name: 'Dicter ma commande' }).click()
  await expect(page.locator('#ws-voice-status')).toContainText('Dictée indisponible')
  await page.getByLabel('Question sur les démarches').fill('Mon pourcentage de conformité')
  await page.getByRole('button', { name: 'Envoyer à l’assistant' }).click()
  await expect(page.getByText('Non évalué', { exact: true }).first()).toBeVisible()
})
