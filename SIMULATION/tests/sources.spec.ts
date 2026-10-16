import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { setTimeout as delay } from 'node:timers/promises'
import { institutions } from '../src/data/institutions'

test('@sources checks every published documentary link', async ({ request }) => {
  test.setTimeout(300_000)
  const urls = [...new Set(institutions.flatMap((item) => [
    item.officialUrl, ...(item.portalUrl ? [item.portalUrl] : []),
    ...item.services.map((service) => service.sourceUrl),
    ...(item.photo ? [item.photo.sourceUrl, item.photo.originalUrl, item.photo.licenseUrl] : []),
    ...(item.contact ? [item.contact.sourceUrl] : []),
  ]))]
  const results: { url: string; ok: boolean; status: number | null; error: string | null }[] = []
  for (const url of urls) {
    try {
      let response = await request.get(url, { timeout: 30_000, maxRetries: 2 })
      if (response.status() === 429) {
        const retryAfter = response.headers()['retry-after']
        const seconds = retryAfter ? Number(retryAfter) : 10
        if (Number.isFinite(seconds) && seconds >= 0 && seconds <= 30) {
          console.warn(`Limitation de requêtes : ${url}. Nouvelle tentative après ${seconds} secondes.`)
          await delay(seconds * 1000)
          response = await request.get(url, { timeout: 30_000, maxRetries: 2 })
        }
      }
      results.push({ url, ok: response.ok(), status: response.status(), error: null })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`Lien non vérifiable : ${url}`, message)
      results.push({ url, ok: false, status: null, error: message })
    }
    await delay(250)
  }
  await mkdir('docs', { recursive: true })
  await writeFile('docs/link-checks.json', JSON.stringify({ checkedAt: new Date().toISOString(), results }, null, 2) + '\n')
  expect(results.filter((result) => !result.ok)).toEqual([])
})
