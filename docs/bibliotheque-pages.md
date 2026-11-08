# Bibliothèque et GitHub Pages

La bibliothèque et l’importateur sont deux entrées HTML du même artefact.
Ils partagent le moteur de révision TypeScript. L’importateur lit un
fichier local sans mot de passe. Le prototype avec comptes conserve son
build séparé et ne fait pas partie de Pages.

Le [catalogue](../src/lite-catalog.ts) fixe les noms, l’ordre, les chemins
logiques et l’archive de chaque département. Sans fragment, l’accueil
présente la bibliothèque ; **Voir les cours** ouvre les institutions sous
`#/`. Le choix d’un département mène à **Accéder à l’archive**. Le mot de
passe déverrouille les cours, les cartes et les PDF.

Les ancres et `hashchange` conservent les liens directs et l’historique.
Un lien profond passe par le même déverrouillage avant de rendre sa page.
Le logo revient à l’accueil. Une clé dérivée dans `sessionStorage` permet
les rechargements dans le même onglet.

Les corrigés sont regroupés par type (chapitres, bilans, examens), puis les
évaluations par mois, toutes années confondues. Le catalogue indique le type
et le mois explicitement ; les titres ne servent pas à déduire ces groupes.
Le champ `scope` d’un paquet distingue le cours complet des chapitres ; une
ligne fine sépare les deux listes lorsqu’elles sont toutes les deux présentes.
Les exemples portent le titre `Chapitre X • Nom`, repris dans leur page et le
fil d’Ariane sans modifier leur lien direct.

`npm run build:pages` compile les deux entrées et copie uniquement les
archives chiffrées référencées dans `dist-pages/archives/`. Il ne copie ni
PDF, ni paquet en clair, ni secret, ni original de l’école, ni prototype
privé. Les chemins logiques sous `cours/` ne sont plus des fichiers publics.
Voir [Accès aux archives](acces-archives.md) pour la préparation du contenu,
les garanties du chiffrement et ses limites.

Le cours de cybersécurité référence quatre exemples calculés du chapitre 1 :
phishing, [DDoS](simulation-ddos.md), cookie de session volé et scytale.
Le [guide des trois nouveaux exemples](exemples-chapitre-1.md) décrit les
transitions et les conventions pédagogiques. Leurs pages passent par le même
accès à l’archive. Leur code reste du code applicatif public.

Quand un cours change, mettre à jour son champ `updatedOn`
(`AAAA-MM-JJ`). Après modification d’un document, régénérer l’archive
avant le build. Un redéploiement seul ne change pas cette date.

`npm run test:pages` sert le véritable artefact sous `/ebbinghaus-lite/`
sur deux tailles d’écran. Les tests d’accès utilisent le secret local,
transmis séparément. Les anciennes URL de fichiers sous `cours/`
répondent 404. Les contrôles couvrent l’inventaire, les mots de passe, les
liens directs, les cartes, les PDF, les simulations et l’importateur.

Le workflow manuel **Publier ebbinghaus lite** n’accepte que `main`.
Il publie une archive préparée sans recevoir le mot de passe. Les liens
vers un cours après `#` restent valables ; les anciens liens directs de
documents doivent être remplacés par le lien vers leur cours.

La modification locale ne supprime pas le contenu du site actuellement
en ligne ni les fichiers des anciens commits publics. La publication du
nouvel artefact et la gestion des anciennes copies sont deux opérations
distinctes. Aucune réécriture d’historique n’est automatisée ici.
