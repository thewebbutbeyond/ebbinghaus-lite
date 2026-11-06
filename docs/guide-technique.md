# Guide technique du viewer

Cette documentation décrit les contrats et les limites du viewer : ce que
le code garantit, à quel endroit il le garantit et ce qui changerait si le
produit évoluait. [Expertise et décisions d’ingénierie](jugement-technique.md)
replace ces choix dans le parcours complet, de la conception à la production.

## 1. Carte du code

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

| Entrée | Résultat observable |
| --- | --- |
| Syntaxe JSON invalide | Message de lecture ; le paquet en cours reste intact. |
| JSON lisible, mais aucune carte valide | Refus ; une valeur peut être du JSON sans respecter le format d’un paquet. |
| Tableau avec des cartes valides et invalides | Les cartes valides sont gardées, les autres sont comptées. |
| Nouveau paquet valide pendant une session | Le résultat est proposé. Le remplacement n’est appliqué qu’après confirmation. |

La lecture est asynchrone. `main.ts` désactive l’import, le retour à
l’accueil et le redémarrage pendant `await readDeck(file)`. L’élève peut
continuer à réviser. À la fin de la lecture, `offerImport` reçoit l’état
courant ; une erreur ne remet pas la session dans l’état qu’elle avait
avant la lecture. Le candidat en attente et la session active sont
deux valeurs distinctes. Le
[test navigateur de lecture différée](../tests/e2e/viewer.spec.ts)
force une lecture lente puis un échec de lecture pour vérifier ces limites.

`readDeck` ne demande à son entrée que `size` et `text()`. La dépendance
au fichier se réduit donc à deux opérations ; un test Node peut produire
un échec de lecture sans créer de sélecteur de fichiers. Le contrôle de
taille précède la lecture, mais le fichier admis est lu et parsé en entier.
Cette limite réduit la taille des entrées ; elle ne fixe pas la mémoire
totale occupée pendant le parsing.

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

### Ce que le type garantit, et ce qu’il faut encore démontrer

`Queue` est un tableau en lecture seule d’indices. Son type ne garantit
ni qu’il contient un élément, ni que ses indices pointent vers le paquet.
Avec `noUncheckedIndexedAccess`, TypeScript le rappelle en considérant
`queue[0]` comme potentiellement absent. Le `!` dans le code ne fait aucun
contrôle à l’exécution : il s’appuie sur les chemins qui créent l’état.

- L’import et la restauration n’acceptent pas de paquet vide.
- `start` construit la file à partir des indices du paquet. Le mélange
  échange les positions et préserve ces indices.
- `rate` renvoie `complete` quand la dernière carte est retirée.
- La restauration rejette les files vides, les indices hors limites et
  les doublons d’indices. Deux cartes au texte identique peuvent en
  revanche être deux entrées distinctes du paquet.

Ces garanties concernent les chemins utilisés par le viewer. Le type
`Session` seul ne rend pas impossible de fabriquer un état invalide
dans un autre appelant. Si le modèle est réutilisé ailleurs, il faudra
préserver ces points de création ou rendre certains états plus difficiles
à construire, par exemple avec un type de file non vide.

L’ordre aléatoire est une dépendance de `start`. Le navigateur utilise
`Math.random` par défaut ; les [tests de session](../tests/session.test.ts)
fournissent une fonction connue pour vérifier une permutation précise.
Le test porte sur l’ordre produit et la préservation du paquet source.

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

Le viewer utilise directement le DOM : une page et un seul état principal.
`render` remplace l’arbre de la vue. Le gestionnaire de clic reste sur son
conteneur et reconnaît la commande avec `data-action` ; les nouveaux boutons
n’ont pas besoin de chacun réinstaller un gestionnaire. Comme un élément
remplacé peut perdre le focus, l’interface donne ensuite le focus à la
réponse ou au prochain contrôle selon l’action. Les tests clavier couvrent
ce passage. Si le viewer rejoint une application avec plusieurs écrans et
des composants partagés, la logique d’import et de révision peut être
réutilisée sans reprendre ce rendu.

### Coût d’une interaction

Un jugement recopie la file restante. À chaque transition sauvegardée,
`setSession` sérialise aussi tout l’état, paquet compris, puis appelle
`sessionStorage.setItem` avant de rendre la vue. La taille de la file
explique le coût de sa copie ; la taille du paquet explique une partie
du coût de la sérialisation et du stockage. Optimiser la file seule ne
résoudrait donc pas forcément un ralentissement. Le code privilégie un
instantané simple à restaurer. Aucun seuil de performance sur un appareil
réel n’a été établi par les tests actuels.

## 5. Référence : format, données et progression

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

La sauvegarde contient une version et un état. `decodeSession` exige la
version 1 et revérifie les cartes et les files. Un format incompatible est
signalé puis écarté ; il n’y a pas de migration. La limite d’import ne
garantit pas que le navigateur aura assez de place pour stocker l’état
complet. Si une écriture échoue, l’état en mémoire continue d’avancer ;
une actualisation peut retrouver le dernier instantané réussi au lieu
de retrouver le dernier geste.

## 6. Vérifier et publier

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
ce qui permet de déplacer ce build d’une page sous un sous-chemin.

Le build Pages est différent : il regroupe la bibliothèque et l’importateur
sous `/ebbinghaus-lite/`. Le [guide de la bibliothèque](bibliotheque-pages.md)
décrit ce build et le workflow de publication.

Le logo Brain et les icônes proviennent de Lucide 0.575.0
([licence](../public/LUCIDE-LICENSE.txt)). La marque et les couleurs sont
reprises d’Ebbinghaus ; le viewer fonctionne indépendamment de l’application.
La génération de cartes et la répétition espacée ne font pas partie du viewer.
