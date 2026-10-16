import seeds from './institution-seeds.json' with { type: 'json' }
import evidence from './verified-evidence.json' with { type: 'json' }

export const VERIFICATION_DATE = '2026-10-16'
export const GOVERNMENT_SOURCE = 'https://www.spm.gov.cm/site/'

export type Confidence = 'Source primaire' | 'Source documentaire' | 'À confirmer' | 'Non documenté'
export interface FactCheck {
  confidence: Confidence
  sources: string[]
  checkedAt: string
  confirmed: string
  uncertainty: string | null
}
export interface Service {
  id: string
  title: string
  description: string
  sourceUrl: string
  verifiedAt: string
  confidence: Confidence
  requirements: string[] | null
  steps: string[] | null
}
export interface Photo {
  src: string
  originalUrl: string
  sourceUrl: string
  credit: string
  license: string
  licenseUrl: string
  alt: string
  verifiedAt: string
  confidence: string
  note: string
}
export interface Institution {
  id: string
  acronym: string
  name: string
  category: string
  description: string
  officialUrl: string
  portalUrl: string | null
  photo: Photo | null
  palette: null
  services: Service[]
  contact: { phone: string; email: string; sourceUrl: string } | null
  integration: 'Information documentaire'
  lastVerifiedAt: string
  photoSearchUrl: string
  verification: Record<'name' | 'acronym' | 'description' | 'portal' | 'photo' | 'palette' | 'services' | 'contact', FactCheck>
}

const portals: Record<string, string> = {
  minader: 'https://www.minader.cm/',
  minddevel: 'https://www.minddevel.gov.cm/contact/',
  minesup: 'https://www.minesup.gov.cm/index.php/category/equivalences/',
  minfi: 'https://minfi.gov.cm/',
  minfopra: 'https://www.minfopra.gov.cm/index.php/fr/',
  dgsn: 'https://www.dgsn.cm/',
}

const services: Record<string, Service[]> = {
  minfi: [{
    id: 'niu',
    title: 'Immatriculation fiscale : NIU',
    description: "La DGI annonce l'obtention du Numéro d'Identifiant fiscal Unique en ligne. Information publiée en 2020 : vérifier les conditions actuelles auprès de la DGI.",
    sourceUrl: 'https://www.impots.cm/fr/actualites/immatriculation-en-ligne',
    verifiedAt: VERIFICATION_DATE, confidence: 'Source primaire', requirements: null, steps: null,
  }],
  minesup: [{
    id: 'equivalences',
    title: 'Équivalences de diplômes étrangers',
    description: "La rubrique officielle documente l'examen des formations étrangères par la CNE. La publication consultée concerne une session de 2022, pas une procédure actualisée de dépôt.",
    sourceUrl: 'https://www.minesup.gov.cm/index.php/category/equivalences/',
    verifiedAt: VERIFICATION_DATE, confidence: 'Source primaire', requirements: null, steps: null,
  }],
  minfopra: [{
    id: 'resultats-enam',
    title: "Résultats du concours d'entrée à l'ENAM",
    description: "Le portail publie les résultats définitifs du concours d'entrée à l'ENAM 2026-2027. Consultation externe, sans inscription ni dépôt depuis Mon Assistant.",
    sourceUrl: 'https://www.minfopra.gov.cm/index.php/fr/',
    verifiedAt: VERIFICATION_DATE, confidence: 'Source primaire', requirements: null, steps: null,
  }],
}

function fact(confidence: Confidence, sources: string[], confirmed: string, uncertainty: string | null = null): FactCheck {
  return { confidence, sources, checkedAt: VERIFICATION_DATE, confirmed, uncertainty }
}

export const institutions: Institution[] = seeds.map((seed): Institution => {
  const proof = evidence.find((item) => item.id === seed.id)
  if (!proof?.available) throw new Error(`Preuve institutionnelle manquante : ${seed.id}`)
  const portalUrl = portals[seed.id] ?? null
  const institutionServices = services[seed.id] ?? []
  const contact = seed.id === 'minddevel' ? {
    phone: '(+237) 222 213 992', email: 'contact@minddevel.gov.cm', sourceUrl: 'https://www.minddevel.gov.cm/contact/',
  } : null
  return {
    ...seed,
    description: proof.missionAvailable ? seed.description : "Institution recensée par la Primature. Les missions détaillées restent à documenter dans ce registre.",
    officialUrl: proof.sourceUrl,
    portalUrl,
    photo: proof.photo,
    palette: null,
    services: institutionServices,
    contact,
    integration: 'Information documentaire',
    lastVerifiedAt: VERIFICATION_DATE,
    photoSearchUrl: proof.photoSearchUrl,
    verification: {
      name: fact('Source primaire', [GOVERNMENT_SOURCE, proof.sourceUrl], "Intitulé institutionnel recoupé avec l'annuaire et la fiche de la Primature.", "La consultation ne garantit pas l'exhaustivité des changements réglementaires récents."),
      acronym: fact('À confirmer', [proof.sourceUrl], 'Sigle utilisé comme repère dans le prototype.', "L'usage officiel de ce sigle n'a pas été vérifié individuellement."),
      description: fact(proof.missionAvailable ? 'Source primaire' : 'Non documenté', [proof.sourceUrl], proof.missionAvailable ? 'Synthèse des compétences de la fiche officielle, sans ajout de procédure.' : 'Missions détaillées non récupérées sur la fiche consultée.', 'Les textes cités sur le portail peuvent être anciens.'),
      portal: fact(portalUrl ? 'Source primaire' : 'Non documenté', portalUrl ? [portalUrl] : [], portalUrl ? 'Page du portail institutionnel consultée.' : 'Portail autonome non vérifié ; seule la fiche de la Primature est proposée.'),
      photo: fact(proof.photo ? 'Source documentaire' : 'Non documenté', proof.photo ? [proof.photo.sourceUrl] : [proof.photoSearchUrl], proof.photo ? 'Sujet contrôlé visuellement, crédit et licence Commons consultés.' : 'Recherche effectuée ; aucun visuel authentifié et réutilisable retenu.', proof.photo?.note ?? 'Un résultat de recherche ne constitue pas une authentification. Illustration de remplacement affichée.'),
      palette: fact('Non documenté', portalUrl ? [portalUrl] : [proof.sourceUrl], 'Système neutre Mon Assistant ; aucune couleur ni typographie revendiquée comme officielle.', 'Aucune charte ni autorisation de réutilisation de logo documentée.'),
      services: fact(institutionServices.length ? 'Source primaire' : 'Non documenté', institutionServices.map((service) => service.sourceUrl), institutionServices.length ? 'Ressources documentaires associées aux compétences, consultables sur le site source.' : 'Aucune démarche détaillée vérifiée dans cette version.', 'Pièces, étapes de dépôt, tarifs et délais non vérifiés : ils ne sont pas inventés.'),
      contact: fact(contact ? 'Source primaire' : 'Non documenté', contact ? [contact.sourceUrl] : [], contact ? 'Coordonnées de la division de la communication, page Contact.' : 'Coordonnées non vérifiées, non affichées.'),
    },
  }
}).sort((a, b) => a.name.localeCompare(b.name, 'fr'))

export const categories = [...new Set(institutions.map((institution) => institution.category))].sort((a, b) => a.localeCompare(b, 'fr'))
export function normalizeSearch(value: string) {
  return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLocaleLowerCase('fr').replace(/[’']/g, ' ')
}
export function findInstitutions(query: string, category: string, onlyPhotos: boolean) {
  const terms = normalizeSearch(query.trim()).split(/\s+/)
  return institutions.filter((institution) => {
    const text = normalizeSearch([institution.name, institution.acronym, institution.description, ...institution.services.map((service) => service.title)].join(' '))
    return (!category || institution.category === category) && (!onlyPhotos || Boolean(institution.photo)) && terms.every((term) => text.includes(term))
  })
}
