# Assistant Télécoms & Numérique · Cameroun

Application web mobile indépendante pour rechercher dans le corpus documentaire
local. Elle conserve le style bleu de la maquette : bibliothèque, assistant
documentaire, favoris et qualité des sources. **Mon espace** ajoute des comptes
et dossiers persistants, un budget, l'audit, la veille et Gemini optionnel, avec
une [administration web Django](../django_backend/README.md).

## Lancer l’application

Node.js >= 22.12. Depuis ce dossier :

```sh
npm ci
npm run dev
```

Ouvrir `http://127.0.0.1:5174`. Le port est strict : si occupé, arrêter uniquement
le processus concerné ou passer `npm run dev -- --port 5175`.
Vite charge également l’API documentaire locale, sans service externe.
Pour les comptes et l'administration, démarrer aussi Django sur le port 8000
selon son [guide](../django_backend/README.md). Ouvrir `#/workspace` pour
l'espace mobile et `/admin/` pour l'administration web. La bibliothèque continue
à fonctionner indépendamment de Django ; une indisponibilité des comptes est
signalée explicitement.

Pour construire puis servir l’application avec le serveur Node autonome :

```sh
npm run build
npm start
```

Ouvrir `http://127.0.0.1:4174`. `PORT=4175 npm start` permet un autre port.
`npm run preview` est également disponible avec la même API.
Le serveur écoute uniquement sur la boucle locale par défaut.
**Le dossier `dist/` seul ne suffit pas** : le service Node et le corpus sont
nécessaires. Aucun PDF ni index textuel complet n’est intégré au bundle navigateur.

## Corpus et recherche

- 89 PDF sources, 80 documents distincts, 3 011 pages après dédoublonnage global
  dans l’état actuel du corpus. Les compteurs sont calculés au démarrage.
- Le serveur lit [le manifeste](../donnees/markdown/manifest.json) et les deux
  collections de métadonnées et pages JSONL dans [donnees](../donnees).
- Les copies binaires sont regroupées par `document_id`. Les répétitions de textes
  dans des recueils différents ne sont pas consolidées juridiquement.
- Les recherches portent sur le texte intégral extrait des pages. Classement
  lexical de type BM25, accents ignorés, certains pluriels rapprochés, bonus de
  titre et réduction du poids des couvertures très courtes.
- Au moins 60 % des mots-clés significatifs doivent correspondre à la page.
  Jusqu’à six passages sont affichés, un par document, sans synthèse générative.
- Les extraits sont des sous-chaînes de l’extraction, avec espaces normalisés
  et ellipses pour les coupures. Une citation conserve le SHA-256 documentaire
  et le numéro physique de page. Le lien PDF utilise `#page=N`.
- Projets exclus par défaut, réactivables explicitement ; filtres par catégorie.
  La bibliothèque filtre les titres, l’assistant cherche dans les pages.
- L’intitulé d’affichage de la nomination API mal nommée ART est corrigé avec
  avertissement. L’alias 2013 de la loi 2010/013 est regroupé avec l’original.
  Aucun PDF ou export du corpus n’est modifié.

L’index est construit en mémoire au démarrage. Les empreintes SHA-256 des PDF
sont vérifiées contre le manifeste. Après régénération du corpus, redémarrer
le serveur. Une source modifiée, une source absente ou une page manquante bloque
explicitement le chargement ; elle n’est pas ignorée silencieusement.

## API locale

| Route GET | Fonction |
| --- | --- |
| `/api/catalogue` | Documents dédoublonnés, catégories et compteurs de qualité. |
| `/api/search?q=certification&group=all&drafts=false` | Passages classés et cités. Recherche entre 2 et 300 caractères. |
| `/api/documents/:sha256/pages/:page` | Texte intégral extrait d’une page et provenance. |
| `/api/documents/:sha256/pdf` | PDF original, avec prise en charge HEAD et des plages d’octets. |

Catégories : `all`, `texts`, `studies`, `news`, `procurement`.
Erreurs d’entrée en 400, sources introuvables en 404, erreurs internes en 500.

## Vérifier

```sh
npm test
npm run build
npx playwright install chromium
npm run test:e2e
```

Les tests utilisent le corpus livré : inventaire, dédoublonnage, recherche FR/EN,
extraits et citations, projets, qualité OCR, API et fidélité binaire des PDF.
Les tests navigateur lancent le build avec le serveur Node sur le port 4186
(qui doit être libre) et couvrent les parcours mobile, les favoris persistants,
les filtres, les liens profonds, les erreurs réseau et le stockage corrompu.
Ils lancent aussi Django sur 8016, avec une base et des pièces dédiées aux tests,
pour vérifier inscription, profil, dossier, justificatif, budget, audit,
persistance et déconnexion. Le backend doit donc être installé au préalable.

## Confidentialité et limites

Les favoris sont conservés dans le stockage local du navigateur. Les questions
de la recherche documentaire restent en mémoire dans l’interface, sont transmises uniquement à l’API locale
et ne sont pas journalisées par l’application. Les erreurs techniques sont
journalisées et affichées, sans réponse de substitution.

Mon espace conserve les informations du compte et les pièces sur Django.
Gemini, facultatif et configuré exclusivement côté serveur, reçoit uniquement
une question déclarée publique et des extraits publics, après accord.
Les citations sont vérifiées mot à mot. Il n'y a ni transmission officielle de
démarche ni connexion à une administration. Le moteur documentaire peut
retrouver des passages partiellement pertinents ; il ne déduit pas une procédure,
des frais ou des délais. L’absence de résultat ne prouve pas l’absence de règle.

La validité juridique, l’authenticité et la vigueur des textes ne sont pas
certifiées. OCR non revu, faible confiance, projets et publications non normatives
sont signalés. Contrôler dates, montants et tableaux dans le PDF original.
Un score OCR n’est pas un score de validité juridique.

Cette version sert à la consultation locale. Avant une exposition publique,
prévoir l’hébergement sécurisé, les limites de trafic et l’exploitation serveur.
