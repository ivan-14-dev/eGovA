import { expect, test } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test('dashboard and tools support mobile, desktop and both themes', async ({ page }) => {
  test.setTimeout(120_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: 1000 })
    for (const theme of ['light', 'dark']) {
      await page.goto('/')
      await page.getByLabel('Thème', { exact: true }).selectOption(theme)
      for (const route of ['/', '/assistant', '/offres', '/veille', '/audit', '/tarifs']) {
        await page.goto(`/#${route}`)
        await expect(page.locator('.ws-main h1')).toBeVisible()
        expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
        const results = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
        expect.soft(results.violations.map((issue) => ({ id: issue.id, nodes: issue.nodes.map((node) => ({ target: node.target, failure: node.failureSummary })) })), `${route} at ${width}px, ${theme}`).toEqual([])
      }
    }
  }
  expect(errors).toEqual([])
})

test('mobile navigation, guided assistant and notifications work', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await page.getByRole('button', { name: 'Ouvrir le menu', exact: true }).click()
  await page.getByRole('link', { name: 'Mon assistant IA' }).click()
  await expect(page).toHaveURL(/assistant$/)
  await expect(page.getByRole('button', { name: 'Fermer la navigation' })).toHaveCount(0)
  await page.getByRole('textbox', { name: 'Votre question' }).fill('Que faire pour un nouveau décret ?')
  await page.getByRole('button', { name: 'Envoyer la question' }).click()
  await expect(page.locator('.ws-answer')).toContainText('Aucun nouveau décret ni aucune sanction ne sont vérifiés ici')
  await page.getByRole('button', { name: 'Ouvrir les notifications' }).click()
  await expect(page.getByRole('dialog')).toContainText('Aucune veille automatique')
  await page.getByRole('link', { name: 'Voir les appels d’offres' }).click()
  await expect(page).toHaveURL(/offres$/)
  await expect(page.getByRole('dialog')).toHaveCount(0)
})

test('opportunities filter and keep independent response checklists', async ({ page }) => {
  await page.goto('/#/offres')
  await expect(page.locator('.ws-tender')).toHaveCount(3)
  await page.getByRole('button', { name: 'Réseaux', exact: true }).click()
  await expect(page.locator('.ws-tender')).toHaveCount(1)
  await page.getByRole('button', { name: 'Voir l’opportunité' }).click()
  await page.getByRole('checkbox').first().check()
  await expect(page.getByRole('status')).toHaveText('1 / 5 étapes préparées')
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await page.getByRole('button', { name: 'Conseil', exact: true }).click()
  await page.getByRole('button', { name: 'Voir l’opportunité' }).click()
  await expect(page.getByRole('status')).toHaveText('0 / 5 étapes préparées')
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await page.getByRole('button', { name: 'Réseaux', exact: true }).click()
  await page.getByRole('button', { name: 'Voir l’opportunité' }).click()
  await expect(page.getByRole('checkbox').first()).toBeChecked()
  await page.getByRole('button', { name: 'Fermer', exact: true }).click()
  await page.getByRole('textbox', { name: 'Rechercher un appel d’offres' }).fill('inexistant')
  await expect(page.locator('.ws-tender')).toHaveCount(0)
  await expect(page.getByRole('status')).toContainText('Aucune opportunité')
})

test('audit measures preparation and tariffs calculate actual differences', async ({ page }) => {
  await page.goto('/#/audit')
  await page.getByRole('checkbox').first().check()
  await page.getByRole('checkbox').nth(1).check()
  await expect(page.getByRole('progressbar')).toHaveAttribute('value', '2')
  await expect(page.locator('.ws-audit-score > strong')).toHaveText('40%')
  await page.getByRole('checkbox').first().uncheck()
  await expect(page.locator('.ws-audit-score > strong')).toHaveText('20%')
  await page.goto('/#/tarifs')
  await page.getByLabel('Votre prix (FCFA)').fill('120000')
  await page.getByLabel('Prix de référence (FCFA)').fill('100000')
  await page.getByRole('button', { name: 'Comparer les prix' }).click()
  await expect(page.getByRole('status')).toContainText('20 % au-dessus')
  await page.getByLabel('Votre prix (FCFA)').fill('0')
  await expect(page.getByRole('status')).toHaveCount(0)
  await page.getByRole('button', { name: 'Comparer les prix' }).click()
  await expect(page.getByRole('status')).toContainText('100 % en dessous')
  await page.getByLabel('Votre prix (FCFA)').fill('100000')
  await page.getByRole('button', { name: 'Comparer les prix' }).click()
  await expect(page.getByRole('status')).toContainText('identique à la référence')
})

test('regulatory details explain uncertainty and preserve institution navigation', async ({ page }) => {
  await page.goto('/#/veille')
  await page.getByRole('button', { name: /Votre autorisation d’activité/ }).click()
  await expect(page.getByRole('dialog')).toContainText('Aucune amende, suspension ou autre sanction')
  await page.getByRole('link', { name: 'Consulter les ressources du MINPOSTEL' }).click()
  await expect(page.getByRole('heading', { level: 1 })).toContainText('Ministère des Postes')
  await page.getByRole('link', { name: 'Retour au catalogue' }).click()
  await expect(page.getByTestId('institution-card')).toHaveCount(39)
  await page.getByRole('link', { name: 'Mon espace', exact: true }).click()
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Bienvenue dans votre espace.')
})
