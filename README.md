# ebbinghaus lite

Bibliothèque de flashcards, formulaire et méthodes, corrigés et exemples
interactifs. Choisis ton établissement et ton département, puis saisis le
mot de passe de l’archive pour accéder aux cours. Aucun compte requis.
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

Le build Pages utilise une archive déjà chiffrée ; il ne demande aucun
secret. Le mot de passe de l’archive se transmet séparément aux élèves.
Pour préparer ou mettre à jour les documents, voir
[l’accès aux archives](docs/acces-archives.md).

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

- [Bibliothèque : architecture et passage à Pages](docs/bibliotheque-pages.md)
- [Accès aux archives : chiffrement, mise à jour et limites](docs/acces-archives.md)
- [Exemple interactif DDoS : utilisation et modèle](docs/simulation-ddos.md)
- [Chapitre 1 : cookie de session volé, scytale et phishing](docs/exemples-chapitre-1.md)
- [Guide technique de l’importateur](docs/guide-technique.md)
- [Expertise et décisions d’ingénierie](docs/jugement-technique.md)
- [Guide du prototype privé](docs/portail-local.md)
