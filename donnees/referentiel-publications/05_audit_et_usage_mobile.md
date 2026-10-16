# 05 — Audit complémentaire et futur usage par l'assistant mobile

[Accueil](README.md) · [Grille complémentaire](06_grille_audit_publications.csv) · [Signaux de veille](07_registre_veille.csv)

## 1. Trois évaluations distinctes

Le dossier contient **26 contrôles**, répartis en trois groupes :

| Domaine de la grille | Objet | Ce que le résultat ne signifie pas |
|---|---|---|
| `GESTION_DOCUMENTAIRE` | Fiabilité de l'exploitation des sources, des prix et des mises à jour | Pas une obligation légale nouvelle imposée par le magazine |
| `MARCHE` | Préparation d'un marché déterminé, avec ses clauses réelles | Pas droit d'exploiter un réseau, ni garantie d'attribution |
| `SECTORIEL_A_RATTACHER` | Contrôles sectoriels illustrés par les publications, à rattacher aux textes et titres actuels | Pas nouvelle norme autonome issue d'un rapport d'activité |

**Ne pas additionner ces trois groupes pour annoncer un pourcentage de conformité légale.** On peut évaluer séparément la préparation du marché, la qualité documentaire et les obligations sectorielles effectivement établies.

La grille n'est pas préremplie « conforme » parce qu'une publication mentionne un contrôle effectué par ART ou un taux de résolution des plaintes : cela ne démontre rien pour l'entreprise auditée.

## 2. Articulation avec les 110 contrôles existants

La [grille réglementaire de 110 contrôles](../referentiel-telecom/07_grille_audit.csv) reste distincte. Ses identifiants, ses résultats et ses 18 colonnes ne sont pas réécrits par cette livraison.

| Complément publications | Réutilisation dans le référentiel réglementaire |
|---|---|
| CP001-CP002, CP019-CP020 | Gestion des sources/prix/veille ; ne pas ajouter comme obligations juridiques artificielles pour augmenter le dénominateur |
| CP003-CP018 | Détailler les contrôles **C101 à C109** selon le marché réel, sans compter à la fois le parent et ses détails |
| CP005, agrément MINCOM | Préciser habilitations/capacités dans C104/C106 **si la prestation de communication et la clause s'appliquent** |
| CP007-CP008, caution et CDEC | Compléter **C105** avec les pièces du marché visé |
| CP021, QoS | Rattacher aux obligations de couverture, qualité et prescriptions du titre ; **C096** pour demandes/mises en demeure |
| CP022-CP023, fréquences/équipements | Rattacher aux contrôles ART correspondants des [procédures sectorielles](../referentiel-telecom/03_procedures.md), sans créer une deuxième homologation |
| CP024-CP025, offres/plaintes/différends | Rattacher aux obligations consommateurs, tarifaires et procédure de différend applicables |
| CP026, FST/fréquences | Réexaminer notamment **C091/C095** ; les signaux V01/V04 empêchent de certifier le barème actuel sur le seul ancien tableau |

Les avis locaux décrivent essentiellement un **dépôt physique**. Les contrôles C108/C110 sur le marché électronique restent conditionnels ; ne pas les imposer à ces avis au seul motif qu'une future application sera mobile.

## 3. Renseigner et calculer sans faux pourcentage

La grille complémentaire utilise la même structure que la grille réglementaire :

`id;procedure;domaine;controle;condition_applicabilite;source;localisation;criticite;applicabilite;statut;preuve;date_preuve;date_expiration;responsable;echeance_action;action_corrective;justification_na;validation_na`

- `applicabilite` : `OUI`, `NON`, `A_DETERMINER`.
- `statut` : `CONFORME`, `NON_CONFORME`, `NON_EVALUE`.
- `NON` exige une justification et une validation.
- `CONFORME` exige une preuve suffisante, valide, attribuable à la bonne entreprise et au bon marché.
- Les criticités sont des **priorités internes**, pas un classement légal de sanctions.
- Pour `SECTORIEL_A_RATTACHER`, établir le texte primaire et l'activité concernée **avant** de qualifier le contrôle juridique.
- Ne pas saisir de pièces d'identité clients, de secrets ou de coordonnées bancaires sensibles dans les champs libres ; référencer des preuves sécurisées.

**État initial : non évalué.** Aucune preuve propre à l'entreprise n'a été fournie.

Pour chaque périmètre séparé et validé, reprendre la [méthode conservatoire](../referentiel-telecom/05_audit.md) :

```text
N = contrôles retenus, y compris applicabilité inconnue et exclusions non validées
C = conformes avec applicabilité OUI et preuve validée
NC = non conformes établis
U = N - C - NC
Conformité démontrée du périmètre = 100 × C / N
Couverture de l'évaluation = 100 × (C + NC) / N
```

Si aucun contrôle n'est évalué, ne pas publier de taux réel. Si `N=0`, ne pas afficher 100 %. Un critère éliminatoire non satisfait ou un titre requis non démontré bloque la conclusion « prêt », même si le pourcentage est élevé.

**Ne pas coller les formules de la grille de 110 lignes sans adaptation :** ce CSV contient 26 lignes de données, soit les lignes **2 à 27** après import. Filtrer d'abord le domaine et figer le périmètre. Les formules du premier dossier ne réalisent pas ce filtrage à votre place.

Exemple de marché : sur 10 contrôles retenus, 8 conformes, 1 non conforme et 1 non évalué donnent **80 % de préparation démontrée** et **90 % de couverture**. Si le non-conforme est la caution obligatoire, l'offre reste **non prête**, même si la note technique du DAO atteint son seuil.

## 4. Préparation du registre pour la future application

Le [registre CSV de veille](07_registre_veille.csv) contient **12 signaux**, et non douze nouvelles lois :

| Champ | Signification |
|---|---|
| `id`, `titre`, `nature` | Identifiant et qualification documentaire, distincts d'un identifiant d'obligation juridique |
| `source`, `localisation` | Référence au registre des sources et page(s) |
| `date_publication_repere`, `precision_date` | Date ou période réellement disponible ; ne pas inventer le premier jour d'un trimestre |
| `date_acte_ou_fait`, `entree_vigueur` | Date distincte si connue ; entrée en vigueur vide si non établie |
| `secteurs_concernes`, `action_recommandee` | Applicabilité potentielle, pas décision automatique pour toute entreprise |
| `echeance`, `consequence`, `base_consequence` | Délai et conséquence documentés, ou absence de précision explicitée |
| `statut_validation`, `traitement_referentiel` | Ce qui peut être utilisé comme information et ce qui reste à vérifier |

Valeurs de `statut_validation` :

- `A_VERIFIER` : signal insuffisant pour modifier une obligation/tarif ;
- `CONTRADICTION_A_RESOUDRE` : informations incompatibles nécessitant une clarification ;
- `INFORMATION_DOCUMENTEE` : fait rapporté par la publication, pas validation d'une norme générale ;
- `CLAUSE_MARCHE_DOCUMENTEE` : exigence propre au marché décrit ;
- `EVENEMENT_MARCHE_DOCUMENTE` : report, résultat ou infructuosité de la consultation identifiée.

Les dates partielles et les champs vides doivent rester tels quels lors d'un futur import ; ne pas convertir une entrée en vigueur inconnue en « aujourd'hui ».

## 5. Règles de mise à jour à prévoir, non implémentées ici

1. **Conserver la source brute** et ses métadonnées ; dédupliquer sans effacer les variantes.
2. **Qualifier le document** avant toute alerte : loi/décret/arrêté, décision individuelle, marché, information, projet, statistique.
3. **Vérifier l'acte et sa date d'effet** : autorité, signature/publication, articles, annexes, abrogations, transition et texte consolidé.
4. **Comparer les dispositions** : ancien contenu → nouveau contenu ; ne pas remplacer tout le dossier parce qu'un arrêté modifie un seul tarif.
5. **Identifier les entreprises concernées** à partir des activités, titres, sites, ressources et seuils. Une agence de communication et un opérateur mobile n'ont pas les mêmes obligations.
6. **Préparer l'alerte actionnable** suivant le modèle de [message juridique](04_veille_actions_sanctions.md) : démarche, pièces, coût, échéance, risques et preuves.
7. **Valider puis versionner** : auteur, valideur, date, justification et historique. Une fiche incertaine reste une alerte de vérification, pas une obligation active.
8. **Réexaminer l'audit** : conserver l'ancien résultat à sa date ; marquer les contrôles affectés « à réexaminer » dans le futur système, sans transformer automatiquement un ancien conforme en infraction établie.
9. **Notifier seulement les changements pertinents** : un additif corrige le marché concerné ; une attribution ferme l'opportunité correspondante ; une statistique ne déclenche pas de sanction.
10. **Tracer les corrections** : rectification d'OCR, remplacement d'une source, validation d'un barème et expiration d'une preuve doivent être audités.

Exemples de blocages indispensables : PUB05 ne doit pas ouvrir un marché 2027 ; PUB38/PUB39/PUB40 ne doivent pas générer trois alertes ; V01 ne doit pas supprimer automatiquement le FST ; le titre du magazine 2026 ne doit pas créer un décret 2026 ; les tarifs data suspendus ne doivent pas alimenter un moteur de facturation.
