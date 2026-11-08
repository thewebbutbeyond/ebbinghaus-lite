# ebbinghaus lite

Bibliothèque publique de flashcards, fiches méthode et corrigés. Choisis
ton établissement, puis ton département et ton cours. Aucun compte requis.
L’importateur JSON est une page séparée : le fichier importé reste sur
l’appareil.

## Démarrage rapide

Pour travailler sur le projet en local, il faut Node.js 24.12 ou plus récent
et npm. Depuis le dossier du dépôt :

```sh
npm ci
npm run build:pages
npm run preview:pages
```

Ouvre [ebbinghaus lite](http://127.0.0.1:4177/ebbinghaus-lite/), clique sur
**Voir les cours** et suis **HE2B → ESI**. Pour réviser ton propre paquet, ouvre
[l’importateur](http://127.0.0.1:4177/ebbinghaus-lite/importer/) et choisis
un fichier JSON, par exemple [le paquet fictif](examples/paquet-fictif.json).

## Prototype privé

Le prototype avec connexion reste utilisable en local et ne fait pas partie
du site Pages. Pour l’essayer avec deux comptes et des documents fictifs :

```sh
npm ci
npm run portal:demo
npm run build:portal
npm run portal:start
```

Ouvre [Mes cours](http://127.0.0.1:4176/portal/) et utilise un des mots de passe
affichés par la commande de démonstration. [L’import JSON](http://127.0.0.1:4176/)
reste accessible sans compte.

## Documentation

- [Bibliothèque publique : architecture et passage à Pages](docs/bibliotheque-pages.md)
- [Exemple interactif DDoS : utilisation et modèle](docs/simulation-ddos.md)
- [Guide technique de l’importateur](docs/guide-technique.md)
- [Expertise et décisions d’ingénierie](docs/jugement-technique.md)
- [Guide du prototype privé](docs/portail-local.md)
