# Mon Assistant — Expo / React Native

Application mobile **native Android/iOS**, écrite en React Native et TypeScript,
avec Expo SDK 58 et Expo Router. Ce n'est pas une WebView de l'ancien site.
L'ancien client Vite est conservé dans [Web_APP](../Web_APP/README.md).
L'[administration web et les API métier](../django_backend/README.md) restent sur Django.

## Fonctions migrées

- Connexion, inscription, profil, récupération de compte si SMTP configuré.
- Démarches sourcées, dossiers, étapes, statuts déclarés, échéances et historique.
- Choix d'un fichier natif PDF/PNG/JPEG, remplacement, aperçu PDF natif et images,
  téléchargement/partage à la demande, confirmation avant suppression.
- Budget avec frais initiaux, annuels, garanties, taxes et montants inconnus séparés.
- Audit avec justificatifs et scores réglementaire/marchés distincts.
- Alertes d'appels d'offres, échéances et documents, veille et marquage lu.
- Assistant local du compte, propositions à confirmer, recherche documentaire
  et Gemini optionnel côté serveur. Aucun fichier privé transmis à Gemini.
- Dictée via les services natifs Android/iOS, consentement et permissions,
  relecture avant envoi. L'audio peut être traité par le fournisseur vocal :
  ne dictez aucune donnée confidentielle. La saisie texte reste disponible.
- Bibliothèque, recherche dans les pages, qualité OCR, projets et favoris locaux.

Il s'agit toujours d'un outil indépendant : aucun dépôt officiel ni certification.
Les alertes sont actualisées lorsque l'app est ouverte/active, pas en push.

## Prérequis et installation

- Node.js >= 22.13 compatible Expo 58, npm.
- Backend Django installé, migrations et corpus importés.
- Android Studio/SDK et Java compatibles pour Android ; macOS/Xcode pour iOS.
- **Build de développement Expo requis** : Expo Go ne contient ni le module de
  reconnaissance vocale ni le lecteur PDF natif.

```sh
cd Mobile_APP
npm ci
```

Créer localement `.env` à partir de [.env.example](.env.example) et définir
`EXPO_PUBLIC_API_URL`, **sans clé secrète** :

| Appareil | Adresse de l'API |
| --- | --- |
| Émulateur Android standard | `http://10.0.2.2:4174` |
| Simulateur iOS / navigateur sur le serveur | `http://127.0.0.1:4174` |
| Téléphone physique | `http://ADRESSE_LAN_DU_SERVEUR:4174` |
| Production | URL publique **HTTPS** de votre serveur |

Ne mettez jamais `GEMINI_API_KEY` dans une variable `EXPO_PUBLIC_*`.
Les variables publiques sont incluses dans le bundle de l'application.
Une connexion HTTP locale est autorisée uniquement dans les builds configurés
avec `APP_VARIANT=development`. Les builds de production exigent HTTPS.

## Démarrer les services

Depuis la racine, premier terminal :

```sh
export DJANGO_DEBUG=1
# Ajouter l'adresse LAN exacte pour un téléphone, sans joker.
export DJANGO_ALLOWED_HOSTS=127.0.0.1,localhost,192.168.1.10
django_backend/.venv/bin/python django_backend/manage.py migrate
django_backend/.venv/bin/python django_backend/manage.py import_corpus
django_backend/.venv/bin/python django_backend/manage.py runserver 127.0.0.1:8000
```

Deuxième terminal — passerelle API et client web conservé :

```sh
cd Web_APP
npm ci
npm run build
HOST=0.0.0.0 npm start
```

`HOST=0.0.0.0` rend la passerelle accessible sur le réseau local : utiliser
uniquement un réseau de confiance et le pare-feu approprié. Django reste sur
la boucle locale, derrière la passerelle. Sans `HOST`, Node écoute localhost.
L'administration est accessible à `http://ADRESSE_DU_SERVEUR:4174/admin/`.

Troisième terminal — construire et installer le client natif :

```sh
cd Mobile_APP
npm run android
# Sur macOS avec Xcode :
npm run ios
```

Pour les démarrages suivants, lorsque le build de développement est déjà installé :

```sh
npm start
```

Le téléphone et Metro doivent être joignables sur le même réseau. Si la connexion
USB est utilisée, `adb reverse tcp:8081 tcp:8081` relie Metro à l'appareil.
Le code natif est généré par Expo ; les dossiers `android/` et `ios/` sont ignorés
par Git. Après modification d'un plugin, reconstruire le client natif.

[eas.json](eas.json) contient les profils développement/production, mais aucun
build cloud n'est lancé automatiquement et aucun identifiant Expo n'est fourni.
Configurer votre propre projet/compte avant un éventuel usage d'EAS ; cette
opération transmet le code au service de build et nécessite votre accord.

## Vérifier

```sh
npm run typecheck
npx expo install --check
APP_VARIANT=development npx expo export --platform all
APP_VARIANT=development npx expo prebuild --platform android --no-install
npm run test:e2e
```

Les tests navigateur exécutent **le client React Native via Expo Web**, sur 8082,
avec une passerelle 4187, Django 8017 et une base dédiée
`django_backend/db.expo-test.sqlite3`. Ils couvrent les échanges réels d'API,
propositions, documents et parcours. Ils ne remplacent pas un essai Android/iOS
réel des permissions, de SecureStore, du partage et du microphone.

Validation de la migration : TypeScript et lint sans erreur, bundles Android,
iOS et web générés, 45 tests Django, 17 tests documentaires, 12 parcours de
l'ancien client web et 2 parcours Expo Web réussis. Un APK Android de
développement **x86_64 pour émulateur** a été compilé localement. Il n'est pas
versionné et ne constitue pas un APK ARM pour téléphone. La compilation iOS
requiert macOS ; aucun test microphone ou installation sur téléphone réel n'a
été effectué ici.

Pour une prévisualisation web locale :

```sh
npm run web
```

La passerelle autorise par défaut les origines `http://localhost:8081` et
`http://127.0.0.1:8081`. `CLIENT_ORIGINS` permet une liste exacte supplémentaire.
Sur le web, le jeton reste uniquement en mémoire et une recharge exige une
reconnexion ; l'ancien client web conserve ses sessions Django habituelles.

## Confidentialité et exploitation

- Jeton aléatoire à durée limitée (8 heures par défaut), transmis en en-tête,
  haché en base et stocké dans Expo SecureStore sur le téléphone.
- Déconnexion : révocation serveur et suppression locale. Mot de passe changé,
  compte désactivé ou expiration invalident les jetons.
- Les routes `/native-api/` refusent les cookies de session comme authentification.
  Les routes web gardent leur protection CSRF ; les objets métier sont partagés,
  sans duplication de la logique de conformité.
- Les fichiers passent exclusivement par le serveur configuré. Aucun visualiseur
  PDF tiers en ligne. Les copies de travail de l'app sont temporaires ; un partage
  explicite peut créer une copie dans une autre application sous votre contrôle.
- Le corpus public reste sur le serveur, pas dans le paquet mobile.
- Avant distribution publique : serveur de production HTTPS, sauvegardes,
  antivirus/quarantaine, quotas, validation métier et politique de confidentialité.
- `npm audit` signale actuellement des avis transitifs dans la chaîne Expo/Metro
  et ses plugins, y compris dans les dernières versions disponibles de `braces`
  et `node-forge`. Ne pas appliquer `npm audit fix --force` : la proposition de
  retour à Expo 44 serait incompatible. Revalider les correctifs amont avant
  toute distribution de production et ne pas exposer Metro sur Internet.
