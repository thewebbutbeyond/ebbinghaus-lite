# Ebbinghaus Viewer

Un lecteur de flashcards en français, utilisable sur téléphone, tablette et
ordinateur. Ouvrez un fichier JSON local, puis révisez une carte à la fois.

## Lancement local

Prérequis : Node.js 24.12 ou plus récent et npm.

Depuis ce dossier :

```sh
npm ci
npm run dev
```

Ouvrir **http://127.0.0.1:5173** dans un navigateur récent. Pour arrêter le
serveur : Ctrl+C. Le serveur écoute uniquement sur cet ordinateur.

Pour essayer la version statique construite :

```sh
npm run build
npm run preview
```

Ouvrir **http://127.0.0.1:4173**. Le dossier `dist/` contient le site statique.
Le double-clic sur `index.html` n’est pas le mode de lancement prévu.

## Utilisation

1. Cliquer sur **Importer tes cartes** et sélectionner un seul fichier JSON.
   `examples/paquet-fictif.json` fournit trois cartes d’une histoire imaginaire.
2. À **Veux-tu mélanger ton paquet ?**, choisir **Oui** pour mélanger ou
   **Non** pour conserver l’ordre du fichier.
3. Chercher la réponse, puis toucher ou cliquer sur la carte pour la révéler.
4. **J’ai trouvé** retire la carte de la file ; **À revoir** la remet à la fin.
   Le compteur inclut la carte courante. La dernière carte peut donc revenir.
5. **Annuler**, au centre entre **Accueil** et **Recommencer**, restaure la carte et sa réponse. Un seul
   retour est possible, y compris après la fin du paquet.
6. **Recommencer** demande confirmation, reprend toutes les cartes et propose
   à nouveau l’ordre. **Annuler** ou Échap conserve la progression.
7. **Accueil** et le logo reviennent à l’accueil. Si un paquet est en cours, une confirmation
   protège la progression ; **Rester** ou Échap conserve la session entière.

Les contrôles fonctionnent aussi au clavier avec Tab, Entrée et Espace.
Un nouveau paquet valide demande confirmation avant de remplacer une session
en cours. Annuler le sélecteur ou la confirmation conserve la session.
Un fichier incorrect ou sans carte valide ne remplace jamais le paquet.

## Format des cartes

Un tableau JSON à la racine ; deux chaînes non vides par carte :

```json
[
  {
    "question": "Comment s’appelle le vaisseau imaginaire ?",
    "answer": "L’Aurore.\nSon équipage compte deux personnes."
  }
]
```

Les clés `question` et `answer` sont fixes. Les cartes peuvent être dans toute
langue. Accents, Unicode, espaces et sauts de ligne sont conservés. Les chaînes
composées seulement d’espaces sont invalides. Les propriétés supplémentaires
sont ignorées, les doublons conservés. Si une partie du paquet est valide,
le lecteur affiche le nombre de cartes valides et un avertissement séparé
pour les cartes ignorées.

Limites : fichier de **5 Mio**, tableau de **10 000 entrées** maximum et
**50 000 caractères par champ**. Un fichier ou tableau trop volumineux est
refusé entièrement ; une carte dont un champ est trop long est ignorée.
La validation porte sur le contenu, indépendamment du type MIME du fichier.

## Confidentialité et progression

Le fichier est lu sur votre appareil. Aucun compte, service distant, analytique,
police distante ni envoi de cartes. HTML, Markdown, code et URL restent du texte :
aucun lien actif, image chargée ou contenu exécuté à partir du paquet.

La session est conservée dans le stockage de session du navigateur pour survivre
à une actualisation du même onglet. Si ce stockage est indisponible ou plein,
un message l’indique et la révision continue en mémoire. Une nouvelle visite
indépendante commence à zéro ; aucune reprise après fermeture ou sur un autre
appareil n’est promise. Certains navigateurs peuvent copier la session lors de
la duplication d’un onglet.

## Vérification

```sh
npm test
npm run typecheck
npm run build
npm run test:e2e
```

Les tests couvrent l’import, la protection de la session, le mélange, la file,
les jugements, l’annulation, le redémarrage et le stockage de session.
Les tests Playwright parcourent le flux complet avec un paquet fictif en
formats mobile et ordinateur. Ils lancent Chrome installé dans un profil
headless isolé, sans utiliser le navigateur actif ni le sélecteur du système.
Les captures sont dans `test-results/artifacts/` ; définir `VIEWER_EVIDENCE_DIR`
permet de conserver toutes les preuves dans un dossier privé de son choix.

Le logo Brain et les icônes proviennent de Lucide 0.575.0 (licence dans
`public/LUCIDE-LICENSE.txt`). La marque et les couleurs sont copiées localement
depuis l’application Ebbinghaus ; le viewer n’en dépend pas à l’exécution.
Le viewer n’inclut ni génération de cartes ni répétition espacée.
