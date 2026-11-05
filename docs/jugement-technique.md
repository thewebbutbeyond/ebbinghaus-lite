# Du code qui marche à une version qu’on peut exploiter

Le viewer doit permettre à un élève d’ouvrir un lien et de réviser un fichier
reçu à part. Le premier enjeu est de livrer ce parcours simplement. Le
deuxième est de savoir ce qu’on a livré, comment le vérifier et quoi faire
s’il casse. C’est un bon terrain pour exercer son jugement d’ingénieur.

## Junior, intermédiaire, senior : qu’est-ce qui change ?

Les titres varient selon les équipes. Le repère utile ici est la portée
du problème pris en charge, le degré d’autonomie et l’aide apportée aux autres.
Le [référentiel public de GitLab](https://handbook.gitlab.com/handbook/engineering/careers/matrix/)
est un exemple de grille, pas une définition universelle.

| Niveau | Sur ce viewer | Preuve attendue |
| --- | --- | --- |
| Junior | Suit les instructions, lance le viewer et corrige un problème ciblé. Si un fichier ne s’importe pas, il relève l’entrée et le message exacts avant de demander de l’aide. | Reproduction claire et résultat vérifié sur un exemple. |
| Intermédiaire | Prend en charge la publication. Il distingue le serveur de dev du site compilé et sait remonter d’une erreur dans le navigateur à la configuration ou au code. | Tests, journal du déploiement et essai du parcours complet sur l’URL publique. |
| Senior | Décide avec l’équipe de ce qu’il faut vérifier avant de publier, selon le risque pour l’élève. Il sait quand un site statique suffit, prépare le retour arrière et rend la procédure transmissible. | Raisons du choix, limites reconnues et procédure qu’une autre personne peut reprendre. |

Un senior doit aussi savoir faire le diagnostic de l’intermédiaire et lire
le code du junior. Il apporte en plus la capacité de cadrer une situation
ambiguë. Si les élèves utilisent surtout Safari sur iPhone, par exemple,
un test dans Chrome à largeur mobile reste utile, mais ne vérifie ni Safari
ni le sélecteur de fichiers d’un vrai téléphone. Teste alors le parcours sur
un iPhone avant d’ajouter des tests sur la même émulation.

## Vite : à quel problème répond-il ?

[Vite](https://vite.dev/guide/why.html) fournit un serveur de développement
et un outil de construction pour le Web. Un framework d’interface fournit
une façon d’organiser le rendu, les composants ou l’état. Ici, l’interface
est écrite avec le DOM dans [`src/main.ts`](../src/main.ts) ; Vite n’impose
aucun modèle de composants.

| Moment | Ce qui se passe dans ce projet |
| --- | --- |
| `npm run dev` | Vite sert le [`index.html`](../index.html) source et transforme les modules TypeScript quand le navigateur les demande. Le navigateur reçoit du JavaScript. |
| `npm run build` | Le script lance d’abord `tsc --noEmit`. Ensuite Vite part de l’HTML d’entrée et produit un site statique dans `dist/` : HTML, JavaScript et CSS prêts à servir. |
| GitHub Pages | L’hébergeur sert ces fichiers à l’adresse publique. Vite et Node ont travaillé en amont ; le navigateur n’a besoin d’aucun serveur Vite ou Node pour réviser. |

Tu peux le voir : dans `index.html`, le script d’entrée pointe vers
`./src/main.ts`. Dans `dist/index.html`, il pointe vers un fichier
`./assets/index-….js`. Ce sont deux façons de livrer le même programme,
avec des priorités différentes : voir un changement vite en développement,
servir le résultat compilé en production. Le contrôle TypeScript est une
étape séparée, car [la transformation de Vite ne vérifie pas les types](https://vite.dev/guide/features.html#typescript).

**Pourquoi cette solution ?** Pour une page en HTML, CSS et JavaScript
avec peu de modules, on pourrait servir les fichiers sources directement.
Ici, on voulait garder TypeScript, avoir un lancement local simple et
pouvoir publier un dossier statique. Vite évite de monter soi-même cette
chaîne ; en échange, on entretient une dépendance de construction et
une configuration. Ajouter une bibliothèque d’interface ne résoudrait
pas un problème d’adresse des fichiers. Elle se discuterait si le viewer
devait partager des composants et des conventions avec une application plus
grande.

### Un diagnostic qu’on peut reproduire

Imagine que l’HTML répond sur `/ebbinghaus-viewer/` mais que les boutons
n’agissent pas. Dans **Réseau**, regarde l’adresse demandée pour le
JavaScript. `/assets/index-….js` vise la racine du domaine.
`./assets/index-….js` vise le dossier de la page. Le réglage
[`base: "./"`](../vite.config.ts) demande à Vite de générer des chemins
relatifs. C’est adapté à ce viewer à une seule page, qui doit fonctionner
sous le nom du dépôt. Si on ajoute des routes comme `/paquets/mon-paquet/`,
il faudra revoir le choix et tester un accès direct à ces routes.
[Documentation Vite sur le chemin de base](https://vite.dev/guide/build.html#public-base-path).

Reproduis le cas en local avec Python 3, depuis la racine du projet :

```sh
dossier="$(mktemp -d)"
npm run build -- --outDir "$dossier/relatif/ebbinghaus-viewer"
npm run build -- --base=/ --outDir "$dossier/absolu/ebbinghaus-viewer"
python3 -m http.server 4180 --bind 127.0.0.1 --directory "$dossier"
```

Ouvre [la version relative](http://127.0.0.1:4180/relatif/ebbinghaus-viewer/)
et [la version absolue](http://127.0.0.1:4180/absolu/ebbinghaus-viewer/).
Les deux pages HTML répondent. La première charge ses fichiers ; la seconde
cherche les siens à la racine et obtient des 404. Vérifie-le dans **Réseau**,
puis arrête le serveur avec Ctrl+C. Tu viens d’isoler une panne d’hébergement
sans modifier le code de la session ni déployer quoi que ce soit.

## Déploiement : à quoi peut-on vraiment faire confiance ?

Le choix de [GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages)
suit le besoin : une adresse publique, des fichiers statiques et aucun
paquet de cours à stocker sur le serveur. GitHub sert le viewer ; l’élève
ouvre son fichier dans le navigateur. Ce choix serait à réexaminer si
l’application devait partager des sessions entre appareils ou gérer des
accès aux paquets côté serveur.

Le [workflow actuel](../.github/workflows/pages.yml) se lance manuellement
sur `main`. Il installe les dépendances à partir du fichier de verrouillage
avec `npm ci`, exécute les tests unitaires, vérifie les types pendant la
construction, puis transmet `dist/` à l’étape de publication. Cette étape
déploie le résultat du build de **la même exécution**. Elle reçoit les
droits de publication ; le job qui construit le site ne les a pas.
Les tests Playwright existent, mais le workflow ne les lance pas.

Avant de partager le lien, distingue les preuves :

| Ce que tu veux savoir | Ce que tu regardes |
| --- | --- |
| Est-ce que la version attendue a été construite ? | Le commit indiqué dans le journal Actions et le résultat du job de build. |
| Est-ce que le navigateur peut charger le site ? | La réponse à l’URL publique **et** les requêtes vers le JavaScript et le CSS. Un HTML en 200 ne suffit pas. |
| Est-ce que l’élève peut réviser ? | Dans un onglet neuf, importer le paquet fictif, révéler une réponse, tester **À revoir**, puis terminer le paquet. Faire aussi le parcours sur l’appareil réel si c’est lui qu’on veut valider. |

La [publication de la v1.0.0](https://github.com/thewebbutbeyond/ebbinghaus-viewer/actions/runs/41969711538)
est un exemple de journal à lire. Elle te dit ce qui a été construit et
déployé. Elle ne te dit pas ce que voit un élève qui importe son premier fichier.

**Si une version casse :** note le symptôme, l’URL et le commit servi ou
le dernier déploiement connu. Si les fichiers chargent mais que l’import
échoue, garde un fichier fictif minimal qui reproduit le problème. Si la
panne vient d’un changement récent sur `main`, prépare un correctif ou une
annulation de ce changement, vérifie-le, publie-le depuis `main` et reporte-le
sur `develop`. Refais ensuite le test public. Une fois le problème isolé,
la décision utile est celle qui rétablit le parcours avec le moins de risque.

Le tag `v1.0.0` identifie le code source. Il ne constitue pas une sauvegarde
garantie des fichiers déployés : reconstruire plus tard avec `ubuntu-latest`
et Node `24` peut utiliser un environnement différent. Pour ce viewer, un
retour arrière par correctif ou annulation puis reconstruction est une
procédure proportionnée. Si un jour il faut rétablir **exactement** les
fichiers précédents dans un délai garanti, il faudra conserver le résultat
du build et éprouver la procédure qui le redéploie.

## S’entraîner au jugement

Fais l’exercice des deux chemins, puis écris cinq lignes :

1. **Symptôme :** qu’est-ce que l’élève voit ?
2. **Hypothèse :** à quelle étape ça casse ?
3. **Preuve :** quel test distingue cette cause des autres ?
4. **Choix :** quel changement suffit ici, et pourquoi ?
5. **Limite :** quelle nouvelle contrainte te ferait changer de solution ?

L’expérience, c’est avoir rencontré assez de situations pour reconnaître
des symptômes. L’expertise, c’est pouvoir expliquer la cause, vérifier son
hypothèse et transférer le raisonnement à un autre projet. Ici, l’idée à
emporter est que l’application, les fichiers construits et le chemin auquel
on les sert sont trois choses qu’on peut examiner séparément.
