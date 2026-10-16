import { institutions } from './data/institutions'

export const DOSSIER_KEY = 'mon-assistant.demo-dossiers.v1'
export const statuses = ['Brouillon local', 'Examen simulé', 'Scénario terminé'] as const
export interface Dossier {
  id: string
  institutionId: string
  subject: string
  createdAt: string
  stage: 0 | 1 | 2
}

export function loadDossiers(): Dossier[] {
  const raw = localStorage.getItem(DOSSIER_KEY)
  if (!raw) return []
  const value: unknown = JSON.parse(raw)
  if (!Array.isArray(value) || value.length > 50) throw new Error('Registre local invalide.')
  const valid = value.every((item: unknown) =>
    typeof item === 'object' && item !== null &&
    'id' in item && typeof item.id === 'string' && item.id.length <= 50 &&
    'institutionId' in item && institutions.some((institution) => institution.id === item.institutionId) &&
    'subject' in item && typeof item.subject === 'string' && item.subject.trim().length > 0 && item.subject.length <= 120 &&
    'createdAt' in item && typeof item.createdAt === 'string' && Number.isFinite(Date.parse(item.createdAt)) &&
    'stage' in item && (item.stage === 0 || item.stage === 1 || item.stage === 2),
  )
  if (!valid) throw new Error('Les dossiers locaux ont un format invalide. Ils ne seront pas écrasés.')
  return value as Dossier[]
}

export function saveDossiers(dossiers: Dossier[]) {
  localStorage.setItem(DOSSIER_KEY, JSON.stringify(dossiers))
}
