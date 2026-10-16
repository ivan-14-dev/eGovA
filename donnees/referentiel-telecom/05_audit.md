# 05 — Méthode d'audit et pourcentage de conformité démontrée

[Accueil](README.md) · [Grille à remplir](07_grille_audit.csv) · [Préparation du marché](06_appel_offres.md)

## 1. Ce que le score signifie

Le score proposé est un **indicateur interne de conformité démontrée**, sur un périmètre et à une date donnés. Ce n'est :

- ni un taux de validité juridique des lois ;
- ni une probabilité de gagner un marché ;
- ni une certification délivrée par ART, ANTIC ou l'acheteur ;
- ni un remplacement de l'audit réglementaire de sécurité prévu par le décret 2012/1643.

La méthode, les niveaux de criticité et la logique de blocage ci-dessous sont des **choix de gestion**, pas un barème de notation fixé par les lois du corpus.

**Situation initiale : non évaluée.** Aucun titre, paiement, rapport d'audit ou dossier d'appel d'offres de l'entreprise n'a été examiné. Ne pas publier « 0 % conforme » ou « 100 % conforme » sur la seule grille vierge.

## 2. Fixer et documenter le périmètre

Renseigner avant contrôle :

`Entreprise | RCCM/identifiant fiscal | activités | pays/sites | titres | technologies | fréquences | numéros | modèles de matériel | clientèle | sous-traitants | période | date d'arrêté | auditeur | valideur | version du référentiel | marché/lot éventuel`.

Pour chaque contrôle :

1. déterminer l'applicabilité à partir des activités **effectives**, pas uniquement de l'objet social ;
2. préciser l'unité : entreprise, licence, agrément, site, modèle, ressource ou contrat ;
3. décliner si nécessaire, par exemple `C025-SITE-A`, `C025-SITE-B` ; conserver le contrôle parent et expliquer les unités sans les compter deux fois ;
4. conserver les pièces sources et leur version ;
5. figer la liste avant calcul. Ne pas créer dix contrôles faciles pour diluer un contrôle critique.

Si un dossier regroupe plusieurs obligations, il n'est conforme que si **tous** les éléments requis sont satisfaits. Si l'on découpe un contrôle, documenter la nouvelle version et recalculer les comparaisons historiques.

## 3. Valeurs autorisées dans le CSV

Le fichier contient **110 contrôles** couvrant les **56 familles de procédures**. C'est un **tableau d'entrée**, pas une macro ni un calculateur automatique.

| Colonne | Valeurs / usage |
|---|---|
| `id` | Identifiant unique du contrôle |
| `procedure` | Famille P01 à P56 ; reprendre la référence du référentiel |
| `source`, `localisation` | Référence au registre et article/page ; le lien local du registre permet d'ouvrir la transcription/PDF |
| `criticite` | `CRITIQUE`, `MAJEUR`, `STANDARD` ; priorité interne, modifiable seulement avec justification |
| `applicabilite` | `OUI`, `NON`, `A_DETERMINER` |
| `statut` | `CONFORME`, `NON_CONFORME`, `NON_EVALUE` |
| `preuve` | Référence contrôlable à la pièce, résultat du test et périmètre ; pas seulement « document disponible » |
| `date_preuve`, `date_expiration` | Dates ISO `AAAA-MM-JJ` ; laisser expiration vide si juridiquement non pertinente, expliquer dans la preuve |
| `responsable`, `echeance_action`, `action_corrective` | Responsable de correction, date cible et action vérifiable |
| `justification_na`, `validation_na` | Pour `NON` : motif documenté, nom du valideur et date de validation ; sinon l'exclusion du calcul est interdite |

**Règles :**

- `CONFORME` seulement pour une ligne `OUI`, avec preuve suffisante, authentique, couvrant la bonne entité, le bon service et la période.
- Un titre requis expiré, suspendu, retiré ou hors périmètre = `NON_CONFORME`.
- Un dépôt en cours, un paiement non reçu ou une conformité partielle ne valent pas conformité. Si le défaut est établi : `NON_CONFORME`. Si l'information est insuffisante : `NON_EVALUE`.
- `NON` ne dispense du calcul qu'après justification et validation ; sinon traiter comme `A_DETERMINER`.
- Un taux/texte juridique encore incertain doit rester signalé : une preuve de paiement n'établit pas à elle seule que l'assiette ou le tarif sont corrects.
- Les contrôles conditionnés à un marché ne sont exclus que si l'audit ne porte sur aucun marché. Pour la préparation d'un marché à venir, l'absence du dossier laisse l'applicabilité **à déterminer**.
- Ne pas saisir les données d'identité des abonnés ou les clés privées dans la grille ; référencer un espace de preuve sécurisé avec accès limité.

## 4. Calcul : deux indicateurs et un verrou

Après vérification des saisies :

- `N` = nombre de contrôles `OUI` + contrôles dont l'applicabilité reste indéterminée + exclusions `NON` non justifiées/non validées ;
- `C` = nombre de contrôles `OUI` réellement conformes et justifiés ;
- `NC` = nombre de contrôles `OUI` dont la non-conformité est établie ;
- `U = N - C - NC` = contrôles non évalués ou applicabilité non résolue ;
- `K` = nombre de contrôles **CRITIQUES**, non valablement exclus, qui ne sont pas démontrés conformes.

```text
Taux de conformité démontrée = 100 × C / N
Taux de couverture de l'audit = 100 × (C + NC) / N
Taux restant à établir       = 100 × U / N
```

Les non-conformités et inconnues donnent **zéro crédit** au premier indicateur. Les contrôles ont un poids identique ; l'importance est traitée par le verrou critique, pas par une pondération arbitraire donnant une illusion de précision.

### Conditions de publication

| Situation | Affichage |
|---|---|
| `N = 0` | **Non applicable / périmètre à vérifier**, jamais 100 % par défaut |
| `C + NC = 0` | **Non évalué — aucun score de conformité publié** |
| Applicabilité non résolue | Calcul conservatoire possible en interne ; afficher **provisoire, périmètre incomplet** et le nombre d'inconnues |
| `K > 0` | **Non prêt / conformité non démontrée sur points critiques**, quel que soit le pourcentage |
| Pas de blocage mais `U > 0` ou `NC > 0` | **Réserves à traiter** ; ne pas annoncer « en règle » |
| `C = N`, `K = 0`, preuve et actualité vérifiées | **100 % des contrôles du périmètre démontrés conformes à la date d'arrêté**, pas conformité absolue au droit entier |

Un seuil interne « satisfaisant à 80 % » ne permet donc jamais d'ignorer les titres ou critères éliminatoires. Ce référentiel n'en impose aucun.

### Exemples de vérification

| Exemple | C | NC | U | N | Conformité démontrée | Couverture | Décision |
|---|---:|---:|---:|---:|---:|---:|---|
| 20 contrôles applicables, dossier partiellement vérifié | 15 | 3 | 2 | 20 | 75 % | 90 % | Réserves ; si titre critique manquant, non prêt |
| 25 contrôles, dont 5 NON justifiés/validés ; reste identique | 15 | 3 | 2 | 20 | 75 % | 90 % | Les exclusions valides seules quittent le dénominateur |
| 100 contrôles, 99 conformes et 1 licence indispensable manquante | 99 | 1 | 0 | 100 | 99 % | 100 % | **Non prêt** malgré 99 % |
| 10 contrôles tous inconnus | 0 | 0 | 10 | 10 | Non publié | 0 % | Non évalué |
| Aucun contrôle après exclusion légitime | 0 | 0 | 0 | 0 | Non calculable | Non calculable | Périmètre à vérifier |

### Utilisation avec un tableur

Importer en UTF-8 avec séparateur `;`, **renommer la feuille `Grille`**, puis créer une feuille `Synthese`. Le fichier fourni comporte l'en-tête en ligne 1 et les 110 contrôles en lignes **2 à 111**.

Après validation humaine des preuves, dates et exclusions, utiliser ces formules dans un tableur francophone compatible avec `NB.SI.ENS`. Les formules ne sont pas intégrées au CSV.

| Cellule dans Synthese | Indicateur | Formule |
|---|---|---|
| B2 | N, périmètre conservatoire | `=NBVAL(Grille!A2:A111)-NB.SI.ENS(Grille!I2:I111;"NON";Grille!Q2:Q111;"<>";Grille!R2:R111;"<>")` |
| B3 | C | `=NB.SI.ENS(Grille!I2:I111;"OUI";Grille!J2:J111;"CONFORME")` |
| B4 | NC | `=NB.SI.ENS(Grille!I2:I111;"OUI";Grille!J2:J111;"NON_CONFORME")` |
| B5 | U | `=B2-B3-B4` |
| B6 | K, critiques non démontrés conformes | `=NB.SI(Grille!H2:H111;"CRITIQUE")-NB.SI.ENS(Grille!H2:H111;"CRITIQUE";Grille!I2:I111;"NON";Grille!Q2:Q111;"<>";Grille!R2:R111;"<>")-NB.SI.ENS(Grille!H2:H111;"CRITIQUE";Grille!I2:I111;"OUI";Grille!J2:J111;"CONFORME")` |
| B7 | Conformité démontrée, sur 100 | `=SI(B2=0;"NON CALCULABLE";SI(B3+B4=0;"NON EVALUE";100*B3/B2))` |
| B8 | Couverture, sur 100 | `=SI(B2=0;"NON CALCULABLE";100*(B3+B4)/B2)` |

Les résultats numériques B7/B8 vont de 0 à 100 : utiliser un format **nombre**, pas le format pourcentage qui multiplierait de nouveau l'affichage par 100. Les fonctions/formats peuvent devoir être adaptés à la langue du logiciel. Étendre **toutes** les plages si des contrôles par site/titre sont ajoutés.

Pour `N` et `K`, les `NON` ne sont exclus que si Q et R sont remplies **et réellement validées**, pas remplies de caractères fictifs. Le statut de préparation doit être décidé avec le tableau « Conditions de publication » : il ne se déduit pas de B7 seul. Refuser les saisies incohérentes, preuve manquante pour un conforme, date invalide ou exclusion non validée avant de figer un score.

La présence d'une formule ne vérifie ni l'authenticité d'un titre ni la validité juridique d'une exclusion. Les exemples arithmétiques ont été contrôlés ; ces formules ne constituent pas un classeur exécuté et certifié dans votre environnement.

## 5. Points bloquants à contrôler avant une offre

Blocage interne à lever ou à qualifier expressément :

1. titre indispensable absent, expiré, retiré, suspendu ou ne couvrant pas l'activité/le lot ;
2. agrément professionnel requis non détenu par l'entité exécutante ;
3. modèle non homologué ou fréquence/numéro sans droit valide lorsque requis ;
4. défaut de sécurité légalement requis ou audit obligatoire non démontré dans le délai ;
5. pièce éliminatoire du marché absente, fausse, hors délai ou non conforme ;
6. garantie ou pouvoir de signature insuffisant ;
7. dépôt après l'heure limite ou absence de preuve de réception ;
8. impossibilité de démontrer l'actualité du cadre applicable sur un point indispensable.

La qualification **CRITIQUE** du CSV est une priorité interne. La qualification **éliminatoire pour le marché** vient exclusivement du dossier du marché et de ses règles applicables ; elles ne doivent pas être confondues.

## 6. Tests et preuves : ne pas vérifier seulement des documents

| Domaine | Test recommandé |
|---|---|
| Titres | Concordance raison sociale/RCCM, activité, zone, date, signature, conditions et statut auprès de l'émetteur |
| Agréments | Catégorie exacte, ingénieur engagé/inscrit, moyens réellement disponibles, échéance |
| Finances | Recalcul assiette/taux, séparation des activités, rapprochement notification → facture → paiement → quittance → comptabilité |
| Fréquences/numéros | Inventaire terrain ou système comparé aux décisions ; tous les sites et ressources couverts |
| Équipements | Modèle/version/quantité comparés à l'homologation et aux attestations ; preuve d'import et vignettes |
| Identification | Échantillon documenté de souscriptions, mineurs/flottes/dérogations ; activation postérieure à identification et gestion des pièces expirées |
| Sécurité | Vérifier périmètre/date/auditeur du rapport et clôture effective des recommandations ; journal des incidents |
| Exposition | Mesures par bande, cumul des sources, environnement sensible, compétences/indépendance du laboratoire |
| Services | Tests facturation, bip vocal, STOP, réclamations, portage, préavis d'interruption et accès urgences |
| Marché | Revue croisée pièce par pièce et critère par critère, puis essai de signature/dépôt avant échéance |

Pour un échantillon, noter population, taille, méthode, période et anomalies. Ne pas extrapoler automatiquement « 100 % de l'entreprise » à partir de quelques abonnements contrôlés.

## 7. Restitution de l'audit

Le rapport de synthèse doit contenir :

- périmètre, date, version des textes et limites ;
- `C`, `NC`, `U`, `N`, `K`, taux de conformité démontrée et couverture ;
- nombre de titres/sites/ressources contrôlés et non contrôlés ;
- écarts critiques, majeurs et standards avec leurs preuves ;
- montants certains, estimés et non chiffrés, sans masquer les arriérés ;
- échéances légales et actions internes ;
- décision « non évalué », « non prêt », « réserves » ou « conformité démontrée sur le périmètre » ;
- pour le marché, une décision distincte sur la complétude/admissibilité préparatoire, sans préjuger l'acheteur.

**Exemple de formulation correcte :**

> Au 16 octobre 2026, sur 20 contrôles retenus, 15 sont démontrés conformes, 3 non conformes et 2 non évalués : conformité démontrée 75 %, couverture 90 %. La licence nécessaire au lot reste non démontrée : dossier non prêt pour validation interne de la soumission.

Cette phrase est un exemple de méthode, **pas le résultat de votre entreprise**.
