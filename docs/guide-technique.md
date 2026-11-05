# Guide technique du viewer

Le viewer est assez petit pour que tu puisses suivre une action de bout en
bout. Commence par une carte : importe-la, révèle sa réponse, renvoie-la en
fin de file, puis annule ton choix. À chaque étape, essaie de prévoir ce que
le programme va faire avant de lire la fonction.

Pour travailler les choix d’architecture et de mise en ligne, lis aussi
[l’étude de cas sur le jugement technique](jugement-technique.md).

## 1. Lancer et se repérer

Suis le [démarrage rapide](../README.md#démarrage-rapide), puis importe
[le paquet fictif](../examples/paquet-fictif.json). Choisis **Non** pour
retrouver le même ordre pendant les exercices.

| Si tu veux comprendre… | Ouvre… | Cherche… |
| --- | --- | --- |
| Ce qu’on accepte comme carte | [`src/import.ts`](../src/import.ts) | `readDeck`, `parseDeck`, `validateDeck` |
| Pourquoi une carte revient | [`src/session.ts`](../src/session.ts) | `start`, `rate`, `undo` |
| Ce qui survit à l’actualisation | [`src/storage.ts`](../src/storage.ts) | `saveSession`, `decodeSession` |
| Comment un clic change l’écran | [`src/main.ts`](../src/main.ts) | `addEventListener`, `setSession`, `render` |
| D’où viennent les éléments et les styles | [`index.html`](../index.html) et [`src/style.css`](../src/style.css) | `file-input`, `.flashcard` |

### Pourquoi TypeScript ici ?

Le navigateur exécute du JavaScript dans les deux cas. TypeScript a été
choisi parce que les règles de ce viewer dépendent de l’état : par exemple,
une session à l’accueil n’a pas de paquet, alors qu’une session qui affiche
une question doit avoir une file. Si on ajoute un état ou qu’on déplace une
propriété, le compilateur peut signaler quels endroits du code ne respectent
plus ce contrat. Il en va de même pour le résultat d’un import : le code
qui reçoit une erreur ne peut pas lire les cartes comme si l’import avait réussi.

Un prototype qui affiche trois cartes écrites en dur pourrait rester en
JavaScript sans difficulté. Ici, le coût d’une configuration et d’une
vérification de types vaut le coup : les mêmes objets passent par l’import,
la révision, le rendu et la restauration. En revanche, le compilateur ne
voit pas les fichiers choisis par l’élève ; il faut donc toujours les
vérifier au moment de les lire.

### Qui fait quoi ?

- **TypeScript** vérifie les contrats dans le code. `npm run typecheck`
  lance `tsc --noEmit` pour les vérifier sans générer de fichiers.
- **Vite** sert le projet en local et produit les fichiers du site dans
  `dist/`. Il transforme les fichiers TypeScript en JavaScript ;
  [il ne vérifie pas les types](https://vite.dev/guide/features.html#typescript).
  C’est pour ça que `npm run build` lance aussi `typecheck`.
- **Node** exécute les tests de logique. Il peut
  [retirer les annotations TypeScript](https://nodejs.org/docs/latest-v24.x/api/typescript.html#type-stripping)
  pour exécuter les fichiers sans vérifier leurs types. `import type` indique
  qu’un nom n’a pas à exister à l’exécution. Le
  [`tsconfig.json`](../tsconfig.json) active notamment `erasableSyntaxOnly`
  et `verbatimModuleSyntax` pour rester compatible avec ce fonctionnement.
- **Le navigateur** exécute le JavaScript du site. C’est lui qui ouvre le
  sélecteur de fichiers et garde la session de l’onglet. GitHub Pages sert les
  fichiers compilés ; aucun programme Node ne tourne pour les élèves.

## 2. Suivre un import : quand peut-on faire confiance au type ?

Le bouton déclenche le sélecteur de fichiers. Quand un fichier est choisi,
l’événement `change` dans [`main.ts`](../src/main.ts) appelle `readDeck`.
Cette fonction vérifie la taille avant de lire le texte. `parseDeck` distingue
ensuite deux problèmes : un JSON illisible, ou un JSON lisible qui ne contient
pas les cartes attendues.

La valeur lue commence en `unknown`. C’est une décision : un fichier écrit
par quelqu’un d’autre peut contenir un nombre, un objet ou des cartes
incomplètes. Écrire `JSON.parse(texte) as Card[]` ferait taire le compilateur
sans vérifier ces données. Ici, `validateDeck` vérifie le tableau et les deux
champs de chaque carte, puis construit des objets `Card` avec les valeurs
validées.

`ImportResult` a deux formes. Dans la branche `if (result.ok)`, TypeScript sait
que `cards` et `ignored` existent. Dans l’autre, il sait que `message` existe.
C’est un exemple d’[union discriminée](https://www.typescriptlang.org/docs/handbook/2/narrowing.html#discriminated-unions) :
un champ commun, ici `ok`, indique quelles autres propriétés on peut lire.

Teste la différence sans ouvrir le navigateur :

```sh
node --input-type=module <<'JS'
import { parseDeck } from "./src/import.ts";
const result = parseDeck('[{"question":"Q","answer":"R"},{"question":7,"answer":"R"}]');
console.log(result);
JS
```

Attendu : `ok: true`, une carte acceptée et `ignored: 1`. Remplace ensuite le
texte par `'{'` : tu obtiens `ok: false` et un message. Relie ces deux cas au
[code des tests d’import](../tests/import.test.ts).

Si un paquet est déjà ouvert et que sa session n’est pas terminée,
`offerImport` renvoie le nouveau paquet comme proposition. `main.ts` affiche
alors la confirmation ; la session n’est changée qu’après acceptation.
Pour le voir, mets un point d’arrêt dans le gestionnaire `change`, juste après
`await readDeck(file)`, puis inspecte `result` et `session` après un import.

## 3. Suivre une carte : séparer le paquet de la file

`Session` est une autre union discriminée. `kind` vaut `empty`, `ready`,
`question`, `answer` ou `complete`. En `empty`, il n’y a pas de paquet.
En `question` ou `answer`, il y a une file ; en `complete`, il reste le paquet,
mais il n’y a plus de file active. `rate` ne traite un choix que dans l’état
`answer`. La règle vit dans le modèle, donc elle reste vraie même si le
bouton est appelé au mauvais moment.

Le paquet `cards` reste dans son ordre d’origine. La file `queue` contient
des indices vers ce paquet :

| Action sur le paquet A, B, C | File | Ce qui s’affiche |
| --- | --- | --- |
| Démarrer sans mélanger | `[0, 1, 2]` | Question A |
| Révéler A puis choisir **À revoir** | `[1, 2, 0]` | Question B |
| Révéler B puis choisir **J’ai trouvé** | `[2, 0]` | Question C |
| Choisir **Annuler** | `[1, 2, 0]` | Réponse de B |

Pourquoi garder des indices ? Pour réordonner ou retirer des cartes sans
changer le paquet qui sert à **Recommencer**. Pourquoi ne pas faire `shift()`
sur la file existante ? `undo` garde une référence à la file précédente :
la modifier sur place changerait aussi ce souvenir. `slice` et `[...tableau]`
créent une nouvelle file. `readonly` aide le compilateur à repérer une
mutation accidentelle ; il ne gèle pas l’objet en JavaScript. Dans `start`,
le mélange peut modifier la file sur place, car elle vient d’être créée et
n’est encore partagée avec aucun état.

Ce choix privilégie la simplicité : un jugement recopie la file restante
et l’état est ensuite sérialisé. Si un grand paquet devenait lent,
mesure d’abord le coût de la copie, du rendu et du stockage séparément.

Le mélange donne un autre exemple : `start` accepte une fonction `random`,
`Math.random` par défaut. Le test lui passe `() => 0` pour pouvoir prédire
l’ordre sans changer le comportement du navigateur. Essaie de calculer
l’ordre obtenu pour quatre cartes, puis vérifie :

```sh
node --test --test-name-pattern='shuffle uses a permutation' tests/session.test.ts
```

## 4. Où placer la logique et les effets ?

Après un clic, `main.ts` choisit une fonction de `session.ts`, appelle
`setSession`, sauvegarde l’état, puis reconstruit l’écran avec `render`.
Les tests de `session.ts` peuvent donc vérifier la règle sans créer de
bouton ou ouvrir Chrome. Les tests [dans le navigateur](../tests/e2e/viewer.spec.ts)
vérifient, entre autres, que les boutons appellent la bonne règle et que le
clavier retrouve le bon élément après un changement d’écran.

Deux frontières à garder en tête quand tu modifies le code :

- **Fichier → page.** Même validée, une chaîne peut contenir `<script>`.
  Le helper `el` utilise `textContent` : la carte est affichée comme du texte.
  Remplacer ce passage par `innerHTML` changerait la façon dont le navigateur
  interprète le fichier.
- **Stockage → session.** Le texte lu dans
  [`sessionStorage`](https://developer.mozilla.org/en-US/docs/Web/API/Window/sessionStorage)
  est revérifié par `decodeSession`. Par exemple, un indice hors du paquet
  rend la session invalide. `saveSession` et `restoreSession` reçoivent des
  fonctions de lecture ou d’écriture : les tests peuvent simuler un quota
  plein ou un accès bloqué sans manipuler le navigateur.

Le viewer utilise directement le DOM : il a une page et un seul état
principal. Si la partie cartes rejoint une application avec plusieurs écrans
et des composants partagés, une autre couche d’interface pourra être utile.
Les règles d’import et de révision sont déjà séparées pour pouvoir les
réutiliser sans reprendre le rendu actuel.

## 5. Trois exercices à faire soi-même

Fais-les sur une branche locale d’exercice. Avant de toucher au code,
écris ce que tu t’attends à voir et le test qui te ferait changer d’avis.

1. **Faire échouer le vérificateur de types.** Dans `rate`, enlève
   temporairement le `!` après `session.queue[0]` et lance `npm run typecheck`.
   Avec `noUncheckedIndexedAccess`, TypeScript considère que lire un indice
   peut renvoyer `undefined`. Le `!` ne vérifie rien à l’exécution. Retrouve
   ce qui garantit une file non vide en pratique : création depuis un paquet
   validé, transition vers `complete` après la dernière carte et validation
   des files restaurées. Remets ensuite le `!` et refais la vérification.
2. **Distinguer une modification voulue d’une régression.** Change
   temporairement la phrase d’accueil dans `render`. Observe le résultat
   dans `npm run dev`, puis lance la commande ci-dessous. Le test doit
   échouer sur le texte attendu. Remets le texte initial pour le faire
   repasser. Pour un vrai changement de texte, on met à jour l’attente du
   test une fois le nouveau texte décidé.
3. **Concevoir un compteur « Trouvées ».** Commence par définir ce qu’il
   compte. Si c’est le nombre de cartes retirées, il doit rester à zéro quand
   tu choisis **À revoir**, passer à un après **J’ai trouvé** et redescendre
   après **Annuler**. Essaie de le calculer à partir de `cards.length` et
   `queue.length` dans `render`. Est-ce qu’une nouvelle valeur dans la
   session ou dans la sauvegarde t’apporterait quelque chose ?

Commande ciblée pour l’exercice 2 (avec Google Chrome installé) :

```sh
npm run test:e2e -- --project=desktop -g 'full review'
```

Pour reprendre le projet plus tard, prends un comportement à la fois :
**prédis le résultat → trouve la fonction responsable → vérifie un cas normal
et un cas limite → explique le choix que tu garderais.** Par exemple, si tu
peux expliquer pourquoi on valide un `unknown` à l’entrée mais qu’on n’a pas
besoin de revalider le type de chaque carte au moment de l’afficher, tu as
compris une décision que tu pourras réutiliser dans un autre projet.

## 6. Référence : format, données et progression

Un fichier correspond à un paquet. À la racine, le JSON contient un tableau
d’objets avec deux champs texte non vides :

```json
[
  {
    "question": "Comment s’appelle le vaisseau imaginaire ?",
    "answer": "L’Aurore.\nSon équipage compte deux personnes."
  }
]
```

Les propriétés supplémentaires sont ignorées, les doublons conservés. Les
accents et sauts de ligne restent tels quels. Un fichier est limité à
**5 Mio**, **10 000 entrées** et **50 000 unités de chaîne JavaScript par
champ** (`string.length` : certains caractères, comme les emoji, comptent
pour deux). Les deux premières limites font refuser le paquet. Un champ
trop long ou invalide fait écarter sa carte. Le viewer indique combien de
cartes ont été écartées ; s’il n’en reste aucune, la session est conservée.
L’extension suggérée par le sélecteur ne remplace pas la validation du contenu.

Le fichier et les cartes ne sont pas envoyés à GitHub Pages. Les réponses
sont affichées en texte, sans interpréter le HTML ou le Markdown du fichier,
ni charger de liens ou d’images qu’il contient. Il n’y a ni compte ni suivi
d’usage. Les documents de cours et les vrais paquets se partagent à part.

`sessionStorage` permet de retrouver une session après une actualisation
dans le même onglet. Le stockage peut être bloqué ou plein ; dans ce cas
la révision continue en mémoire. Une visite indépendante démarre à zéro.
Une duplication d’onglet peut copier la session selon le navigateur ;
il n’y a pas de reprise garantie après fermeture ni sur un autre appareil.

## 7. Vérifier et publier

| Commande | Ce qu’elle vérifie ou produit |
| --- | --- |
| `npm test` | Les règles d’import, de révision et de stockage, sans navigateur. |
| `npm run typecheck` | Les types du code et des tests. |
| `npm run build` | Vérifie les types et construit le site dans `dist/`. |
| `npm run test:e2e` | Rejoue des parcours du viewer sur des écrans de tailles mobile et ordinateur. |

Les tests de navigateur nécessitent Google Chrome. Ils utilisent un profil
isolé, sans ouvrir le navigateur actif. Leurs rapports sont dans
`test-results/` ou dans le dossier indiqué par `VIEWER_EVIDENCE_DIR`.

Pour tester le site compilé en local :

```sh
npm run build
npm run preview
```

Ouvre [l’aperçu local](http://127.0.0.1:4173). Le double-clic sur
`index.html` ne lance pas le projet. La configuration Vite utilise
`base: "./"` : les fichiers du site sont chargés relativement à la page,
ce qui permet de les servir sous `/ebbinghaus-viewer/`.

En production, GitHub Pages utilise **GitHub Actions** comme source. Lance
**Publier le viewer** dans l’onglet **Actions** sur `main`. Le
[workflow](../.github/workflows/pages.yml) installe les dépendances, lance
les tests, construit le site et publie seulement `dist/`. Une mise à jour de
`develop` ne déclenche pas la publication.

Le logo Brain et les icônes proviennent de Lucide 0.575.0
([licence](../public/LUCIDE-LICENSE.txt)). La marque et les couleurs sont
reprises d’Ebbinghaus ; le viewer fonctionne indépendamment de l’application.
La génération de cartes et la répétition espacée ne font pas partie du viewer.
