# Corpus documentaire pour un assistant sur les services numeriques

Ce projet transforme les PDF locaux en donnees citables par document et par page.
Il ne produit ni avis juridique, ni procedures deduites, ni textes consolides.
Les PDF originaux dans `Reglementations/reglementation/` et
`Reglementations/publications/` restent inchanges.
Le pipeline d'extraction n'envoie aucun document a un service externe.

## Application mobile Expo / React Native

[Mobile_APP](Mobile_APP/README.md) contient la vraie application native Android/iOS
avec Expo : comptes, dossiers, assistant, commande vocale, justificatifs et lecteur
PDF natif, alertes, audit et bibliotheque. Un build de developpement est requis,
pas Expo Go. Suivre son guide pour configurer l'adresse API sur un telephone.

L'ancien client web Vite est conserve dans [Web_APP](Web_APP/README.md).
Le service Node dans
[backend](backend/) exploite les deux collections sans modifier les PDF.
Depuis `Web_APP`, lancer `npm ci` puis `npm run dev` (port local 5174).
La recherche documentaire retrouve des passages : elle ne genere ni avis juridique ni procedure
administrative et ne fait appel a aucun modele d'IA externe.

## Espace personnel et administration web

Le [backend Django](django_backend/README.md) ajoute les comptes, profils,
76 parcours sourcés, dossiers et justificatifs privés, budgets, 110 contrôles
d'audit et une veille publiée après relecture. Dans le mobile : `#/workspace`.
L'administration web est accessible sous `/admin/`.

Gemini est optionnel, avec clé uniquement côté serveur : sur accord explicite,
la question publique et des passages publics lui sont transmis pour sélectionner
des citations vérifiées. Aucun dossier privé n'est envoyé au modèle ; aucune
source web n'est ajoutée. Voir le guide Django pour les limites, la configuration,
la création de l'administrateur et les précautions de déploiement.

## Fichiers de donnees

Apres execution de `prepare_corpus.py`, le dossier `donnees/` contient :

| Fichier | Contenu |
| --- | --- |
| `catalogue.csv` | Une ligne par document unique, ouvrable dans un tableur ; UTF-8 avec BOM, separateur virgule. |
| `documents.jsonl` | Les memes documents avec leurs metadonnees structurees, alias et avertissements. |
| `pages.jsonl` | Une ligne JSON par page PDF, avec texte, source, methode et indicateurs de qualite. |
| `rapport_qualite.json` | Comptages, configuration, doublons et limites du traitement. |

JSONL signifie que **chaque ligne est un objet JSON independant**, et non un tableau
JSON unique. Les champs `source_paths` et `warnings` du CSV contiennent des listes JSON.

## Version Markdown : les deux collections

Ouvrir [l'index Markdown](donnees/markdown/INDEX.md) pour parcourir les
**89 PDF sources** : 43 dans les reglementations et 46 dans les publications.
Ils correspondent a 80 contenus PDF distincts, certaines copies et certains
recueils figurant dans plusieurs emplacements.

Le dossier [donnees/markdown](donnees/markdown/) reproduit les deux arborescences :

- `reglementation/` : lois, decrets, arretes, decisions, directives et recueils ;
- `publications/` : appels d'offres, bulletins, observatoires, rapports et communiques.

Chaque PDF, y compris chaque copie, possede son propre fichier `.pdf.md` contenant :

- un en-tete de metadonnees (identifiant SHA-256, source, nature, statut, avertissements) ;
- un sommaire de toutes les pages ;
- le texte extrait, sans resume ni reformulation, dans des blocs de texte Markdown ;
- un lien relatif vers le PDF original pour chaque page (`#page=N`) ;
- les avertissements OCR et l'identifiant de citation de chaque page.

Les liens encodent espaces, accents et caracteres speciaux. Leur ouverture a la page
demandee depend du lecteur PDF. Les numeros designent les pages physiques du fichier.
Pour conserver les liens en deplacant le corpus, garder les dossiers `donnees/` et
`Reglementations/` dans la meme arborescence relative.

Le [manifeste](donnees/markdown/manifest.json) relie chaque Markdown a son PDF :
**4 611 sections de pages** sont exportees, copies comprises. Il ne faut pas
indexer toutes les copies comme des sources independantes dans un assistant :
utiliser `document_id` et l'identifiant de citation pour dedoublonner.
Les autres extractions (texte natif/OCR alternatifs) restent disponibles en JSONL.

Les donnees structurees des publications sont dans
[donnees/publications](donnees/publications/), avec leur propre catalogue,
leurs JSONL et leur rapport de qualite. Le catalogue initial des reglementations
dans `donnees/catalogue.csv` reste conserve et n'est pas remplace par un catalogue
de publications. Les `source_path` des publications sont relatifs a
`Reglementations/publications/`.

### Regenerer les Markdown

```sh
python3 prepare_corpus.py --source Reglementations/publications --output donnees/publications --cache-root donnees/.cache
python3 export_markdown.py --corpus donnees --corpus donnees/publications
```

Le cache OCR est partage par empreinte PDF et configuration ; les recueils deja
traites ne necessitent pas de nouvel OCR. L'exporteur verifie les empreintes des
PDF, la presence de toutes leurs pages et l'inventaire avant de produire les fichiers.
Si les sources changent, relancer d'abord l'extraction de la collection concernee.
Les exports Markdown sont regeneres : ne pas y enregistrer des annotations
manuelles a conserver. Aucun texte de publication n'est assimile automatiquement
a une disposition juridique ou a une procedure encore applicable.

### Etat du corpus genere

La conversion initiale a produit **41 documents uniques et 1 925 pages**, a partir
de 43 PDF totalisant 1 998 pages avant dedoublonnage. Les deux copies binaires
regroupees expliquent la difference de 73 pages ; aucune page des documents
uniques n'a ete supprimee.

- 812 pages sont extraites directement et 1 113 passent par OCR.
- 119 pages ont une confiance OCR faible ou absente.
- 73 pages contiennent peu de texte ; ces groupes peuvent se recouper.
- 10 pages ne donnent aucun texte. Leur rendu a 72 DPI ne presente aucun pixel
  de niveau de gris inferieur a 200 ; cela ne certifie pas leur contenu original.
- Les 43 empreintes SHA-256 des sources sont identiques a celles relevees avant
  conversion. Les identifiants, numeros de pages et correspondances CSV/JSONL
  ont ete controles sur l'ensemble des exports.

Certains PDF emettent des avertissements de structure via Poppler. Le traitement
s'est termine sans code d'echec ; le journal `conversion.log` conserve ces
avertissements. Les documents sources n'ont pas ete repares ou remplaces.

### Identifiants et citations

- `document_id` : SHA-256 du PDF ; les copies binaires identiques partagent un document.
- `source_path` : chemin relatif a `Reglementations/reglementation/`.
- `source_paths` : tous les noms de fichiers correspondant au meme contenu.
- `page_id` : identifiant du document suivi de `:p0001`, etc.
- `page_number` : numero physique du PDF, a partir de 1, pas la pagination imprimee.

Pour citer une reponse, conserver au minimum `document_id`, `source_path` et
`page_number`. Ne pas citer uniquement un extrait prive de sa provenance.

### Texte et qualite

- `text` : texte exploitable, accents conserves, lignes conservees. Aucun resume
  ou contenu juridique n'est genere.
- `extraction_method` : `native`, `ocr` ou `native_after_ocr`.
- `native_text` et `ocr_text` : les deux extractions quand un OCR a ete tente.
- `ocr_mean_word_confidence` : moyenne des scores Tesseract sur les mots, entre
  0 et 100, ou `null`. **Ce n'est pas une probabilite d'exactitude juridique.**
- `requires_review` et `warnings` : controles a effectuer ; tout OCR est non revu.
  Une page native sans avertissement n'est pas pour autant juridiquement validee.

Les pages comportant moins de 250 caracteres hors espaces passent par un OCR
francais + anglais a 300 DPI. Cela couvre notamment les pages scannees qui ont
seulement un en-tete extractible. Si l'OCR produit moins de caracteres que le
texte natif, les deux sont conserves, le texte natif est retenu et un avertissement
est ajoute. Ce choix heuristique doit etre controle, notamment sur les pages mixtes.
Un score OCR inferieur a 80 ou absent est signale.
Une page courte ou vide est conservee, jamais supprimee ni declaree blanche
automatiquement. Tableaux et colonnes ne sont pas convertis en donnees tabulaires.

## Prudence juridique

Les titres affiches proviennent des noms de fichiers. Les champs `official_title`,
`official_reference`, `publication_date`, `issuing_authority` et
`official_source_url` restent vides tant qu'ils n'ont pas ete verifies.
`legal_status` n'atteste jamais qu'un texte est en vigueur.

Les projets sont signales ; les deux recueils statistiques identifies et le guide
de parametres techniques sont distingues des textes normatifs. Le fichier nomme
`Loi_2013-013_communications_electroniques.pdf` est un alias binaire du texte
2010/013 : il n'est pas indexe comme une nouvelle loi.
Les versions modifiees et les recueils peuvent contenir des repetitions qui ne
sont pas des doublons binaires : aucune fusion juridique automatique n'est faite.

Pour une plateforme destinee aux investisseurs, une etape ulterieure devra valider
les references, autorites competentes, conditions, pieces, frais et delais des
procedures, avec citations et dates de verification. Ce corpus ne pretend pas
couvrir tout le droit du numerique ni toutes les formalites d'investissement.

## Reproduire la conversion

Python 3.11+ et les commandes Poppler (`pdfinfo`, `pdftotext`, `pdftoppm`) sont
necessaires, ainsi que Tesseract et ses modeles `fra` et `eng`.
Aucune dependance Python tierce n'est requise.

Sur Ubuntu, les paquets sont `poppler-utils`, `tesseract-ocr`,
`tesseract-ocr-fra` et `tesseract-ocr-eng`.
Dans cet environnement, Tesseract et ses bibliotheques ont ete extraits localement
depuis les paquets Ubuntu dans `.tools/tesseract/`, sans installation systeme.
Le script utilise cette installation si elle existe, sinon le Tesseract du PATH.
Cette installation locale est specifique au systeme et a l'architecture actuels.

```sh
python3 -m unittest -v test_prepare_corpus
python3 prepare_corpus.py
```

Options : `--source CHEMIN`, `--output CHEMIN`, `--workers 4`, `--dpi 300`,
`--cache-root CHEMIN` (facultatif).
L'OCR utilise quatre processus au maximum par defaut, avec un seul thread
Tesseract par processus. Le cache dans `donnees/.cache/` permet de reprendre
une execution interrompue. Ne pas l'importer dans l'assistant.

Les exports sont remplaces seulement apres traitement reussi de toutes les pages.
Les erreurs d'outils interrompent le traitement et sont affichees, sans transformer
un echec OCR en page vide. Une relance remplace les exports : conserver les
annotations humaines dans un fichier distinct pour ne pas les perdre.

## Exemple de lecture

```python
import json
from pathlib import Path

with Path("donnees/pages.jsonl").open(encoding="utf-8") as stream:
    for line in stream:
        page = json.loads(line)
        if "homologation" in page["text"].casefold():
            print(page["source_path"], page["page_number"], page["text"][:200])
```

Pour un assistant de recherche documentaire (RAG), ces pages constituent une
base de preparation. Il faudra ensuite segmenter par article ou section, conserver
les references de pages, filtrer les projets/statistiques selon l'usage et verifier
les passages utilises pour toute conclusion juridique.
