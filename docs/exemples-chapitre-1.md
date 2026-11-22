# Exemples interactifs du chapitre 1

Les quatre exemples du cours sont indépendants et suivent son ordre : phishing,
DDoS, cookie de session volé, scytale. Chaque page associe une scène à un état
calculé, puis à une explication du mécanisme toujours visible. Les dessins et
le code sont originaux. Le PDF et la photographie de l’école ne sont pas
republiés avec ces exemples.

## Essayer localement

```bash
cd /Users/nathan.sidib/Code/thewebbutbeyond/Ebbinghaus/ebbinghaus-lite
npm run build:pages
npm run preview:pages
```

Le serveur utilise le port 4177. S’il tourne déjà, conserver le processus en
place et ouvrir son lien après compilation.

Depuis <http://127.0.0.1:4177/ebbinghaus-lite/>, choisir HE2B, ESI, déverrouiller
l’archive, puis ouvrir Introduction à la cybersécurité. Les liens directs
passent par le même écran de déverrouillage :

* [Cookie de session volé](http://127.0.0.1:4177/ebbinghaus-lite/#/he2b/esi/introduction-a-la-cybersecurite/simulations/session-volee)
* [Scytale](http://127.0.0.1:4177/ebbinghaus-lite/#/he2b/esi/introduction-a-la-cybersecurite/simulations/scytale)
* [Phishing](http://127.0.0.1:4177/ebbinghaus-lite/#/he2b/esi/introduction-a-la-cybersecurite/simulations/phishing)

Le mot de passe est géré par la procédure d’archive existante. Il ne figure
ni dans ce document, ni dans les modèles pédagogiques. Les jetons et mots de
passe affichés dans les exemples sont exclusivement fictifs.

## Commandes et cycle de vie

Les boutons à icônes suivent l’ordre Précédent, Lire/Pause, Recommencer,
Suivant et utilisent le même composant que DDoS. Leurs noms restent accessibles
au clavier et aux lecteurs d’écran, avec une infobulle au survol. Pour les trois
nouveaux exemples, un pas est un événement pédagogique,
pas une seconde de réseau ou de travail humain. L’affichage Étape n/N indique
les transitions parcourues depuis l’état initial 0. La lecture automatique
avance d’un événement par seconde.

Pause conserve la position. Précédent et Suivant suspendent la lecture et
changent l’état consulté. Recommencer restaure l’état initial et les réglages
par défaut. La lecture s’arrête à la fin. Masquer l’onglet suspend la lecture
sans reprise automatique ; quitter la vue libère le minuteur et les écouteurs
via l’AbortSignal du routeur. Recharger recrée l’état initial.

Les modèles session et phishing construisent une série déterministe
d’instantanés à partir de transitions pures. Le lecteur parcourt ces états ;
il ne rejoue pas une collecte réelle et ne produit pas de nouveaux événements
en revenant en arrière. La scytale recalcule la languette et la face avant du bâton pour les
paramètres courants.

## Cookie de session volé

Référence : chapitre 1, diapositive 24, page 53 du PDF de travail.

Le scénario déroule six transitions : authentification fictive, création de la
session, requête normale, copie du jeton, requête de l’attaquant, réponse du
serveur. Les trois acteurs restent visibles avec leurs informations : jeton
détenu, association côté serveur et compte accessible.

La table des sessions associe un identifiant opaque fictif à Alice. La fonction
de résolution cherche la valeur fournie dans cette table. Une valeur absente
ou inconnue ne donne aucune identité. L’attaquant reçoit une copie du même
identifiant, puis l’utilise ; il ne reçoit jamais le mot de passe. L’identité
accessible provient du résultat de la recherche, pas du nom de l’acteur dans
le dessin.

Le vol est une hypothèse du scénario. Aucun vrai cookie n’est lu et aucune
vulnérabilité n’est exploitée. Les sections sur la fixation et la falsification
servent seulement à distinguer les trois termes cités par le cours ; elles
n’ajoutent pas d’autres simulations.

Pour la démonstration, avancer jusqu’à la requête normale, puis jusqu’à la
copie. Revenir une étape : l’attaquant ne détient plus le jeton dans cet état.
Avancer jusqu’à la réponse finale : il obtient le compte d’Alice avec le même
jeton et sans mot de passe.

## Scytale

Référence : chapitre 1, diapositives 35 et 36, pages 64 et 65. Le cours présente
un exemple historique et la photographie d’une languette enroulée autour d’un
bâton. Le dessin plat du bâton, ses faces et les lettres de remplissage sont
notre transposition pédagogique.

Deux réglages indépendants, de 3 à 8 :

* la languette : une lettre du message toutes les k cases, les autres cases
  portant des lettres de remplissage déterministes ;
* le bâton : n faces (triangle, carré… octogone), dessinées à côté du curseur.

Enroulée sur un bâton à n faces, la languette revient sur la face avant toutes
les n cases. La face avant montre donc les cases 0, n, 2n… Le message se lit si
et seulement si k = n ; sinon la face mêle message et remplissage, et le verdict
indique si le bâton est trop fin (n < k) ou trop épais (n > k).

Étapes : Alice écrit sur une face de son bâton (k faces), la languette déroulée,
la languette enroulée sur le bâton du destinataire avec les cases de la face
avant en surbrillance, puis la lecture et le verdict. Changer le message revient
à l’étape 0 ; changer un curseur conserve l’étape. Le message est limité à 80
graphèmes, découpés par Intl.Segmenter. Recommencer restaure RENDEZVOUS A MIDI,
une languette à 3 et un bâton à 4 faces : l’élève part d’un mauvais bâton.

Cas de référence : ABC avec k = 3 donne une languette de 9 cases, le message aux
cases 0, 3 et 6 ; un bâton à 3 faces lit ABC.

## Phishing

Référence : chapitre 1, diapositive 6, page 20.

Les quatre étapes restent visibles : identification de la cible, préparation
de l’appât, envoi du message, tromperie et collecte. La quatrième comprend
deux événements séparés : ouvrir le faux site, puis envoyer les identifiants.
L’affichage compte donc cinq transitions depuis l’état initial.

Les informations connues de l’attaquant sont des données du modèle. Il obtient
d’abord le nom et l’adresse de la cible. Les identifiants ne lui sont copiés
qu’au dernier événement, depuis les valeurs fictives de la victime, et
seulement si le message a été délivré et le faux site ouvert.

La scène permet d’inspecter le nom affiché, l’adresse d’expéditeur, le texte du
lien et sa destination réelle. Tous les domaines utilisent .test et restent
du texte. La page de connexion est une représentation, sans formulaire,
saisie utilisateur ni navigation vers ces adresses. Le scénario ne prétend
pas décrire toutes les données techniques transmises par une navigation
réelle, ni simuler les protections citées ailleurs dans le cours.

Pour la démonstration, s’arrêter après l’ouverture du faux site : l’attaquant
ne détient pas les identifiants. Avancer une fois : ils apparaissent chez lui.
Revenir une fois restaure l’état avant l’envoi.

## Architecture et vérification

TypeScript conserve la séparation entre état calculé et vue DOM/SVG. Un registre
typé associe les identifiants des exemples à leurs vues. Ajouter un identifiant
au catalogue sans lui fournir de vue provoque une erreur de typage.

Les exemples réutilisent le routeur à fragments et le déverrouillage de
l’archive. Le build Pages garde son préfixe /ebbinghaus-lite/. Les PDF et
paquets existants ne sont pas modifiés ou rechiffrés par cet ajout. Aucun
nouveau service, paquet npm ou mécanisme d’authentification n’est nécessaire.

```bash
npm test
npm run typecheck
PAGES_TEST_PORT=4187 npm run test:pages
npm run test:e2e
```

Le port de test 4187 évite d’arrêter un aperçu existant sur 4177. Les tests
exécutent des vecteurs indépendants, les limites de la scytale et le suivi des
informations des acteurs. Les tests Pages couvrent les commandes, le clavier,
les liens directs, le déverrouillage, le retour au cours et les rechargements.
Ils vérifient aussi les largeurs 1440, 390 et 320 pixels, les mouvements
réduits, l’absence de requêtes aux domaines fictifs et les régressions DDoS,
documents et importateur.

Les captures mobiles ne remplacent pas un essai tactile sur un vrai iPhone
Safari. L’acceptation pédagogique et visuelle finale appartient à Nathan.

## Sources

* [1] R. Absil, J. Dossogne et P. Hauweele, « Ch. 1 - Introduction », cours SEC1,
  ESI, 2026. [Source officielle figée](https://gitlab.com/computer-security3/sec1/-/blob/959f789db9fef7649b6b61cb8f812a2909091d41/Ch.%201%20-%20Introduction/slides.tex).
* [2] OWASP Foundation, « Session hijacking attack ».
  [Référence de contrôle](https://community.owasp.org/attacks/Session_hijacking_attack).
* [3] CISA, « Avoid Phishing Scams with Three Simple Tips », 2024.
  [Référence de contrôle](https://www.cisa.gov/sites/default/files/2024-09/Secure-Our-World-Phishing-Tip-Sheet.pdf).
