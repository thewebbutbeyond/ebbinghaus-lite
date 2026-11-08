# Accès aux archives

## Usage

Le parcours est **Institutions → Établissement → Département → Accéder à
l’archive → Cours**. Un mot de passe commun ouvre l’archive du département.
Les liens directs vers un cours, un paquet ou une simulation passent par
le même écran. Aucun compte, email ou fournisseur supplémentaire.

Le navigateur conserve l’accès pendant la navigation et les rechargements
dans le même onglet. Sa fermeture termine normalement ce stockage de
session ; une restauration de session du navigateur peut toutefois le
rétablir. Utiliser une fenêtre privée pour tester un nouveau visiteur.
Si le stockage est bloqué, l’accès fonctionne en mémoire jusqu’au rechargement.

## Chiffrement

Les 24 PDF et paquets sont regroupés dans un JSON, avec leurs octets en
base64, puis chiffrés avec le codec de
[StatiCrypt 3.5.4](https://github.com/robinmoisson/staticrypt), épinglé dans
les dépendances. Les ressources pèsent environ 1,2 Mio avant encodage.
Le navigateur utilise le même codec avec WebCrypto : nous n’avons pas
créé un algorithme de chiffrement maison.

Le format actuel de StatiCrypt utilise AES-256-CBC et HMAC-SHA256, avec
trois dérivations PBKDF2 successives totalisant 600 000 itérations. Le
HMAC est vérifié avant déchiffrement. Chaque génération crée un nouveau
sel et un nouvel IV.

Le résultat public est `archives/<identifiant>.enc.json`. Le mot de passe,
la clé et les documents en clair n’y figurent pas. Après déchiffrement,
les ressources sont validées et conservées en mémoire. Les PDF utilisent
des URL `blob:` ; les cartes utilisent le lecteur existant. L’archive
entière est téléchargée à la première ouverture du département.

`sessionStorage` conserve la clé dérivée, qui permet elle aussi de
déchiffrer le contenu : c’est un secret d’accès. Elle reste dans le
navigateur autorisé, sans être publiée ni envoyée à un serveur. Le mot de
passe saisi n’est pas enregistré. Les autres applications de la même
origine appartiennent à la même frontière de confiance : des chemins
différents n’isolent pas le stockage du navigateur.

Le catalogue, les noms de cours, le code de la simulation et l’aperçu
de l’accueil restent publics. Les PDF et les paquets sont chiffrés ; le
code source du site reste du code public.

## Préparer et mettre à jour

Les sources en clair sont dans `.archive-materials.local/cours/`, avec les
chemins du catalogue. Le secret est la variable `ARCHIVE_PASSWORD` dans
`.env.archive.local`. Les deux emplacements sont ignorés par Git.
Conserver une sauvegarde privée : ils ne font pas partie du dépôt courant.

```sh
cd /Users/nathan.sidib/Code/thewebbutbeyond/Ebbinghaus/ebbinghaus-lite
npm ci
npm run archive:encrypt
npm run build:pages
npm run preview:pages
```

Ouvrir <http://127.0.0.1:4177/ebbinghaus-lite/#/he2b/esi>.
La commande de chiffrement exige un mot de passe de 16 caractères ou plus
et ne l’affiche pas. L’environnement peut aussi fournir `ARCHIVE_PASSWORD` ;
ne pas écrire sa valeur dans une commande conservée dans l’historique.
Seul `publication/archives/*.enc.json` doit être publié, avec le site.

Après modification d’un document, régénérer l’archive et mettre à jour
`updatedOn` dans le catalogue. Pour changer le mot de passe, modifier le
secret puis régénérer l’archive. Le nouveau sel invalide les anciennes
clés de session. Les copies anciennes de l’archive restent déchiffrables
avec leur ancien mot de passe.

Le build Pages normal ne lit ni le secret ni les sources privées.
GitHub Actions publie donc une archive déjà préparée sans recevoir le
mot de passe. Un changement du secret local seul ne change pas les
fichiers déjà générés ou publiés.

## Vérifier

```sh
npm test
npm run test:pages
npm run test:e2e
```

Si le port 4177 est occupé : `PAGES_TEST_PORT=4187 npm run test:pages`.
Les tests Pages utilisent le mot de passe local ; les tests unitaires
emploient uniquement des données et un secret fictifs. Les captures et
traces restent dans `.omx/` et `test-results/`, ignorés par Git. Une trace
peut contenir des données privées ou une saisie : ne pas la publier.

## Limites acceptées

L’élève peut partager le mot de passe, les PDF ou les cartes déchiffrés.
Il n’y a pas de révocation individuelle, de restriction par appareil ou de
protection contre les captures. Le paquet chiffré permet des essais hors
ligne : conserver un secret long et aléatoire.

Les documents précédemment publiés restent dans les anciens commits
publics, les copies de dépôt et les téléchargements. Le nouvel artefact
ne les sert plus mais ne les efface pas à distance. La gestion de
l’historique public demande une décision séparée ; aucune réécriture
d’historique n’est automatisée ici.
