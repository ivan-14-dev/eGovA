# Espace mobile et administration Django

Backend Django 5.2 pour l'application web mobile existante. Ce livrable est un
prototype fonctionnel local, pas une application Android/iOS native ni un service
administratif agréé. Il ne dépose aucun dossier auprès d'une administration.

## Démarrer

Depuis la racine du projet, avec Python compatible Django 5.2 :

```sh
python3 -m venv django_backend/.venv
django_backend/.venv/bin/python -m pip install -r django_backend/requirements.txt
export DJANGO_DEBUG=1
django_backend/.venv/bin/python django_backend/manage.py migrate
django_backend/.venv/bin/python django_backend/manage.py import_corpus
django_backend/.venv/bin/python django_backend/manage.py createsuperuser
django_backend/.venv/bin/python django_backend/manage.py runserver 127.0.0.1:8000
```

Sur cet environnement Python 3.14, `ensurepip` manque. Le répertoire virtuel ayant
été créé, l'installation a été effectuée sans installation globale :

```sh
python3 -m pip --python django_backend/.venv/bin/python install -r django_backend/requirements.txt
```

Dans un deuxième terminal :

```sh
cd Mobile_APP
npm run dev
```

- Mobile : <http://127.0.0.1:5174/#/workspace>
- Administration web : <http://127.0.0.1:5174/admin/>
- Le serveur Node/Vite relaie les comptes, l'administration et ses fichiers
  statiques vers Django. La bibliothèque documentaire reste sur l'API Node.
- `DJANGO_URL` configure l'adresse HTTP interne de Django côté Node.
- Pas de compte administrateur ou de mot de passe livré : utiliser
  `createsuperuser`. Un compte mobile normal ne reçoit jamais de droits admin.
- Les variables sont lues dans l'environnement ; [.env.example](.env.example)
  est un modèle, **pas un fichier chargé automatiquement**.
- Les ports supplémentaires doivent être ajoutés à
  `DJANGO_CSRF_TRUSTED_ORIGINS`. Ne pas désactiver CSRF.

## Fonctions disponibles

- Inscription et connexion courriel/mot de passe, sessions protégées par CSRF.
  Le courriel n'est pas vérifié à l'inscription. Récupération standard Django,
  activable avec les variables SMTP ; erreur explicite sinon.
- Profil particulier, entreprise, indépendant, cabinet ou investisseur.
  **Un espace privé par compte**, sans collaboration ni délégation multi-société.
- 76 procédures : 56 réglementaires et 20 issues des publications. Le contenu
  détaillé est repris des référentiels ; les quatre étapes communes sont un
  parcours de préparation indicatif, non un formulaire officiel.
- Dossiers persistants, statut déclaré, référence de dépôt, échéance manuelle,
  copie de la description et des étapes au moment de la création.
- Pièces privées PDF/PNG/JPEG, 10 Mo maximum, expiration et téléchargement
  contrôlé par propriétaire. Aucun OCR ni analyse IA des justificatifs.
- Budgets saisis avec base documentaire, périodicité et nature fiscale séparées.
  Montant inconnu différent de zéro ; garanties distinctes des dépenses.
  Pas de liquidation officielle, de facturation ou de calcul automatique par zone.
- Audit : 100 contrôles réglementaires et 10 de préparation des marchés,
  scores distincts. Les 26 contrôles complémentaires des publications restent
  consultables dans les sources et ne sont pas additionnés aux 110 contrôles.
- Veille : 12 signaux importés **en brouillon**. Relecture humaine, source,
  activité visée, action, conséquence et date d'effet si établie. Publication
  explicite ; nouvelle révision à relire. Actualisation à l'ouverture ou manuelle,
  pas de push, d'abonnement ministériel ou de collecte Internet.

### Interprétation de l'audit

Le dénominateur contient les contrôles non exclus, y compris ceux dont
l'applicabilité reste inconnue. Une exclusion nécessite une justification mais
reste déclarative. Une conformité exige une preuve appartenant au compte, non
expirée, et une justification ; elle ne certifie pas l'authenticité de la pièce.
Sans contrôle effectivement évalué, aucun pourcentage n'est affiché.
La suppression/expiration d'une preuve invalide la conformité correspondante.
Les points critiques non démontrés sont signalés. Le score n'est ni un agrément,
ni une certification de vigueur juridique, ni une garantie de recevabilité.

## IA strictement fondée sur le corpus

Le mode local ne contacte aucun fournisseur. Il recherche jusqu'à huit passages
dans les sources publiques importées et les référentiels ; les brouillons sont
exclus. L'état initial contient 3 396 passages, dont 3 011 pages PDF.

Le mode Gemini est optionnel :

1. Remplacer/révoquer la clé exposée dans la conversation. Elle n'a pas été
   enregistrée ni utilisée.
2. Fournir une **nouvelle** clé par `GEMINI_API_KEY` dans l'environnement du
   serveur uniquement ; jamais dans Vite, JavaScript, un dépôt ou une URL.
3. Choisir `GEMINI_MODEL` (défaut `gemini-2.5-flash`) et redémarrer Django.
4. L'utilisateur confirme que sa question est publique et accepte la transmission.

Seuls la question et jusqu'à huit passages publics (6 000 caractères chacun)
sont envoyés à Google. Ni profil, ni dossier, ni fichier privé, ni conversation
d'un autre compte ne sont joints. Aucune recherche web ni outil externe n'est
fourni au modèle. Le modèle ne produit **que des citations extractives** :
chaque citation doit correspondre exactement à un passage envoyé, sinon la
réponse est rejetée. Cette restriction privilégie la traçabilité plutôt qu'une
conversation libre ou une synthèse juridique générative.

Le serveur et les tests vérifient ce contrat ; aucun appel réel avec une clé
valide n'a été effectué lors de la livraison. Une absence de source, une panne
ou une configuration manquante ne devient jamais une réponse juridique inventée.
Le code ne conserve pas les questions ; les politiques de conservation de
Google et les journaux de l'hébergement doivent être examinés avant production.

## Ajouter une information ou un nouveau texte

Dans l'administration :

1. Ajouter un **Public import** avec un document public UTF-8 `.md`/`.txt`
   de 2 Mo maximum, titre et référence. Ne jamais y placer des pièces de clients.
2. Confirmer explicitement son caractère public puis exécuter l'action
   d'indexation. Une modification retire l'ancienne source de la recherche
   jusqu'à réindexation.
3. Créer/adapter une procédure avec source, champ d'activité et étapes.
4. Créer une fiche **Bulletin** : ce qui change, personnes concernées, action
   attendue, conséquence étayée et date d'effet connue. Laisser les incertitudes
   explicites ; ne pas transformer une publication en nouvelle obligation.
5. Relire, cocher `verified`, enregistrer puis sélectionner l'action de
   publication. Modifier une fiche déjà publiée la retire jusqu'à nouvelle
   validation. Les utilisateurs concernés la voient dans la veille.

Les nouveaux PDF suivent d'abord le pipeline d'extraction décrit dans le
[README principal](../README.md), puis `import_corpus`.
La commande vérifie les empreintes des PDF et préserve les dossiers existants.
Un changement de source suspend les procédures et bulletins liés jusqu'à
réexamen ; les dossiers signalent une version périmée. Les modèles de parcours
existants ne sont pas réécrits automatiquement : l'administrateur les révise
avant republication. Les sources retirées restent archivées, mais ne sont plus
utilisées pour la recherche, les nouveaux dossiers ou la veille active.
Un changement d'un contrôle réinitialise son évaluation et crée un événement.
Les modifications ne sont pas assimilées automatiquement à des lois en vigueur.

## Vérifier

```sh
DJANGO_DEBUG=1 django_backend/.venv/bin/python django_backend/manage.py test workspace
DJANGO_DEBUG=1 django_backend/.venv/bin/python django_backend/manage.py makemigrations --check --dry-run
cd Mobile_APP
npm test
npm run test:e2e
```

Les tests Django utilisent leur propre base temporaire. Les tests navigateur
lancent Node sur 4186 et Django sur 8016 avec une base dédiée
`db.e2e.sqlite3`, des pièces sous `private_media/e2e` et Gemini désactivé.
Ils ne modifient pas les comptes de la base de développement.

## Avant une exposition publique

- Déployer via serveur WSGI, HTTPS, proxy de confiance et fichiers statiques
  collectés ; ne pas exposer `runserver`. Configurer les en-têtes HTTPS du proxy
  de confiance selon l'infrastructure, sans accepter les en-têtes du client.
- `DJANGO_DEBUG=0`, clé secrète robuste, domaines/origines exacts, base adaptée
  à la charge, sauvegardes chiffrées et restauration testée.
- Ne jamais servir `private_media` comme répertoire public. Mettre en place
  contrôle antivirus, quarantaine, quotas de stockage et durées de conservation.
- La limitation de tentatives actuelle utilise le cache local de Django :
  ajouter un limiteur partagé/atomique et des limites de taille au proxy.
- Mettre en place vérification des courriels, SMTP, politique de confidentialité,
  droits d'accès administrateur minimaux, journalisation d'exploitation et MFA
  selon le déploiement. Les superutilisateurs restent des administrateurs de
  confiance ; ils peuvent administrer les comptes et permissions.
- Faire valider les règles, seuils, tarifs et conditions de renouvellement par
  un responsable métier. Les prix historiques ne sont pas des devis actuels.
- Les interactions avec ministères, paiement, dépôt officiel, signatures,
  collaboration multi-organisation et notifications push nécessitent des
  intégrations supplémentaires et des autorisations réelles.
