# Exemple interactif DDoS du chapitre 1

La simulation illustre la disponibilité : des machines compromises envoient
assez de requêtes pour retarder celles des utilisateurs ordinaires. Les
requêtes sont des objets en mémoire. Aucun trafic d'attaque n'est émis.

## Utilisation locale

```bash
cd /Users/nathan.sidib/Code/thewebbutbeyond/Ebbinghaus/ebbinghaus-lite
npm run build:pages
npm run preview:pages
```

Ouvrir :
<http://127.0.0.1:4177/ebbinghaus-lite/#/he2b/esi/introduction-a-la-cybersecurite/simulations/ddos>

Depuis l'accueil : Voir les cours → HE2B → ESI → Introduction à la
cybersécurité → Exemples interactifs → DDoS. L'importateur indépendant reste sous
`/ebbinghaus-lite/importer/`.

Pour une démonstration :

1. Cliquer sur **Suivant** : 4 requêtes arrivent, les 4 sont traitées.
2. **Lancer l'attaque**, puis **Suivant** : 16 arrivées, 8 traitements,
   8 requêtes en attente avec les réglages initiaux.
3. **Arrêter l'attaque**, puis avancer deux fois : la file passe à 4 puis 0.
4. Revenir en arrière et avancer pour retrouver le même état. Modifier un
   réglage après un retour arrière crée un nouveau futur, sans vider la file.
5. **Recommencer** restaure le temps, l'historique et les réglages initiaux.

Les boutons à icônes suivent l'ordre Précédent, Lire/Pause, Recommencer, Suivant.
Un triangle contre une barre verticale recule ou avance d'une étape.
Le triangle lance la lecture ; les deux barres la suspendent ; le carré
ramène au début et laisse l'exemple en pause. Les noms accessibles et les
infobulles identifient chaque commande. Le bouton d'attaque, à droite,
est distinct des commandes de lecture. Sous l'exemple, l'article toujours
visible explique la disponibilité, les machines compromises et la surcharge
à partir du chapitre1 et du cas numérique initial. Les références à ce cas
restent fixes quand on explore d'autres réglages dans la scène.

L'acceptation sur un véritable iPhone Safari revient à Nathan. Les tests
d'écran mobile ne remplacent pas cet essai.

## Calcul et hypothèses

Un pas représente une seconde simulée. Le trafic ordinaire est fixé à
4 requêtes par seconde. Le trafic d'attaque vaut le nombre de machines
compromises multiplié par leur débit, lorsque l'attaque est active.

Réglages : 0 à 12 machines, 1 à 8 requêtes par seconde et par machine,
capacité de 1 à 32 requêtes par seconde. Les valeurs initiales sont 6, 2
et 8 ; l'attaque est désactivée et la lecture en pause.

À chaque pas :

1. Produire les arrivées dans un ordre entrelacé fixe. À chaque tour, ajouter
   une requête ordinaire s'il en reste, puis une requête de chaque machine
   d'attaque s'il lui reste du débit pour cette seconde.
2. Ajouter ces requêtes à la file existante, dans cet ordre.
3. Traiter les plus anciennes, dans la limite de la capacité.
4. Conserver les 200 premières requêtes restantes ; rejeter les plus récentes
   qui dépassent cette limite.

Cet ordre facilite la comparaison entre deux essais. Il ne prétend pas
reproduire l'ordonnancement d'un réseau réel. Pour chaque origine et au total :

```text
file après = file avant + arrivées - traitées - rejetées
```

Les compteurs du dernier pas décrivent une seconde ; la file décrit l'état
courant. Les cumuls couvrent tous les pas du scénario courant. Une attaque
arrêtée peut donc laisser des requêtes d'attaque en attente.

Le modèle ne représente ni la latence réseau, ni les retransmissions,
protocoles, pertes en transit, mécanismes de défense ou différences de coût
entre requêtes. Une surcharge peut aussi avoir une cause légitime. Les
origines sont connues ici pour expliquer le scénario ; un serveur réel ne
dispose pas automatiquement de cette information.

## Historique et cycle de vie

Chaque instantané conserve les requêtes en attente, les compteurs et les
réglages appliqués. Revenir puis avancer sans modification relit le même
instantané. Changer un réglage suspend la lecture et remplace uniquement le
futur ; le changement prend effet au pas suivant.

La simulation s'arrête à 120 secondes simulées. Revenir en arrière reste
possible. Masquer l'onglet suspend la lecture ; elle ne reprend pas toute
seule. Quitter la simulation libère ses écouteurs et son minuteur. Recharger
la page restaure l'état initial.

## Choix technique

TypeScript sépare le calcul pur de la vue DOM/SVG. Le navigateur calcule les
résultats ; SVG les représente. Vite compile ces modules dans l'artefact
Pages existant. Aucun serveur, moteur Python ou service externe n'intervient.
Le fragment de l'URL conserve les liens directs et les rechargements sur
GitHub Pages, qui ne fournit pas de réécriture serveur.

Une animation Manim préfabriquée expliquerait une séquence fixe, mais ne
recalculerait pas un changement de capacité. Pyodide rendrait Python possible
dans le navigateur au prix d'un environnement supplémentaire. Ce premier
modèle ne justifie ni l'un ni l'autre.

## Référence pédagogique

Le [cours officiel, chapitre 1, diapositive 21](https://gitlab.com/computer-security3/sec1/-/blob/959f789db9fef7649b6b61cb8f812a2909091d41/Ch.%201%20-%20Introduction/slides.tex)
présente les clients, le serveur, puis l'attaquant, les machines compromises
et l'afflux de trafic. La file, ses limites et les valeurs numériques sont
les hypothèses de notre modèle pédagogique. Le dessin SVG et le code sont
originaux ; aucun visuel ni PDF de l'école n'est ajouté à l'artefact.

## Vérification

```bash
npm test
npm run typecheck
npm run test:pages
npm run test:e2e
```

Les tests du modèle couvrent les références numériques, les limites, la
conservation et l'historique. Les tests Pages utilisent le site compilé sous
son préfixe réel ; ils vérifient les commandes, la navigation, les tailles
d'écran, la réduction des mouvements et les régressions de la bibliothèque.
Le catalogue garde ses PDF et JSON existants et leur publication explicite.
