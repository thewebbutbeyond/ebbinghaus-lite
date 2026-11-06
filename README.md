# Ebbinghaus Viewer

Le viewer permet de réviser un paquet de flashcards à partir d’un fichier
JSON, sur téléphone, tablette ou ordinateur. Le fichier est lu dans le
navigateur et reste sur l’appareil.

Les [supports de cours publics](https://thewebbutbeyond.github.io/ebbinghaus-viewer/cours/)
regroupent des corrigés, fiches méthode et paquets de cartes.

## Démarrage rapide

1. Ouvre [le viewer](https://thewebbutbeyond.github.io/ebbinghaus-viewer/).
2. Clique sur **Importer tes cartes** et choisis un fichier JSON. Pour
   essayer, utilise [le paquet fictif](examples/paquet-fictif.json).
3. Touche une carte pour révéler la réponse. **J’ai trouvé** retire la carte
   du paquet en cours ; **À revoir** la remet à la fin.

Pour travailler sur le projet en local, il faut Node.js 24.12 ou plus récent
et npm. Depuis le dossier du dépôt :

```sh
npm ci
npm run dev
```

Ouvre [le viewer local](http://127.0.0.1:5173). Pour arrêter le serveur,
fais Ctrl+C.

## Documentation

Le [guide technique](docs/guide-technique.md) décrit l’architecture, les choix
de langage, le format des paquets et les garanties du code. La page
[Expertise et décisions d’ingénierie](docs/jugement-technique.md) explique
les connaissances derrière ces choix et le fonctionnement du déploiement.
