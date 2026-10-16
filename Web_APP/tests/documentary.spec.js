import { test, expect } from '@playwright/test'

test('mobile home shows real corpus counts without fictional administrative dossiers', async ({ page }) => {
  const errors = []
  const external = []
  page.on('pageerror', (error) => errors.push(error.message))
  page.on('request', (request) => {
    if (!request.url().startsWith('http://127.0.0.1:4186/')) external.push(request.url())
  })
  await page.goto('/')
  await expect(page.getByRole('link', { name: '80 Sources distinctes' })).toBeVisible()
  await expect(page.getByRole('link', { name: /3.*011 Pages indexées/ })).toBeVisible()
  await expect(page.getByText('Aperçu de mes démarches')).toHaveCount(0)
  for (const width of [320, 390, 1280]) {
    await page.setViewportSize({ width, height: 844 })
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth)).toBe(true)
  }
  expect(errors).toEqual([])
  expect(external).toEqual([])
})

test('suggested question retrieves cited excerpts and opens the same source page', async ({ page, request }) => {
  await page.goto('/')
  await page.getByRole('button', { name: 'Certification électronique', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Passages retrouvés', exact: true })).toBeVisible()
  const source = page.locator('.source-card').first()
  const citation = await source.locator('code').textContent()
  expect(citation).toMatch(/^[a-f0-9]{64}:p\d{4}$/)
  const pdf = await source.getByRole('link', { name: /PDF · p/ }).getAttribute('href')
  const response = await request.get(pdf.split('#')[0], { headers: { Range: 'bytes=0-4' } })
  expect(response.status()).toBe(206)
  expect(await response.text()).toBe('%PDF-')
  await source.getByRole('link', { name: 'Lire la page entière' }).click()
  await expect(page.locator('.page-text pre')).toBeVisible()
  await expect(page.locator('.citation-box code')).toHaveText(citation)
  const currentPage = Number(await page.locator('#page-number').inputValue())
  await page.getByRole('button', { name: 'Page précédente', exact: true }).click()
  await expect(page.locator('#page-number')).toHaveValue(String(currentPage - 1))
  await expect(page.locator('.citation-box code')).not.toHaveText(citation)
  await page.getByRole('button', { name: 'Retour', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Passages retrouvés', exact: true })).toBeVisible()
})

test('favorites survive reload and can be removed', async ({ page }) => {
  await page.goto('/#/library')
  const first = page.locator('.document-card').first()
  const title = await first.locator('h3').textContent()
  await first.getByRole('button', { name: 'Ajouter aux favoris', exact: true }).click()
  await page.getByRole('navigation').getByRole('link', { name: 'Favoris', exact: true }).click()
  await expect(page.locator('.document-card')).toHaveCount(1)
  await expect(page.locator('.document-card h3')).toHaveText(title)
  await page.reload()
  await expect(page.locator('.document-card h3')).toHaveText(title)
  await page.getByRole('button', { name: 'Retirer des favoris', exact: true }).click()
  await expect(page.getByText('Aucun document dans cette sélection.')).toBeVisible()
})

test('library filtering and pagination expose the complete deduplicated catalogue', async ({ page }) => {
  await page.goto('/#/library')
  await expect(page.getByRole('heading', { name: '78 documents', exact: true })).toBeVisible()
  await page.getByLabel('Inclure les projets non confirmés').check()
  await expect(page.getByRole('heading', { name: '80 documents', exact: true })).toBeVisible()
  await expect(page.locator('.document-card')).toHaveCount(12)
  while (await page.getByRole('button', { name: 'Afficher 12 documents de plus' }).count()) {
    await page.getByRole('button', { name: 'Afficher 12 documents de plus' }).click()
  }
  await expect(page.locator('.document-card')).toHaveCount(80)
  await page.getByLabel('Rechercher un titre').fill('observatoire')
  await page.getByRole('button', { name: 'Filtrer', exact: true }).click()
  await expect(page.locator('.document-card')).toHaveCount(8)
  await page.getByLabel('Catégorie', { exact: true }).selectOption('texts')
  await expect(page.getByText('Aucun document dans cette sélection.')).toBeVisible()
})

test('drafts are excluded unless requested and no result is not a fabricated answer', async ({ page }) => {
  await page.goto('/#/assistant')
  await page.getByLabel('Votre question').fill('cartes couverture')
  await page.getByRole('button', { name: 'Rechercher les passages', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Passages retrouvés', exact: true })).toBeVisible()
  await expect(page.locator('.source-card .draft-label')).toHaveCount(0)
  await page.getByLabel('Inclure les projets non confirmés').check()
  await page.getByRole('button', { name: 'Rechercher les passages', exact: true }).click()
  await expect(page.locator('.source-card .draft-label')).toHaveCount(1)
  await page.getByLabel('Votre question').fill('zzzzinexistant123')
  await page.getByRole('button', { name: 'Rechercher les passages', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Aucun passage concordant', exact: true })).toBeVisible()
  await expect(page.locator('.source-card')).toHaveCount(0)
  await expect(page.getByText(/Cette absence ne prouve pas/)).toBeVisible()
})

test('catalogue and search failures are explicit and recoverable', async ({ page }) => {
  await page.route('**/api/catalogue', (route) => route.fulfill({
    status: 503, contentType: 'application/json', body: JSON.stringify({ error: 'Service de test indisponible.' }),
  }))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Le corpus est indisponible')
  await page.unroute('**/api/catalogue')
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(page.getByRole('link', { name: '80 Sources distinctes' })).toBeVisible()
  await page.getByRole('navigation').getByRole('link', { name: 'Assistant', exact: true }).click()
  await page.route('**/api/search?**', (route) => route.fulfill({
    status: 500, contentType: 'application/json', body: JSON.stringify({ error: 'Erreur de recherche test.' }),
  }))
  await page.getByLabel('Votre question').fill('cryptographie')
  await page.getByRole('button', { name: 'Rechercher les passages', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Erreur de recherche test')
  await page.unroute('**/api/search?**')
  await page.getByRole('button', { name: 'Réessayer', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Passages retrouvés', exact: true })).toBeVisible()
})

test('deep links, invalid pages, OCR warnings and quality counts remain visible', async ({ page }) => {
  const id = '87ba48fe1e7ca1dd6e073a5167c72863f9ff44cf46b2c92f7800276853fabb52'
  await page.goto(`/#/document/${id}/1`)
  await expect(page.getByText('OCR non revu', { exact: true })).toBeVisible()
  await expect(page.getByText(/score OCR 94.96/)).toBeVisible()
  await expect(page.locator('.page-text')).toContainText('First-class establishments')
  await page.goto(`/#/document/${id}/2`)
  await expect(page.getByRole('alert')).toContainText('Page introuvable')
  await page.getByRole('navigation').getByRole('link', { name: 'Sources', exact: true }).click()
  await expect(page.locator('dd')).toHaveText(['89', '9', '1174', '136', '15'])
})

test('corrupt favorite storage reports an error without breaking the application', async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem('telecom-document-favorites-v1', '{broken'))
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('favoris enregistrés sont illisibles')
  await expect(page.getByRole('link', { name: '80 Sources distinctes' })).toBeVisible()
})
