import { readdir, readFile, mkdir } from 'node:fs/promises'
import { chromium } from '@playwright/test'
import { join } from 'node:path'

const seeds = JSON.parse(await readFile('src/data/institution-seeds.json', 'utf8'))
const files = await readdir('test-results', { recursive: true })
await mkdir('docs/visual', { recursive: true })
const browser = await chromium.launch()
try {
  const page = await browser.newPage({ viewport: { width: 1540, height: 900 }, deviceScaleFactor: 1 })
  for (const width of [1440, 390]) {
    for (const theme of ['light', 'dark']) {
      const cards = []
      for (const institution of seeds) {
        const name = `${institution.id}-${width}-${theme}.png`
        const path = files.find((file) => file.endsWith(`/${name}`))
        if (!path) throw new Error(`Capture manquante : ${name}`)
        const data = await readFile(join('test-results', path))
        cards.push(`<figure><figcaption>${institution.acronym}</figcaption><img alt="${institution.acronym}" src="data:image/png;base64,${data.toString('base64')}" /></figure>`)
      }
      await page.setContent(`<html lang="fr"><head><title>Validation ${width} ${theme}</title><style>body{margin:0;padding:20px;background:#e7ebe9;font:14px Arial}h1{font-size:22px}main{display:grid;grid-template-columns:repeat(6,1fr);gap:12px}figure{margin:0;background:white;border:1px solid #b2bcb5;padding:4px}figcaption{padding:8px;font-weight:bold}img{width:100%;height:280px;object-fit:cover;object-position:top;display:block}</style></head><body><h1>39 espaces - ${width}px - ${theme} - vues de controle</h1><main>${cards.join('')}</main></body></html>`)
      await page.locator('img').evaluateAll((images) => Promise.all(images.map((image) => image.decode())))
      await page.screenshot({ path: `docs/visual/institutions-${width}-${theme}.png`, fullPage: true })
      console.log(`${width}/${theme} : ${cards.length} captures assemblees`)
    }
  }
} finally {
  await browser.close()
}
