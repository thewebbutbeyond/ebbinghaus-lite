# Bibliothèque publique et GitHub Pages

La bibliothèque et l’importateur sont deux entrées HTML du même artefact.
Ils partagent le moteur de révision TypeScript. La bibliothèque charge un
paquet publié à la demande ; l’importateur lit un fichier local dans le
navigateur. Le prototype avec connexion a son propre build.

Le [catalogue](../src/lite-catalog.ts) fixe les noms, l’ordre et les chemins
publics. Sans fragment, l’accueil présente la bibliothèque ; **Voir les cours**
ouvre le catalogue sous `#/`. Un lien direct vers un cours demande le même
fichier HTML à Pages, puis le navigateur ouvre le cours indiqué après le `#`.
Les ancres et l’événement `hashchange` laissent le navigateur gérer son
historique. L’accueil demande aux moteurs de ne pas l’indexer ; les liens
restent publics et partageables.

`npm run build:pages` compile les deux entrées et copie les ressources
listées vers `dist-pages/`. Le build ne copie pas tout le dossier de
publication : une ressource doit être explicitement référencée, au bon
format et sous un chemin public autorisé. Les fichiers déjà publiés
gardent leur chemin sous `cours/`. Les originaux de l’école et les données
privées restent hors du catalogue et de l’artefact.

`npm run test:pages` sert cet artefact sous `/ebbinghaus-lite/` et lance
les tests sur deux tailles d’écran. Sans secours de routage, une URL de
fichier inexistante répond 404. Le contrôle d’inventaire vérifie les PDF et
JSON servis par rapport aux fichiers publics d’origine.

## Lors de la mise en ligne

1. Renommer le dépôt distant en `ebbinghaus-lite`, puis mettre à jour
   `origin` vers `git@github.com:thewebbutbeyond/ebbinghaus-lite.git`.
2. Une fois les changements intégrés à `main`, vérifier que Pages utilise
   **GitHub Actions** comme source et lancer **Publier ebbinghaus lite**.
   Le workflow manuel n’accepte que `main` dans le dépôt renommé.
3. Vérifier [la bibliothèque cible](https://thewebbutbeyond.github.io/ebbinghaus-lite/),
   un lien direct vers un cours et
   [l’importateur cible](https://thewebbutbeyond.github.io/ebbinghaus-lite/importer/)
   avant de remplacer les liens partagés. L’ancienne racine de l’importateur
   devient le chemin `/ebbinghaus-lite/importer/` ; pour les PDF et JSON
   sous `cours/`, remplacer seulement le préfixe du dépôt. Pour l’ancienne
   liste plate, partager le lien vers ESI :
   `/ebbinghaus-lite/#/he2b/esi`.

GitHub [ne redirige pas les anciennes URL Pages lors d’un renommage](https://docs.github.com/en/repositories/creating-and-managing-repositories/renaming-a-repository).
