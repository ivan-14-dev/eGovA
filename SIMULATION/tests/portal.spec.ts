import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { institutions, findInstitutions } from '../src/data/institutions'

const sizes = [{ width: 1440, height: 1000 }, { width: 390, height: 844 }]
async function noOverflow(page: Page) {
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
}
async function accessibility(page: Page) {
  await page.waitForFunction(() => document.getAnimations().every((animation) => animation.playState !== 'running'))
  const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(results.violations.map((issue) => ({ id: issue.id, nodes: issue.nodes.map((node) => ({ target: node.target, failure: node.failureSummary })) }))).toEqual([])
}

test('registry records explicit provenance and missing information', () => {
  expect(institutions).toHaveLength(39)
  expect(new Set(institutions.map((item) => item.id)).size).toBe(39)
  expect(institutions.filter((item) => item.photo)).toHaveLength(6)
  for (const item of institutions) {
    expect(item.integration).toBe('Information documentaire')
    expect(item.lastVerifiedAt).toBe('2026-10-16')
    expect(Object.keys(item.verification)).toHaveLength(8)
    expect(item.palette).toBeNull()
    if (item.photo) {
      expect(item.photo.credit).toBeTruthy()
      expect(item.photo.license).toBe('CC BY-SA 4.0')
      expect(item.photo.sourceUrl).toMatch(/^https:\/\/commons.wikimedia.org\//)
    }
    for (const fact of Object.values(item.verification)) {
      expect(fact.checkedAt).toBeTruthy()
      if (fact.confidence === 'Source primaire' || fact.confidence === 'Source documentaire') expect(fact.sources.length).toBeGreaterThan(0)
    }
  }
  expect(findInstitutions('ENSEIGNEMENT superieur', '', false).some((item) => item.id === 'minesup')).toBe(true)
  expect(findInstitutions('NIU', '', false).map((item) => item.id)).toEqual(['minfi'])
})

for (const institution of institutions) {
  test(`institution ${institution.id}: desktop/mobile, light/dark, sources and accessibility`, async ({ page }, info) => {
    const errors: string[] = []
    page.on('pageerror', (error) => errors.push(error.message))
    await page.goto(`/#/institutions/${institution.id}`)
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(institution.name)
    for (const size of sizes) {
      await page.setViewportSize(size)
      for (const theme of ['light', 'dark']) {
        await page.getByLabel('Thème', { exact: true }).selectOption(theme)
        await expect(page.locator('html')).toHaveAttribute('data-theme', theme)
        await expect(page.getByText('Information documentaire', { exact: true })).toBeVisible()
        const photo = page.getByTestId(`photo-${institution.id}`)
        if (institution.photo) {
          await expect(photo.locator('img')).toBeVisible()
          await expect.poll(() => photo.locator('img').evaluate((img: HTMLImageElement) => img.complete && img.naturalWidth > 0)).toBe(true)
          await expect(photo.getByRole('link', { name: /Photo :/ })).toHaveAttribute('href', institution.photo.sourceUrl)
          expect(await photo.locator('img').evaluate((img) => getComputedStyle(img).filter)).toBe('none')
        } else {
          await expect(photo.getByText('Photographie non documentée')).toBeVisible()
          await expect(photo.getByText('Repère illustratif, pas un bâtiment réel')).toBeVisible()
        }
        await noOverflow(page)
        await accessibility(page)
        await page.screenshot({ path: info.outputPath(`${institution.id}-${size.width}-${theme}.png`), fullPage: true })
      }
    }
    const summaries = page.locator('.evidence-accordion .MuiAccordionSummary-root')
    for (const summary of await summaries.all()) await summary.click()
    await expect(page.getByText('Synthèse des compétences de la fiche officielle, sans ajout de procédure.', { exact: true })).toHaveCount(institution.verification.description.confidence === 'Source primaire' ? 1 : 0)
    await noOverflow(page)
    await accessibility(page)
    expect(errors).toEqual([])
  })
}

test('catalogue search, filters, navigation and unknown routes', async ({ page }) => {
  await page.goto('/#/institutions')
  await expect(page.getByTestId('institution-card')).toHaveCount(39)
  await page.getByRole('textbox', { name: 'Rechercher une institution ou une démarche' }).fill('NIU')
  await expect(page.getByTestId('institution-card')).toHaveCount(1)
  await page.getByRole('link', { name: 'Découvrir MINFI', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Ministère des Finances')
  await page.getByRole('link', { name: 'Retour au catalogue', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Rechercher une institution ou une démarche' })).toHaveValue('NIU')
  await page.getByRole('textbox', { name: 'Rechercher une institution ou une démarche' }).fill('')
  await page.getByRole('checkbox', { name: 'Avec photographie documentée' }).check()
  await expect(page.getByTestId('institution-card')).toHaveCount(6)
  await page.getByRole('combobox', { name: 'Domaine' }).click()
  await page.getByRole('option', { name: 'Éducation & emploi' }).click()
  await expect(page.getByTestId('institution-card')).toHaveCount(1)
  await page.getByRole('textbox', { name: 'Rechercher une institution ou une démarche' }).fill('introuvable')
  await expect(page.getByRole('heading', { name: 'Aucune institution trouvée' })).toBeVisible()
  await page.getByRole('button', { name: 'Réinitialiser les filtres' }).click()
  await expect(page.getByTestId('institution-card')).toHaveCount(39)
  await page.goto('/#/institutions/inexistante')
  await expect(page.getByRole('heading', { name: 'Page introuvable' })).toBeVisible()
})

test('system theme, user persistence and no theme-driven navigation changes', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' })
  await page.goto('/')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.emulateMedia({ colorScheme: 'light' })
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await page.getByLabel('Thème', { exact: true }).selectOption('dark')
  await page.goto('/#/institutions/minjustice')
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await page.reload()
  await expect(page.getByLabel('Thème', { exact: true })).toHaveValue('dark')
  await expect(page).toHaveURL(/institutions\/minjustice$/)
})

test('simulation remains local, theme-independent and persistent', async ({ page, baseURL }, info) => {
  const outbound: string[] = []
  page.on('request', (request) => {
    if (!request.url().startsWith(`${baseURL}/`)) outbound.push(request.url())
  })
  await page.goto('/#/institutions/minfi')
  await page.getByRole('button', { name: 'Créer un dossier de démonstration' }).click()
  await expect(page.getByRole('button', { name: 'Enregistrer localement' })).toBeDisabled()
  await page.getByRole('textbox', { name: 'Objet fictif du dossier' }).fill('Découverte du suivi administratif')
  await page.getByRole('checkbox', { name: 'Je comprends que rien ne sera envoyé à une administration.' }).check()
  await accessibility(page)
  await page.screenshot({ path: info.outputPath('form-light.png') })
  await page.getByRole('button', { name: 'Enregistrer localement' }).click()
  await expect(page).toHaveURL(/dossiers$/)
  await expect(page.getByTestId('dossier')).toHaveCount(1)
  const stored = await page.evaluate(() => localStorage.getItem('mon-assistant.demo-dossiers.v1'))
  await page.getByLabel('Thème', { exact: true }).selectOption('dark')
  expect(await page.evaluate(() => localStorage.getItem('mon-assistant.demo-dossiers.v1'))).toBe(stored)
  await expect(page).toHaveURL(/dossiers$/)
  await page.reload()
  await expect(page.getByTestId('dossier')).toHaveCount(1)
  await page.getByRole('button', { name: "Simuler l'étape suivante" }).click()
  await page.getByRole('button', { name: "Simuler l'étape suivante" }).click()
  await expect(page.getByRole('button', { name: 'Scénario terminé' })).toBeDisabled()
  await expect(page.getByTestId('dossier')).toContainText("Aucun document n'a été délivré")
  for (const size of sizes) {
    await page.setViewportSize(size)
    for (const theme of ['light', 'dark']) {
      await page.getByLabel('Thème', { exact: true }).selectOption(theme)
      await noOverflow(page)
      await accessibility(page)
      await page.screenshot({ path: info.outputPath(`dossiers-${size.width}-${theme}.png`), fullPage: true })
    }
  }
  expect(outbound).toEqual([])
  await page.goto('/#/institutions/minfi')
  await page.getByRole('button', { name: 'Créer un dossier de démonstration' }).click()
  await accessibility(page)
  await page.screenshot({ path: info.outputPath('form-dark.png') })
})

test('missing image preserves provenance and shows an honest fallback', async ({ page }) => {
  await page.route('**/institutions/minjustice.jpg', (route) => route.abort())
  await page.goto('/#/institutions/minjustice')
  const photo = page.getByTestId('photo-minjustice')
  await expect(photo.getByText('Photo indisponible', { exact: true })).toBeVisible()
  await expect(photo.getByRole('link', { name: /Photo : Labe maxi/ })).toBeVisible()
  await expect(photo.locator('img')).toHaveCount(0)
})

test('corrupt local data is reported and never silently overwritten', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('mon-assistant.demo-dossiers.v1', '{invalid'))
  await page.goto('/#/institutions/minfi')
  await expect(page.getByRole('alert').filter({ hasText: 'Le registre local est inaccessible ou invalide' })).toBeVisible()
  await page.getByRole('button', { name: 'Créer un dossier de démonstration' }).click()
  await page.getByRole('checkbox', { name: 'Je comprends que rien ne sera envoyé à une administration.' }).check()
  await expect(page.getByRole('button', { name: 'Enregistrer localement' })).toBeDisabled()
  expect(await page.evaluate(() => localStorage.getItem('mon-assistant.demo-dossiers.v1'))).toBe('{invalid')
})

test('catalogue, report and empty dossiers in every theme and viewport', async ({ page }, info) => {
  for (const path of ['/institutions', '/sources', '/dossiers']) {
    await page.goto(`/#${path}`)
    for (const size of sizes) {
      await page.setViewportSize(size)
      for (const theme of ['light', 'dark']) {
        await page.getByLabel('Thème', { exact: true }).selectOption(theme)
        await noOverflow(page)
        await accessibility(page)
        await page.screenshot({ path: info.outputPath(`${path.replace('/', '') || 'catalogue'}-${size.width}-${theme}.png`) })
      }
    }
  }
})
