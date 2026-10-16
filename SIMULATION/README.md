# Mon Assistant

Prototype independant de plateforme transversale d'information sur les
administrations camerounaises. Le laboratoire 3D precedent est remplace.

**Aucune connexion aux systemes des ministeres. Aucune demarche officielle
ne peut etre deposee dans ce prototype. L'objectif de fidelite de 90 % n'est
pas declare atteint.**

## Installation

Node.js >= 22.12 et npm >= 10.5.1.

```sh
npm ci
npm run dev
```

Si npm est plus ancien : `npx --yes npm@10 ci`, sans modifier l'installation
globale. Ouvrir l'adresse locale indiquee par Vite.

```sh
npm run build
npm run lint
npx playwright install chromium
npm run test:e2e
npm run test:sources
```

Le build verifie aussi les types de l'application, des configurations et des
tests. Les tests utilisent le build de production sur le port **5187**, qui
doit etre libre. Ils ne reutilisent ni n'arretent un serveur d'un autre projet.
Les tests de sources necessitent Internet et peuvent echouer si une source
externe devient indisponible.

## Fonctionnement

- Nouvel accueil entreprise : tableau de bord responsive, navigation mobile,
  assistant guide, veille telecom, appels d'offres, audit et comparaison de prix.
  L'annuaire existant reste accessible sur `#/institutions`.
- `#/assistant` : reponses predefinies, sans IA connectee ni avis juridique.
- `#/veille` : fiches pedagogiques, sources institutionnelles et actions a verifier.
  Aucun nouveau decret, sanction ou flux en direct n'est affirme.
- `#/offres` : trois opportunites fictives, filtres, recherche et checklists
  independantes par appel d'offres. Aucun depot de candidature.
- `#/audit` : score de preparation calcule sur cinq points declares, sans
  certification de conformite. Satisfaction client non mesuree.
- `#/tarifs` : ecart en pourcentage entre deux prix saisis en FCFA, sans
  reference tarifaire officielle ni conclusion juridique.
- Les notifications sont demonstratives, sans push ni actualisation automatique.
  Conversations, auto-evaluation et checklists sont en memoire uniquement :
  elles ne survivent pas au rechargement ou a la sortie de l'espace entreprise.
  La date du tableau de bord est celle de l'apercu, pas une date de synchronisation.
- 39 fiches : 36 portefeuilles ministeriels sectoriels, les fonctions du
  Controle superieur de l'Etat et des Relations avec les Assemblees, et la DGSN.
- Recherche insensible aux accents, filtres par domaine et photographie.
- Une page dediee a chaque institution, partageable par son URL `#/institutions/id`.
- Six photographies documentaires locales, credits et licences sur les cartes
  et les pages. Pour les autres institutions : remplacement explicitement
  illustratif. Les photos ne subissent aucun filtre de couleur.
- Sources, dates de consultation, niveaux de confiance et incertitudes par champ.
- Design neutre : aucune couleur, police ou logo revendique comme officiel.
- Themes Material UI clair/sombre/systeme, memorisation du choix et respect du
  mouvement reduit. Le theme ne change ni les dossiers ni la navigation.
- Formulaire fictif sans identite, paiement ou piece jointe. Dossiers et
  progression manuelle stockes uniquement dans le navigateur, notifications locales.

Les donnees de demonstration ne doivent contenir aucune information personnelle.
Elles ne sont pas chiffrees, synchronisees ou accessibles sur un autre appareil.
Le registre est limite a 50 dossiers. Une erreur de stockage est signalee :
les donnees invalides ne sont jamais effacees automatiquement.

## Sources et droits

Point de depart : [Services du Premier Ministre](https://www.spm.gov.cm/site/).
Consultations documentees le **16 octobre 2026**. Une date de consultation ne
garantit pas l'actualite du contenu de la page source.

Voir [le rapport de verification](docs/VERIFICATION.md) et la page **Sources &
limites** du prototype. Les photographies sont sous **CC BY-SA 4.0** ; leurs
auteurs, descriptions, liens source et licences figurent dans le registre.
Le MINAC est illustre par une delegation regionale a Maroua, non par son siege.

Les services, tarifs, delais, pieces ou adresses non verifies ne sont pas
inventes. Les trois ressources documentaires ne sont pas trois teleprocedures
integrees. Les liens externes ouvrent les sites des organismes concernes.

## Organisation

- [src/data/institutions.ts](src/data/institutions.ts) : registre central type,
  controles de provenance, ressources et incertitudes.
- [src/data/institution-seeds.json](src/data/institution-seeds.json) : perimetre
  recense et syntheses des missions.
- [src/data/verified-evidence.json](src/data/verified-evidence.json) : preuves
  de consultation et credits photographiques.
- [src/theme.tsx](src/theme.tsx) : palettes et ThemeProvider Material UI.
- [src/theme-context.ts](src/theme-context.ts) : choix de theme partage.
- [src/App.tsx](src/App.tsx) : catalogue, fiches, sources, formulaire et suivi.
- [src/Workspace.tsx](src/Workspace.tsx) : tableau de bord et outils entreprise.
- [src/Workspace.css](src/Workspace.css) : design responsive de l'espace entreprise.
- [src/dossiers.ts](src/dossiers.ts) : validation et stockage local des exemples.
- [tests/portal.spec.ts](tests/portal.spec.ts) : matrice de pages et tests axe.
- [tests/workspace.spec.ts](tests/workspace.spec.ts) : parcours entreprise,
  calculs, checklists et accessibilite mobile/ordinateur en clair et sombre.
- [tests/sources.spec.ts](tests/sources.spec.ts) : controle HTTP des liens publies,
  rapport genere dans [docs/link-checks.json](docs/link-checks.json).

## Actualiser les preuves

```sh
npm run research:sources
npm run research:photos
```

Le premier script consulte la Primature et recherche des images sur Commons ;
il garde les reponses dans `source-audit/`, ignore par Git. Le second utilise
une **liste de six photos explicitement approuvees**, controle la licence,
telecharge les fichiers avec `curl` et genere les metadonnees.

Un resultat de recherche n'est jamais publie automatiquement comme photographie
verifiee. Toute nouvelle photo exige une inspection humaine du sujet et des
droits. Les dates et syntheses doivent etre revues manuellement avant de publier
une nouvelle version du registre ; ces scripts ne certifient pas les informations.

## Deploiement et limites techniques

Deployer le contenu de `dist/` sur un hebergement statique a la racine du domaine.
Les routes utilisent le fragment d'URL et ne necessitent pas de reecriture
cote serveur. `npm run preview` sert a inspecter le build, pas a l'heberger
en production.

Il n'y a pas de backend, d'authentification, de paiement, d'envoi de courriel,
de notification distante ni d'IA connectee. Le bundle applicatif depasse le
seuil indicatif Vite de 500 ko avant compression ; les photos originales
representent environ 16 Mo au total et sont chargees paresseusement dans le
catalogue. Une optimisation d'images pourra preceder un deploiement public.
