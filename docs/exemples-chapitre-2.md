# Exemples interactifs du chapitre 2

Le chapitre 2 (outils cryptographiques) compte 21 exemples prévus, dans l’ordre
du cours. Trois sont disponibles : le testament du milliardaire (p. 5 du PDF),
les blocs et bourrage (p. 9 à 17) et la clé symétrique partagée (p. 6 et 48
à 49). Les dessins et le code sont originaux. Le PDF n’est pas republié.

## Essayer localement

```bash
cd /Users/nathan.sidib/Code/thewebbutbeyond/Ebbinghaus/ebbinghaus-lite
npm run build:pages
npm run preview:pages
```

Le serveur utilise le port 4177. Le lien direct passe par l’écran de
déverrouillage de l’archive :

* [Testament du milliardaire](http://127.0.0.1:4177/ebbinghaus-lite/#/he2b/esi/introduction-a-la-cybersecurite/simulations/testament)
* [Blocs et bourrage](http://127.0.0.1:4177/ebbinghaus-lite/#/he2b/esi/introduction-a-la-cybersecurite/simulations/blocs-bourrage)
* [Clé symétrique partagée](http://127.0.0.1:4177/ebbinghaus-lite/#/he2b/esi/introduction-a-la-cybersecurite/simulations/cle-partagee)

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

## Blocs et bourrage

Un message de 165 octets est découpé en blocs de 16 octets : dix blocs pleins
et un onzième de 5 octets. Le bourrage PKCS#7 complète ce dernier avec onze
octets valant 0x0b.

Les trois étapes :

1. Le message est découpé : les blocs 1 à 10 sont pleins, le bloc 11 incomplet.
2. Le bourrage remplit le dernier bloc avec onze octets 0b.
3. Au déchiffrement, la valeur du dernier octet indique combien d’octets
   retirer : le message d’origine est retrouvé.

Sous la scène, l’étudiant tape son propre message et choisit une taille de
bloc de 8, 16 ou 32 octets. Un message qui tombe juste reçoit un bloc entier
de bourrage ; un caractère accentué compte pour deux octets.

Référence : Chapitre 2, blocs et bourrage, p. 9 à 17 du PDF.

## Clé symétrique partagée

Alice et Bob possèdent la même clé secrète, convenue à l’avance. Alice chiffre
son message ; seul le texte chiffré traverse le réseau. L’intercepteur le voit
mais, sans la clé, ne peut rien en tirer. Bob déchiffre avec la même clé.

Les quatre étapes :

1. Alice chiffre son message avec la clé.
2. Le texte chiffré circule : l’intercepteur ne voit que des octets.
3. L’intercepteur essaie une autre clé : déchiffrement refusé.
4. Bob déchiffre avec la clé partagée et lit le message.

Sous la scène, l’étudiant chiffre son propre message et essaie des clés : seule
la clé partagée le déchiffre, un seul caractère de différence suffit à échouer.

Chiffrement réel AES-GCM dans le navigateur (clé dérivée par SHA-256, nonce
fixe pour la reproductibilité). Données fictives.

Référence : Chapitre 2, clé symétrique partagée, p. 6 et 48 à 49 du PDF.

## Tests

* `node --test tests/chapter2-models.test.ts` : SHA-256 réel, verdict
  seulement à l’étape 6, le notaire B ne détient jamais le texte ; 11 blocs
  et bourrage sur le seul dernier bloc, aller-retour PKCS#7 pour toutes les
  longueurs ; seule la clé partagée déchiffre, une modification du texte
  chiffré est rejetée.
* `npm run test:pages` : parcours pas à pas et édition libre, bureau et mobile.
