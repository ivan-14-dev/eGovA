# 03 — Prix de prestations, budgets et coûts de candidature

[Accueil](README.md) · [Sources PUB01–PUB46](01_sources.md) · [Démarches](02_acteurs_procedures.md)

## 1. Réponse : trouve-t-on des prix ?

**Oui, mais de natures et de périodes différentes.** Le corpus ne permet pas d'annoncer un barème complet des prestations télécoms actuellement commercialisées en octobre 2026.

| Nature | Présence | Utilisation correcte |
|---|---|---|
| Tarifs télécoms de détail et d'interconnexion | Oui, notamment Observatoire 2022 | Comparaison historique par opérateur, réseau et unité ; pas devis actuel |
| Tarifs data hors forfait | Oui, tableaux anciens avec suspension de facturation signalée | Contexte historique ; ne pas les activer comme prix facturable |
| Prix moyens statistiques | Oui : revenus rapportés au trafic/abonnements | Analyse économique, pas prix d'une offre déterminée |
| Budgets de prestations/fournitures | Oui, avis 2024/2025 | Enveloppes prévisionnelles du maître d'ouvrage, pas prix attribués |
| Montants attribués | Oui, nettoyage et fournitures 2025 | Référence d'un marché précis et de sa durée, pas tarif universel |
| Bordereaux de prix unitaires détaillés | Non établis dans les avis exploités | Obtenir BPU/DQE, spécifications et contrat ; ne pas inventer prix par cartouche, m² ou véhicule à partir d'un total |
| Frais de dossier et garanties | Oui, pour les marchés identifiés | Coût ponctuel de candidature versus montant garanti |
| Redevances légales, agréments et certificats | Oui, dans les recueils dupliqués | Reprendre le [budget réglementaire](../referentiel-telecom/04_finances_calendrier.md), sous réserve des signaux de mise à jour |
| Devis actuels d'audit, installation, maintenance réseau, fibre, hébergement ou conseil | Non établis ici | Demander devis/catalogue daté et périmètre ; `ND` ne signifie pas gratuit |

Montants en **FCFA/XAF**. L'indication **HT/TTC n'est reprise que lorsqu'elle est explicite**. Ne pas ajouter automatiquement une TVA, une redevance ou un abonnement annuel.

## 2. Tarifs télécoms retrouvés — année économique 2022

### 2.1. Interconnexion, marché de gros

Source : **PUB22, tableau 15 p. 33**, complété pour CAMTEL fixe par tableau 8 p. 21 et commentaire p. 22.

| Réseau / opérateur | Terminaison voix HT, FCFA/minute | Terminaison SMS HT, montant associé au SMS | Période |
|---|---:|---:|---|
| ORANGE mobile | 8 | 3 | 2022 |
| MTN mobile | 8 | 3 | 2022 |
| VIETTEL mobile | 11 | 5 | 2022 |
| CAMTEL mobile | 12 | 5 | 2022 |
| CAMTEL fixe | 12 | 5 | 2022 |

**Réserve d'unité :** les tableaux portent à certains endroits « FCFA/min » dans la colonne SMS ; le texte parle de tarifs SMS et, pour CAMTEL fixe, précise « 5 FCFA le SMS ». Les valeurs sont classées ici par service, avec cette anomalie conservée. Confirmer le catalogue contractuel avant tout calcul de facture. Un prix de terminaison de gros n'est pas le prix facturé à un abonné.

PUB17, p. 10, évoque en 2025 une légère baisse des tarifs d'interconnexion dans le commentaire du marché **2024**. Il ne fournit pas dans ce passage une grille complète permettant de remplacer les montants 2022 : **ne pas soustraire automatiquement 1 FCFA à toutes les lignes**.

### 2.2. Offres mobiles de base, détail

Source : **PUB22, tableau 16 p. 34 et tableau 17 p. 35**, année 2022. La qualification fiscale n'est pas explicitée dans ces tableaux : **HT/TTC à confirmer**.

| Opérateur | Voix off-net, FCFA/min | Voix on-net, FCFA/min | SMS off-net | SMS on-net |
|---|---:|---:|---:|---:|
| ORANGE | 91,8 | 61,2 | 51 | 51 |
| MTN | 91,8 | 61,2 | 51,05 | 30,63 |
| VIETTEL | 66 | 54 | **NA** | **NA** |
| CAMTEL mobile | 60 | 60 | 25 | 15 |

- `on-net` : même réseau ; `off-net` : autre réseau.
- Les colonnes SMS comportent la même anomalie d'unité que ci-dessus ; les nombres ne sont pas des prix à la minute de SMS.
- `NA` est la valeur publiée pour VIETTEL en 2022 : **ne pas reprendre automatiquement les 35/25 de 2021**.
- PUB22 p. 36 précise que forfaits prépayés et offres groupées conduisent à des prix réels différents des tarifs de base.

### 2.3. CAMTEL, réseau hertzien fixe

Source : **PUB22, tableau 9 p. 22**, période 2019-2022 ; HT/TTC non explicité.

| Service | Valeur publiée |
|---|---:|
| Voix off-net | 85 FCFA/min |
| Voix on-net, heures pleines | 25 FCFA/min |
| Voix on-net, heures creuses | 15 FCFA/min |
| SMS off-net | 45 FCFA par SMS, sous réserve de l'unité erronée du tableau |
| SMS on-net | 20 FCFA par SMS, même réserve |

Ne pas fusionner ces tarifs avec ceux de la concession **mobile CAMTEL**, ni présumer que les anciens services hertziens sont toujours proposés dans les mêmes conditions.

### 2.4. Data et moyennes : chiffres à ne pas transformer en devis

| Source / période | Valeurs présentes | Limite déterminante |
|---|---|---|
| PUB27 p. 40, 2021, fichier « Projet » | Tableau hors forfait : MTN **51,2 FCFA/MB** ; ORANGE **61,4** ; VIETTEL **25** ; CAMTEL **30** | Note immédiatement associée : arrêt de facturation Internet mobile sur compte principal après épuisement du volume, suspension depuis 2019. **Pas des offres facturables certifiées** |
| PUB23 p. 49, 2019 | CAMTEL **30 FCFA/Mo** ; VIETTEL **25 FCFA/MB** dans tableau ; ORANGE « selon forfait » | Le même passage signale la suspension du hors forfait mobile. MTN « FCFA/Kbps » est une unité problématique : ne pas convertir en FCFA/Go |
| PUB22 p. 31-32, 2022 | Revenu moyen **6,92 FCFA/min**, **1,84 FCFA/SMS**, **456 FCFA/Go**, ARPU **1 752 FCFA/mois** | Ratios économiques agrégés, pas prix de vente d'un forfait ni abonnement imposé |
| PUB22 p. 40, 2022 | Souscription de forfaits Internet expliquée | Pas de grille exhaustive montant/volume/durée des forfaits dans cette section |

Pour chiffrer une connectivité professionnelle actuelle : fournisseur, technologie, débit garanti, volume, SLA, disponibilité, durée, frais d'installation, maintenance, taxes et date de validité du devis sont nécessaires.

### 2.5. Où retrouver les séries plus anciennes

PUB20 p. 6 décrit une baisse historique des cartes SIM **de 500 à 100 FCFA** ; ce n'est pas un tarif d'identification réglementaire. Comparaisons tarifaires dans PUB21 p. 21/26, PUB24 p. 31, PUB25 p. 31, PUB26 p. 37, PUB23 p. 25-26/42-45 et PUB27 p. 20-21/32-35. Les recueils statistiques PUB28/PUB32 et les magazines anciens sont des compléments historiques, pas des grilles 2026.

## 3. Budgets des marchés et dépenses de candidature

### 3.1. Vue par consultation

| Avis | Prestation | Budget prévisionnel | Frais de dossier non remboursables | Caution publiée | Durée de prestation |
|---|---|---:|---:|---:|---|
| PUB01/PUB06, nettoyage 2025 | Direction générale, délégations et antennes, cinq lots | **241 353 876 TTC** | **150 000** | Par lot, tableau suivant | **9 mois** |
| PUB03/PUB04, véhicules avril 2025 | Quatorze véhicules, six lots | **568 000 000 TTC** | **250 000** | Par lot, tableau suivant | **90 jours** après notification de l'ordre de service |
| PUB05, véhicules mars 2025 | Quatorze véhicules, quatre lots | **568 000 000 TTC** | **250 000** | **11 360 000**, montant global tel que publié | **90 jours** après notification de l'ordre de service |
| PUB07, nettoyage 2024 | Direction générale et Nkomo | **120 000 000**, HT/TTC non précisé dans le coût prévisionnel | **150 000** | **2 400 000** | **12 mois** |
| PUB08, fournitures de bureau 2024 | Livraison de consommables et petit matériel | **50 000 000 TTC** | **50 000** | **1 000 000** | **1 mois** |
| PUB09, encres 2024 | Cartouches imprimantes/copieurs | **50 000 000 TTC** | **50 000** | **1 000 000** | **1 mois** |
| PUB02, fournitures de bureau 2025 | Livraison de consommables et petit matériel | **50 000 000 TTC** | **50 000** | **1 000 000** | **1 mois** |
| PUB10, encres 2025 | Cartouches imprimantes/copieurs | **50 000 000 TTC** | **50 000** | **1 000 000** | **1 mois** |

Sources : avis respectifs p. 1-3 ; PUB03/PUB05 délai p. 1 et frais p. 2. Les cautions sont des **montants garantis**, pas des honoraires bancaires ni des taxes. Le coût d'émission, l'immobilisation, la restitution ou une éventuelle mise en jeu dépendent des conditions applicables ; aucun tarif de frais CDEC n'est établi ici.

**Ne pas additionner les deux avis véhicules comme deux acquisitions certaines de 568 millions.** La référence, le nombre de lots et les cautions diffèrent. Le corpus ne démontre pas à lui seul l'annulation/remplacement de l'un par l'autre.

### 3.2. Nettoyage 2025 : détail des lots

Source : PUB01/PUB06 p. 1-2 ; ces montants concernent **neuf mois**, pas une année.

| Lot | Périmètre | Budget TTC | Caution |
|---|---|---:|---:|
| 1 | Direction générale, centre de documentation/archives et laboratoire Nkomo | 121 353 876 | 2 427 078 |
| 2 | Yaoundé, Bertoua, Ebolowa | 30 000 000 | 600 000 |
| 3 | Douala, Limbé | 30 000 000 | 600 000 |
| 4 | Bamenda, Bafoussam | 30 000 000 | 600 000 |
| 5 | Garoua, Ngaoundéré, Maroua | 30 000 000 | 600 000 |

L'avis impose de souscrire aux **cinq lots**, mais limite l'attribution à **deux lots au plus par soumissionnaire**. Vérifier le dossier complet pour la présentation des garanties ; ne pas inventer une seconde taxe de dossier par lot.

### 3.3. Véhicules avril 2025 : détail des six lots

Source : PUB03/PUB04 p. 1-2.

| Lot | Fourniture | Budget TTC | Caution publiée |
|---|---|---:|---:|
| 1 | Un Station Wagon 4x4 | 68 640 000 | 500 000 |
| 2 | Une berline de fonction | 88 400 000 | 550 000 |
| 3 | Un SUV berline | 41 600 000 | 400 000 |
| 4 | Cinq SUV | 151 000 000 | 600 000 |
| 5 | Cinq pick-up 4x4 | 152 640 000 | 600 000 |
| 6 | Un bus de 30 places | 65 720 000 | 500 000 |
| **Total du budget** | **14 véhicules** | **568 000 000** | Ne pas substituer un pourcentage théorique aux montants par lot |

Un candidat peut soumissionner et être attributaire d'un ou plusieurs lots selon cet avis. Le coût total d'un lot peut inclure accessoires, livraison et autres exigences : une division par le nombre de véhicules n'établit pas un prix unitaire contractuel.

## 4. Montants effectivement annoncés comme attribués

### 4.1. Fournitures 2025

Source : **PUB33 p. 1**, communiqué du 17 mars 2025, décisions 63 et 64 citées.

| Marché | Adjudicataire indiqué | Proposition financière TTC retenue | Délai |
|---|---|---:|---|
| Encres, avis 40/2025 | Établissement AFA | **49 929 975** | 1 mois |
| Fournitures de bureau, avis 41/2025 | Établissement Groupe La Confiance | **49 912 099** | 1 mois |

Ce sont des résultats d'attribution, pas une preuve que les prestations ont été réceptionnées ou payées.

### 4.2. Nettoyage 2025

Source : **PUB34 p. 1**, communiqué du 10 avril 2025, décision 82 citée.

| Lot | Adjudicataire indiqué | Proposition financière TTC retenue | Délai |
|---|---|---:|---|
| 1 | AGZ GROUP | **120 344 531** | 9 mois |
| 2 | ETS THE INTERMEDIATE | **28 011 825** | 9 mois |
| 3 | ETS DANEK | **27 024 435** | 9 mois |
| 4 | ETS DANEK | **25 000 000** | 9 mois |
| 5 | ETS THE INTERMEDIATE | **28 011 825** | 9 mois |
| **Total calculé des cinq lots** | | **228 392 616** | **9 mois**, pas coût annuel légal |

Écart arithmétique avec le budget : **12 961 260 FCFA**. Ce n'est ni une remise obligatoire ni un gain net démontré pour l'acheteur.

### 4.3. Cas sans prix attribué exploitable

- **PUB35** : consultant communication, financement annoncé, mais montant des honoraires non établi dans l'AAMI.
- **PUB42** : commissaire aux comptes pour 2021-2023, liste restreinte ; pas montant d'honoraires attribué ni obligation annuelle applicable à toute entreprise.
- **PUB36** : report d'une date pour études architecturales ; pas de nouveau prix.
- **PUB37** : marché SIG déclaré infructueux ; **absence d'attribution ne signifie pas prestation gratuite**.
- **PUB03/PUB05** : budgets véhicules connus ; prix final d'attribution non établi dans ces publications.

## 5. Annuel, renouvelable ou ponctuel ?

| Poste | Lecture à retenir |
|---|---|
| Nettoyage 2024 sur 12 mois | Marché de douze mois ; pas abonnement national renouvelé automatiquement |
| Nettoyage 2025 sur 9 mois | Ne pas multiplier ou proratiser en une obligation annuelle ; annualisation éventuelle = simulation interne distincte |
| Frais DAO/DC | Ponctuels pour la consultation concernée, pas chaque année par entreprise |
| Caution de soumission | Validité liée à l'offre ; une prorogation peut exiger adaptation de la garantie, pas paiement annuel automatique du nominal |
| Pièces administratives | Fraîcheur et validité selon clause ; obtenir de nouvelles pièces pour une nouvelle échéance si nécessaire |
| Mission commissaire aux comptes sur 2021-2023 | Périmètre d'une procédure ART spécifique, pas agrément ni renouvellement de licence |
| Tarifs voix/SMS/data | Prix de consommation ou de contrat, pas contribution sectorielle annuelle |
| Titres, fréquences, numéros, audit de sécurité, certificats | Voir les [charges et renouvellements réglementaires](../referentiel-telecom/04_finances_calendrier.md), et vérifier les signaux ci-dessous |

## 6. Réserves financières prioritaires

1. **Fréquences :** PUB14 p. 6 annonce l'aboutissement d'un nouvel arrêté tarifaire. Le numéro, la date et les annexes ne sont pas donnés dans cet article. Ne pas présenter les annexes de 2002 comme barème actuel confirmé.
2. **FST :** PUB40 p. 1 mentionne des reversements au « budget général de l'État (ex-FST) ». Cela ne suffit pas à conclure que la contribution de 3 % a disparu, changé de taux, de bénéficiaire de paiement ou d'échéance. Obtenir le texte modificatif et la liquidation applicable.
3. **Comptes de l'ART :** les recettes, reversements et budgets publiés sont des agrégats institutionnels. Ils ne permettent pas de calculer la dette d'une entreprise particulière.
4. **Devis actuel :** aucun tarif historique ne doit être utilisé dans une offre ferme sans vérification de sa période, de ses taxes, des conditions et de l'accord du fournisseur.
