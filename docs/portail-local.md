# Portail de cours : démarrage et publication locale

Le portail local sert le viewer et **Mes cours** sur la même adresse. Le build
de GitHub Pages reste celui du viewer public. Les comptes, leurs attributions et
les fichiers du portail restent dans le dossier ignoré `.portal-data.local/`.
Utilise uniquement des données fictives pour cet essai.

## Démarrer

Il faut Node.js 24.12 ou plus récent. Dans le dépôt :

```sh
npm ci
npm run portal:demo
npm run build:portal
npm run portal:start
```

La commande de démonstration affiche les mots de passe des deux comptes fictifs
une seule fois. Garde-les le temps de ton essai. Elle refuse de remplacer un
dossier existant. Pour réinitialiser un mot de passe, lance `npm run portal:account`
et remplace le `passwordHash` du compte dans le manifeste. Redémarre le serveur
après une modification. Le mot de passe et son empreinte sont deux valeurs
distinctes : seul le mot de passe est à saisir sur la page de connexion.

- [Mes cours](http://127.0.0.1:4176/portal/) : connexion et supports attribués.
- [Viewer](http://127.0.0.1:4176/) : import JSON sans compte.

## Préparer ou remplacer un support

1. Arrête le serveur (Ctrl+C). Mets les nouveaux fichiers dans
   `.portal-data.local/supports/`. Donne aux PDF le nom que tu veux voir à
   l’enregistrement.
2. Ouvre `.portal-data.local/manifest.json`. Ajoute un cours dans `courses`
   ou modifie son entrée. Les chemins de fichiers partent de
   `.portal-data.local/`. Garde les identifiants stables si tu remplaces un
   support : ils servent aux liens.
3. Pour attribuer un cours, ajoute une entrée `{ "accountId": "alice",
   "courseId": "dirigeables" }` à `assignments`. Pour ajouter un compte fictif,
   génère un mot de passe avec `npm run portal:account`, puis ajoute son
   `id`, son `email` et son `passwordHash` dans `accounts`. Retire
   l’attribution pour retirer l’accès.
4. Relance `npm run portal:start`. Le serveur valide les fichiers et les
   références avant d’ouvrir le portail. Il déconnecte les sessions de
   l’instance précédente.

Exemple d’entrée dans `courses` :

```json
{
  "id": "dirigeables",
  "title": "Navigation des dirigeables",
  "decks": [{ "id": "balises", "title": "Balises et amarrage", "file": "supports/balises.json" }],
  "sheets": [{ "id": "navigation", "title": "Fiche de navigation", "file": "supports/Fiche de navigation aérienne.pdf" }],
  "papers": [{
    "id": "exercice",
    "title": "Exercice 1",
    "subject": { "id": "sujet", "file": "supports/Sujet 1.pdf" },
    "correction": { "id": "corrige", "file": "supports/Corrigé 1.pdf" }
  }]
}
```

Tu peux omettre une section vide et publier un corrigé seul. Dans un cours,
les identifiants des PDF doivent être distincts, même si les PDF figurent dans
des sections différentes. Un paquet publié suit le même format JSON que
l’import : un tableau de cartes avec `question` et `answer`. À l’import, le
viewer peut ignorer une carte invalide ; à la publication, cette carte bloque
le démarrage pour éviter de distribuer un paquet incomplet.

## Vérifier le parcours

1. Ouvre **Mes cours** et connecte-toi avec Alice. Ouvre **Navigation des
   dirigeables**, puis **Balises et amarrage**. Révèle une réponse, essaie
   **À revoir** et **Annuler**, puis termine le paquet. Une actualisation
   recommence le paquet à l’écran de mélange.
2. Reviens au cours. Ouvre la **Fiche de navigation**, lis ses deux pages,
   puis télécharge-la. Vérifie son nom dans les téléchargements. Ouvre
   séparément **Sujet** et **Corrigé** de l’**Exercice 1**.
3. Copie le lien direct de la fiche, déconnecte-toi et rouvre-le : le fichier
   est refusé. Connecte-toi ensuite avec Sam dans un autre profil ou une fenêtre
   privée. Il doit voir **Architecture des phares** ; le lien de la fiche
   d’Alice doit aussi être refusé.
4. Ouvre l’import JSON sans compte et essaie un paquet local. Son état dans
   l’onglet est indépendant du portail.

`npm test` vérifie notamment l’accès aux fichiers par URL directe avec les
deux comptes. `npm run test:e2e` vérifie le viewer public.
`npm run test:portal` construit les deux versions, vérifie leur contenu et
exerce le parcours dans Chrome avec deux tailles de fenêtre.

Le serveur écoute uniquement sur le Mac. Tu peux faire le parcours sur Safari
Mac. La lecture et le téléchargement sur un vrai iPhone restent un contrôle
distinct à faire quand un accès de test pour l’iPhone sera disponible.

## Où se fait la séparation

Une page Vite peut afficher un cours, mais seul le serveur décide qui peut le
lire. Il vérifie la session et l’attribution à chaque requête de cours, de
paquet ou de PDF. Le navigateur garde les cartes privées en mémoire pour la
révision. La sauvegarde d’onglet du viewer reste réservée aux imports locaux.
La déconnexion ferme l’accès côté serveur ; elle ne retire pas un PDF déjà
enregistré sur l’appareil.
