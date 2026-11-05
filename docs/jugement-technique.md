# Expertise, expérience et décisions d’ingénierie

Ebbinghaus Viewer ouvre un paquet JSON et le fait réviser dans le navigateur.
Sa petite taille permet de suivre une décision depuis le besoin de l’élève
jusqu’aux fichiers servis en production. Cette note expose les connaissances
qu’il fallait mobiliser pour le concevoir et les limites des preuves dont
on dispose. Le [guide du code](guide-technique.md) détaille l’implémentation.

## Ce que recouvre « senior »

Trois choses peuvent progresser à des rythmes différents :

- **Les connaissances** : comprendre le modèle d’un langage, le protocole
  HTTP ou la différence entre un build et un déploiement. On peut les
  acquérir par l’étude, la veille et la lecture de systèmes existants.
- **L’expérience** : avoir livré, investigué ou maintenu quelque chose avec
  de vraies contraintes. On peut avoir de l’expérience dans la livraison
  de produits et peu d’expérience des incidents en production, ou l’inverse.
- **Le niveau de responsabilité** : être capable de prendre en charge un
  problème mal défini, prendre des décisions avec les autres, rendre leurs
  conséquences vérifiables et rester responsable du résultat.

Dans le sens fort, **l’expertise** est la capacité à mobiliser des
connaissances spécialisées pour expliquer, prédire et diagnostiquer dans
un domaine. Connaître les mécanismes de GitHub Pages est possible sans
avoir maintenu un site public. Les avoir étudiés donne de bonnes hypothèses
le jour d’une panne ; les avoir déjà appliqués sous contrainte donne
d’autres repères. Le nombre d’années ne dit ni quels problèmes une
personne a traités, ni jusqu’où elle les comprend.

Les référentiels de rôle donnent une autre vue. [SFIA](https://sfia-online.org/en/sfia-9/responsibilities)
décrit des niveaux par l’autonomie, la complexité, l’influence et la
responsabilité. Pour un [senior backend chez GitLab](https://handbook.gitlab.com/job-description-library/engineering/development/backend/senior/#senior-responsibilities),
la fiche ajoute notamment l’amélioration de la qualité à l’échelle de
l’équipe, l’autonomie sur des livraisons et le mentorat. C’est un exemple
de rôle, pas un barème universel ni un niveau d’expertise dans chaque
technologie.

Sur une même publication, un **junior** peut exécuter et vérifier une
procédure avec un cadre donné ; un **intermédiaire** peut prendre en charge
la publication et diagnostiquer pourquoi elle échoue ; un **senior** doit
aussi décider ce qui suffit à rendre la mise en ligne acceptable, coordonner
ceux qui en dépendent et prévoir comment rétablir le service. Ces capacités
se chevauchent. Le dernier rôle englobe le diagnostic et l’exécution quand
ils sont nécessaires.

## Ce que les experts reconnaissent derrière les symptômes

[Baltes et Diehl](https://arxiv.org/abs/1807.06087) ont proposé une théorie
de l’expertise en développement à partir d’une enquête auprès de
335 développeurs et de travaux antérieurs. Leurs résultats invitent à
préciser la tâche et le contexte, et à distinguer expérience et expertise
autoévaluée. Une étude de [Chi, Feltovich et Glaser](https://doi.org/10.1207/s15516709cog0502_2),
en physique, a montré que les experts de l’étude regroupaient les
problèmes selon les principes en jeu là où les novices se fiaient davantage
aux éléments visibles. L’analogie avec le logiciel est utile : plusieurs
pannes qui se présentent de la même façon peuvent relever de mécanismes
différents. L’étude ne porte pas sur les développeurs.

| Domaine | Ce que donne un modèle solide | Exemple concret |
| --- | --- | --- |
| **Python** | Distinguer identité, valeur, mutation, annotations, règles du langage et détails de l’interpréteur. Savoir quand une opération bloque l’exécution. | `ancienne = file` partage la liste ; la modifier change ce que voit `ancienne`. Copier la liste sépare les conteneurs, pas les objets qu’ils contiennent. Une annotation `list[int]` ne valide pas le JSON reçu. Un appel bloquant dans une coroutine peut bloquer la boucle d’événements. [Modèle de données](https://docs.python.org/3/reference/datamodel.html#objects-values-and-types), [annotations](https://docs.python.org/3/library/typing.html), [asyncio](https://docs.python.org/3/library/asyncio-dev.html#running-blocking-code). |
| **Full stack** | Suivre une action à travers le navigateur, HTTP, le serveur et éventuellement la base. Savoir à quelle frontière chaque garantie doit être imposée. | Désactiver un bouton peut protéger l’interface d’un double clic ; si une API existe, le serveur doit encore vérifier le droit d’effectuer l’action. Dans ce viewer, un HTML en `200` ne prouve ni que le JavaScript a chargé, ni qu’un fichier s’importe. |
| **Informatique** | Distinguer une propriété du modèle, les hypothèses qui la rendent vraie et les limites d’une mesure. Les domaines vont des algorithmes aux langages, systèmes et réseaux. | Le mélange du viewer préserve les indices parce qu’il ne fait que des échanges. La préservation ne prouve pas une distribution uniforme : c’est une autre propriété, qui dépend notamment de la manière dont les positions sont tirées. [Domaines de CS2023 (ACM, IEEE-CS, AAAI)](https://csed.acm.org/knowledge-areas/). |

Une personne peut être experte en exécution Python et débutante en mise
en ligne. Un senior full stack n’a pas besoin de connaître tous les
détails de CPython. Il doit reconnaître quand ils importent, savoir trouver
une source fiable et identifier ce qui manque pour décider.

## Les connaissances nécessaires pour refaire ce viewer

| Décision | Ce qu’il fallait comprendre | Pourquoi ce choix ici |
| --- | --- | --- |
| Traiter le paquet côté navigateur | Sélecteur de fichiers, lecture asynchrone, différence entre afficher du texte et interpréter du HTML. | Les paquets restent sur l’appareil. Un serveur qui les reçoit ajouterait une responsabilité sans répondre au besoin. |
| Employer TypeScript | Un type décrit ce que le code peut supposer ; il ne transforme pas une entrée externe en donnée valide. Les unions peuvent exprimer des états qui n’ont pas les mêmes propriétés. | L’interface, la logique et la restauration s’accordent sur le modèle. Les entrées du fichier et du stockage restent vérifiées à l’exécution. |
| Séparer paquet et file d’indices | Références, copies, transitions d’état et coût de mise à jour. | On conserve l’ordre source pour redémarrer et une seule file précédente pour annuler. Copier la file est simple, mais le travail augmente avec sa longueur. |
| Sauvegarder dans l’onglet | Portée du stockage du navigateur, sérialisation, quotas et compatibilité des données écrites. | La progression peut survivre à l’actualisation. Il n’y a ni synchronisation, ni migration d’une version incompatible. Une écriture qui échoue ne doit pas bloquer la révision. |
| Rendre avec le DOM | Événements, focus, éléments accessibles et reconstruction de la vue. | Une page et un seul état suffisent aujourd’hui. Une bibliothèque d’interface se discuterait si le viewer devait partager de nombreux composants avec une application plus grande. |
| Publier un site statique | Modules du navigateur, transformation du code, résolution des URL et distinction entre révision du code et résultat du build. | Vite produit le site. Pages sert les fichiers. Un service qui exécute du code par requête n’est utile que si le produit a des besoins côté serveur. |

La production du code et ces décisions sont deux activités différentes.
Une IA peut écrire une fonction ; celui qui reprend le projet doit
pouvoir dire sur quelles hypothèses elle repose, ce qu’un test démontre
et ce qu’il faudrait changer si le besoin évoluait. La documentation
transmet ce raisonnement et les observations du projet. Elle ne remplace
pas l’expérience d’une livraison ou d’un incident pris en charge.

## Vite : du code source au site servi

[Vite](https://vite.dev/guide/why.html) est un outil de développement et
de construction. Il intervient dans la façon de servir et de transformer
le code ; l’organisation du rendu reste dans
[`src/main.ts`](../src/main.ts), qui utilise le DOM.

| Moment | Contrat dans ce projet |
| --- | --- |
| `npm run dev` | Le serveur Vite sert [`index.html`](../index.html) et transforme à la demande les modules TypeScript que le navigateur charge. |
| `npm run build` | Le script vérifie les types avec `tsc --noEmit`, puis Vite part de l’HTML d’entrée et produit `dist/`. [Vite ne vérifie pas lui-même les types](https://vite.dev/guide/features.html#typescript). |
| GitHub Pages | L’hébergeur répond avec les fichiers générés. Vite et Node ne tournent pas pour chaque visite. |

Le même besoin pourrait être couvert avec du JavaScript natif servi par
un hébergeur statique, sans Vite. Ici, Vite fournit une boucle de développement
et une construction cohérentes pour TypeScript et les chemins des
ressources. En échange, il faut maintenir une dépendance de développement,
un environnement Node et une configuration. Ajouter React modifierait
l’organisation de l’interface ; cela ne corrigerait pas un chemin d’asset.

**Cas vérifié :** deux compilations du même code ont été servies sous un
sous-dossier. Les deux répondaient `200` pour l’HTML. Avec une base absolue
`/`, le navigateur demandait `/assets/…` à la racine et obtenait des
`404` pour le JavaScript et le CSS. Avec
[`base: "./"`](../vite.config.ts), le navigateur les demandait dans le
dossier de la page et les deux répondaient `200`. C’est la différence
entre une réponse HTTP valide pour un document et une application
utilisable. Une base relative convient à cette page unique. Des routes
profondes ou un point d’entrée différent imposeraient de vérifier à
nouveau la résolution. [Chemins de base dans Vite](https://vite.dev/guide/build.html#public-base-path),
[sémantique du statut HTTP 200](https://www.rfc-editor.org/rfc/rfc9110.html#name-200-ok).

## Déploiement : garanties, preuves et retour arrière

[Le workflow](../.github/workflows/pages.yml) se lance manuellement sur
`main`. Le job de build installe les dépendances verrouillées avec
`npm ci`, lance les tests unitaires, vérifie les types pendant la
construction et transmet `dist/`. Le job de publication déploie ce
résultat de **la même exécution**. Les droits de publication sont
accordés à ce second job. Les tests Playwright existent ; le workflow
ne les lance pas. [Documentation GitHub Pages](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages).

| Ce qu’on sait | D’où vient la preuve | Ce que la preuve ne couvre pas |
| --- | --- | --- |
| Le commit prévu a été construit et publié. | Journal [Actions de la v1.0.0](https://github.com/thewebbutbeyond/ebbinghaus-viewer/actions/runs/41969711538). | Le parcours de révision dans le navigateur de l’élève. |
| Le viewer public a chargé et révisé le paquet fictif jusqu’au bout. | Essai sur l’URL publique, dans un Chrome isolé à taille mobile. | Safari sur un iPhone réel, le sélecteur du téléphone ou le comportement avec tous les fichiers possibles. |
| Une lecture différée, un fichier hostile ou un stockage bloqué ont un comportement attendu. | [Tests Playwright](../tests/e2e/viewer.spec.ts) dans des conditions contrôlées. | La fréquence de ces cas chez les élèves et les performances sur leurs appareils. |

Le journal du workflow explique les étapes internes. L’essai public répond
à une autre question : le service est-il utilisable du point de vue de
l’élève ? C’est l’idée d’une vérification de l’extérieur décrite dans
[le livre SRE de Google](https://sre.google/sre-book/monitoring-distributed-systems/).
Ici, l’essai est ponctuel. Le viewer ne mesure pas automatiquement les
échecs d’import en production.

Si une mise en ligne dégrade le parcours, un correctif ou un revert doit
passer par `main`, puis le workflow doit être relancé et le résultat vérifié
sur l’URL publique. La correction revient ensuite dans `develop`.
Le tag `v1.0.0` identifie un état des sources ; il ne constitue pas une
copie des fichiers déployés. Avec `ubuntu-latest` et Node `24`, reconstruire
plus tard peut utiliser un environnement différent, même avec le fichier
de verrouillage et des actions épinglées. Si un jour le service exige un
retour **au même artefact** dans un délai donné, il faudra conserver cet
artefact et vérifier la procédure qui le remet en ligne.
