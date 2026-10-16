import { readFile, writeFile, mkdir } from 'node:fs/promises'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'

const exec = promisify(execFile)

const audit = JSON.parse(await readFile(new URL('../source-audit/research.json', import.meta.url), 'utf8'))
const verifiedPhotos = {
  minjustice: 'File:Ministère de la Justice Cameroun.jpg',
  minpostel: 'File:Ministère des postes ettélécommunications Yaounde Cameroun.jpg',
  mincom: 'File:Ministère de la communication.jpg',
  minfi: 'File:Ministry of Finance (MinFin), Yaoundé (2014).JPG',
  minac: 'File:Facade Delegation Regionale MINAC Maroua.jpg',
  minesup: 'File:Minesup Yaoundé.jpg',
}
const url = new URL('https://commons.wikimedia.org/w/api.php')
url.search = new URLSearchParams({ action: 'query', format: 'json', titles: Object.values(verifiedPhotos).join('|'), prop: 'imageinfo', iiprop: 'url|extmetadata' })
const response = await fetch(url, { signal: AbortSignal.timeout(30000) })
if (!response.ok) throw new Error(`Commons: HTTP ${response.status}`)
const metadata = await response.json()
const pages = Object.values(metadata.query.pages)
const imageDir = new URL('../public/institutions/', import.meta.url)
await mkdir(imageDir, { recursive: true })
const photos = {}
for (const [id, title] of Object.entries(verifiedPhotos)) {
  const page = pages.find((p) => p.title === title)
  const image = page?.imageinfo?.[0]
  if (!image || image.extmetadata.LicenseShortName.value !== 'CC BY-SA 4.0') throw new Error(`Photo/licence non confirmée: ${id}`)
  const imageUrl = new URL(image.url)
  imageUrl.search = ''
  const destination = new URL(`${id}.jpg`, imageDir)
  await exec('curl', ['--fail', '--location', '--retry', '2', '--max-time', '45', imageUrl.href, '-o', fileURLToPath(destination)])
  const bytes = await readFile(destination)
  if (bytes[0] !== 0xff || bytes[1] !== 0xd8) throw new Error(`Format JPEG invalide: ${id}`)
  photos[id] = {
    src: `/institutions/${id}.jpg`,
    originalUrl: imageUrl.href,
    sourceUrl: image.descriptionurl,
    credit: image.extmetadata.Artist.value.replace(/<[^>]*>/g, '').trim(),
    license: image.extmetadata.LicenseShortName.value,
    licenseUrl: image.extmetadata.LicenseUrl.value,
    alt: image.extmetadata.ImageDescription.value.replace(/<[^>]*>/g, '').trim(),
    verifiedAt: '2026-10-16',
    confidence: 'documented',
    note: id === 'minac' ? 'Délégation régionale à Maroua, et non siège central.' : 'Photographie documentaire ; elle ne garantit pas l’état actuel des locaux.',
  }
  console.log(`${id}: ${bytes.length} octets; ${photos[id].credit}; ${photos[id].license}`)
}
const evidence = audit.map((row) => ({
  id: row.id,
  consultedAt: row.consultedAt,
  sourceUrl: row.sourceUrl,
  available: row.primaryAvailable,
  missionAvailable: row.excerpt.length > 0,
  photoSearchUrl: row.photoSearchUrl,
  photoSearchError: row.photoSearchError,
  photo: photos[row.id] ?? null,
}))
await writeFile(new URL('../src/data/verified-evidence.json', import.meta.url), JSON.stringify(evidence, null, 2) + '\n')
