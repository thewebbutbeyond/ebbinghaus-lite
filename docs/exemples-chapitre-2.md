# Exemples interactifs du chapitre 2

Le chapitre 2 (outils cryptographiques) compte 21 exemples prévus, dans l’ordre
du cours. Le premier est disponible : le testament du milliardaire (p. 5 du
PDF). Les dessins et le code sont originaux. Le PDF n’est pas republié.

## Essayer localement

```bash
cd /Users/nathan.sidib/Code/thewebbutbeyond/Ebbinghaus/ebbinghaus-lite
npm run build:pages
npm run preview:pages
```

Le serveur utilise le port 4177. Le lien direct passe par l’écran de
déverrouillage de l’archive :

* [Testament du milliardaire](http://127.0.0.1:4177/ebbinghaus-lite/#/he2b/esi/introduction-a-la-cybersecurite/simulations/testament)

## Testament du milliardaire

Un père dépose son testament chez le notaire A et l’empreinte SHA-256 de ce
texte chez le notaire B. George falsifie la copie du notaire A. À la lecture,
l’empreinte recalculée ne correspond plus à celle du notaire B.

Les six étapes, avec les mêmes commandes que le chapitre 1 :

1. Le père rédige son testament.
2. Il calcule son empreinte.
3. Le texte part chez le notaire A, l’empreinte seule chez le notaire B.
4. George remplace « ne recevra rien » par « recevra tout ».
5. À la lecture, l’empreinte du texte présenté est recalculée.
6. Les deux empreintes sont comparées : testament modifié.

Sous la scène, l’étudiant modifie librement le texte présenté et voit
l’empreinte et le verdict changer en direct. Retrouver le texte original
rétablit « intact » ; un seul caractère ajouté le fait basculer.

Les empreintes sont de vrais SHA-256, calculés dans le navigateur par
WebCrypto ; aucun texte n’est envoyé. Les données sont fictives.

Référence : Chapitre 2, testament du milliardaire, p. 5 du PDF ;
source du cours : `Ch. 2 - Cryptographic tools/slides.tex` du dépôt
computer-security3/sec1.

## Tests

* `node --test tests/chapter2-models.test.ts` : SHA-256 réel, verdict
  seulement à l’étape 6, le notaire B ne détient jamais le texte.
* `npm run test:pages` : parcours pas à pas et édition libre, bureau et mobile.
