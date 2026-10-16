export const activities = { telecom: 'Télécoms / fournisseur', installation: 'Installation de réseaux', logiciel: 'Logiciels et informatique', commerce: 'Vente d’équipements', consommateur: 'Consommateur', autre: 'À qualifier' }
export const kinds = { particulier: 'Particulier', entreprise: 'Entreprise', independant: 'Indépendant', cabinet: 'Cabinet / agence', investisseur: 'Investisseur' }
export const statuses = { preparation: 'En préparation', pret: 'Prêt à déposer', depot_declare: 'Dépôt déclaré', instruction_declaree: 'Instruction déclarée', complement: 'Complément demandé', decision: 'Décision déclarée', refuse: 'Refus déclaré', archive: 'Archivé' }
export const categories = { initial: 'Initial', annuel: 'Annuel', renouvellement: 'Renouvellement', garantie: 'Garantie', commercial: 'Prestation commerciale' }
export const money = (value: string | null) => value === null ? 'À déterminer' : `${Number(value).toLocaleString('fr-FR')} FCFA`
export const label = (items: Record<string, string>, key: string) => items[key] || key
