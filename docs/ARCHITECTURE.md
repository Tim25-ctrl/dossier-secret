# Architecture technique

## Choix de la stack

| Besoin | Choix | Pourquoi |
|---|---|---|
| Langage | **TypeScript** partout | Un seul langage pour le moteur, le serveur, le client et les tests ; les types partagés évitent les incohérences de protocole. |
| Temps réel | **Socket.IO** (WebSockets) | Reconnexion automatique, accusés de réception, repli HTTP si les WebSockets sont bloqués. |
| Serveur | **Node.js + Express** | Un seul processus sert le site ET les WebSockets : un seul service à héberger. |
| Interface | **React + Vite** | Rapide, responsive, aucun service payant. |
| Persistance | **Mémoire + fichier JSON** (`data/salons.json`) | Une partie dure 30 minutes : pas besoin de base de données tant qu'une seule instance tourne. Aucun compte externe à créer. |
| Validation | **zod** | Toute donnée venant du navigateur est validée strictement avant d'atteindre le moteur. |
| Tests | **Vitest** + vrais clients `socket.io-client` | Tests unitaires du moteur ET tests d'intégration réseau réels. |

**Pourquoi pas de backend managé (Supabase, Firebase…) ?** Le jeu repose sur des secrets (solution, mains, rôle). Avec une base « temps réel » côté client, il faudrait des règles d'accès très fines et une logique serveur de toute façon. Un serveur Node autoritaire est plus simple, plus sûr et gratuit.

## Organisation du code

```
src/
  shared/            Code partagé (aucun secret) : types, données de l'affaire, logique des indices, protocole
    data/catalogue.ts  Catalogue des affaires : fiches et indices de toutes les histoires, réunis par identifiant
    data/manoir.ts     Le Manoir des Brumes : présentation, personnages, lieux, armes
    data/indices.ts    Ses 79 cartes d'indice (règles logiques, faits chronologiques, témoignages partiels, journal d'Armand)
    data/train.ts      Le train de nuit (l'Étoile du Simplon) : présentation, voyageurs, lieux, armes
    data/indicesTrain.ts  Ses 44 cartes d'indice (relationnelles, témoignages partiels, carnet d'Octave)
    data/paquebot.ts   Le paquebot (l'Aurélia) : présentation, suspects, lieux, armes
    data/indicesPaquebot.ts  Ses 44 cartes d'indice (même structure que le train, journal d'Édouard)
    data/fauxIndices.ts   Modèles de faux indices (ruse « Dossier trafiqué »), communs à toutes les affaires
    data/mobiles.ts    Grande enquête : les 6 mobiles de chaque histoire (fiche, récit de fin, dessin)
    data/indicesMobiles.ts  Grande enquête : 12 indices sur les mobiles par histoire
    logique.ts         Évaluation des règles, énumération des 216 combinaisons, conflits horaires
    types.ts           Types du jeu (actions, événements publics, journal privé, vue d'un joueur)
    protocole.ts       Messages WebSocket client <-> serveur
  engine/            MOTEUR DE RÈGLES pur (aucune entrée/sortie, testable seul)
    config.ts          Paramètres de règles (12 manches, 2 PA, pouvoirs…)
    generateur.ts      Génération + validation des affaires, distribution des cartes, rôle
    partie.ts          Machine à états : tours, PA, hypothèses, interrogations, pouvoirs, accusations
    vue.ts             FILTRAGE : construit la vue d'un joueur à partir de l'état complet
    rng.ts             Aléa cryptographique (parties) ou déterministe (tests)
  bots/              Joueurs automatiques (n'utilisent que la vue filtrée) et simulations
    grande.ts          Comportements propres à la Grande enquête (pouvoirs, tableau, Témoin, objectif du complice)
  server/            Serveur HTTP + WebSocket
    salons.ts          Salons, codes, identités, hôte, reconnexion, sauvegarde
    sauvegarde.ts      Sauvegardes chiffrées gardées par les joueurs (AES-256-GCM, clé CLE_SAUVEGARDE)
    serveur.ts         Socket.IO, diffusion des vues, minuteurs, bots, limitation de débit
    validation.ts      Schémas zod des messages entrants
    index.ts           Lecture de la configuration et démarrage
  client/            Interface React (écrans, composants, connexion temps réel)
    tutoriel/          Partie guidée : scenario.ts (la partie arrangée, testée à part), partieLocale.ts (moteur local qui la pilote),
                       chapitres.tsx (les 11 chapitres et leurs étapes), Guide.tsx (bulle, voile, sommaire des chapitres)
tests/               Tests automatisés (moteur, salons, réseau, parties complètes)
scripts/simulate.ts  Simulations d'équilibrage
```

## Principe de sécurité : le serveur est l'unique autorité

1. Le navigateur n'envoie que des **intentions** (« je propose telle hypothèse »). Il ne transmet jamais son identité dans le message : le serveur la déduit de la connexion authentifiée.
2. Le serveur **valide** la forme (zod) puis les **règles** (moteur) : tour, points d'action, cartes réellement détenues, droits du complice, compteurs…
3. Le serveur envoie à chaque joueur **sa vue filtrée** (`engine/vue.ts`), construite à partir de l'état complet. Ce qui n'y est pas copié n'existe pas côté navigateur : solution, mains des autres, rôle des autres, versions originales des hypothèses des autres, journal d'audit, jetons.
4. Le JavaScript est mono-thread : chaque message est traité entièrement avant le suivant. Deux requêtes simultanées ne peuvent donc pas dépenser deux fois les mêmes points d'action (testé).

### Identité et reconnexion

- À l'arrivée dans un salon, le serveur crée un identifiant de joueur et un **jeton secret** aléatoire (192 bits). Seul son **hachage SHA-256** est conservé côté serveur.
- Le navigateur garde le jeton dans le `sessionStorage` de l'onglet : un rafraîchissement reconnecte automatiquement, avec le même rôle, les mêmes cartes et les mêmes compteurs (ils sont stockés côté serveur).
- Une seconde connexion avec le même jeton remplace la première (« session ouverte ailleurs »).
- Le pseudonyme n'est jamais une preuve d'identité.

### Pas de fuite par le temps

- L'étape de falsification a une **durée fixe** pour chaque hypothèse (même si le complice n'a plus son pouvoir ou est l'auteur) : sa durée ne trahit rien.
- Chaque joueur interrogé doit répondre lui-même (même sans carte) : le complice qui hésite ne se distingue pas d'un joueur qui choisit quelle carte montrer.
- Une réponse automatique (délai dépassé) est toujours honnête : elle n'utilise jamais le pouvoir Mensonge.

## Hypothèse falsifiée : deux versions

Le moteur conserve `original` (jamais modifiée, utilisée pour calculer les cartes à montrer) et `publique` (diffusée aux autres). L'auteur voit uniquement son original : rien dans ses données ne lui indique que les autres ont vu une version différente. Limite inhérente à la règle : comme les cartes à montrer sont calculées sur l'original, un joueur interrogé peut se voir proposer une carte absente de la version annoncée.

## Plusieurs affaires

Chaque affaire (« histoire ») a ses six suspects, six lieux et six armes, déclarés dans `ELEMENTS_PAR_AFFAIRE` (`src/shared/types.ts`). Les identifiants des éléments et des indices sont **uniques toutes affaires confondues** : un élément ou un indice suffit à retrouver son affaire, et les fiches peuvent être cherchées sans savoir d'où elles viennent. La partie mémorise son affaire (`config.affaire`, « manoir » par défaut, y compris pour les parties sauvegardées avant l'arrivée du train) ; le moteur, les bots et l'interface n'utilisent que les éléments et les indices de cette affaire, et le serveur refuse une hypothèse, une accusation, une falsification ou une marque de carnet portant sur une autre histoire. La vue envoyée au joueur contient le nom de l'affaire (`vue.affaire`), jamais le dossier secret.

## Génération des affaires

1. La solution est tirée au sort (aléa cryptographique).
2. Seules les cartes d'indice dont **toutes les règles sont vraies** pour cette solution sont candidates. Les règles d'une carte : `pas X`, `pas X et Y ensemble`, `parmi [X, Y…]`, `si X alors Y`, plus les règles **déduites automatiquement des faits chronologiques** (une personne ou une arme placée ailleurs pendant toute la fenêtre du crime est écartée).
3. Sélection aléatoire en excluant les paires contradictoires (contradiction déclarée ou chevauchement horaire : même personne à deux endroits en même temps).
4. **Validation automatique** avant chaque démarrage : aucun indice n'exclut la solution, pas de contradiction, au moins 4 combinaisons restent possibles avec les seuls indices (pas de révélation immédiate), les indices publics de départ (aucun par défaut depuis le 20/10/2026) laissent au moins 2 possibilités par catégorie, et avec toutes les informations de la partie une seule combinaison reste possible. En cas d'échec : régénération.

Testé pour les 216 solutions possibles.

## Hôte et déconnexions

- L'hôte lance la partie, ajoute des bots et relance une partie terminée. Pendant la partie, il n'a **aucun pouvoir** sur le jeu.
- S'il quitte le lobby, le rôle passe immédiatement au joueur suivant ; s'il est déconnecté plus de 30 s, le rôle passe à un joueur connecté.
- Un joueur humain déconnecté (ou parti) garde sa place et **met la partie en pause** : plus aucune échéance ne court, les bots attendent, les actions de jeu sont refusées (le carnet et la discussion restent libres). Les autres joueurs voient, après 3 s de grâce, une fenêtre « Partie en pause » avec la discussion : attendre son retour, ou le **remplacer par un bot** (ou « continuer sans lui » si les bots sont désactivés : ses tours expirent alors en 25 s). À la reprise, les échéances sont décalées de la durée de la pause.
- Un joueur remplacé par un bot qui revient avec son jeton reprend sa place ; le bot s'efface.
- Dans le lobby, un joueur déconnecté depuis 2 minutes est retiré. Un salon sans humain connecté depuis 2 heures est supprimé.

## Journal d'audit

Chaque action (acceptée ou refusée, avec le motif) est enregistrée côté serveur dans `partie.audit`, avec la solution et le complice à la création. Il est sauvegardé dans `data/salons.json` et n'est jamais envoyé lisible aux navigateurs.

## Sauvegardes gardées par les joueurs

L'offre gratuite de l'hébergeur efface la mémoire et le disque du serveur à chaque redémarrage (mise à jour, mise en veille). Pour que les parties survivent :

- Toutes les 3 s au plus après un changement, le serveur envoie à chaque joueur humain connecté (événement `sauvegarde`) une copie de **tout** son salon, compressée puis chiffrée en **AES-256-GCM** avec une clé dérivée de `CLE_SAUVEGARDE` (environ 2 à 15 Ko). L'appareil la garde dans son `localStorage`, dans **une seule place** : chaque copie remplace la précédente. Elle est effacée quand le joueur quitte la partie, quand la partie se termine (le serveur cesse alors d'en envoyer) et au bout de 7 jours.
- Si, en revenant, le joueur apprend que le salon n'existe plus, son navigateur envoie la copie à `POST /api/restaurer`. Le serveur la déchiffre, vérifie son authenticité (une copie modifiée, trop ancienne — 7 jours — ou chiffrée avec une autre clé est refusée), recrée le salon s'il n'existe pas déjà, puis le joueur reprend sa place avec son jeton habituel. Les autres joueurs le rejoignent de la même façon.
- Une partie rechargée ainsi ouvre une **salle d'attente** (`salon.reprise`) : code du salon, partage, liste des joueurs revenus ou attendus, discussion, remplacement d'un absent par un bot. Elle se ferme d'elle-même quand plus personne ne manque (la partie n'est plus en pause).

## Comptes, emplacements de sauvegarde et base de données

- `src/server/comptes.ts` : comptes facultatifs, pseudonyme + mot de passe, sans e-mail. Mot de passe et code de secours gardés sous forme d'empreinte scrypt salée ; jeton de session aléatoire (empreinte SHA-256 côté serveur, 180 jours) ; 5 essais faux pour un pseudonyme = blocage de 5 minutes (en mémoire). Le code de secours (12 caractères, montré une fois) permet de choisir un nouveau mot de passe ; il est alors remplacé et les autres appareils sont déconnectés.
- Le profil (grade, succès) suit le compte : copie locale `dossier-secret:profil-compte`, envoyée au serveur à chaque changement (`compte:profil`, validé par zod). À la création, le profil sans compte de l'appareil devient celui du compte ; à la connexion à un compte existant, le profil sans compte reste sur l'appareil (il revient à la déconnexion).
- `src/server/emplacements.ts` : 3 emplacements solo + 3 multijoueur par **compte** (clé `compte:<id>`). Sans compte : pas d'emplacements (la sauvegarde automatique de secours reste). Les emplacements créés avant les comptes (empreinte d'un « code joueur » d'appareil) sont repris par le compte à la création ou à la connexion depuis cet appareil.
- Enregistrer (`emplacements:enregistrer`) copie le salon entier tel quel (`GestionnaireSalons.instantane`) : en solo le joueur, en multijoueur l'hôte seulement. Un salon est « solo » s'il a été créé par « Seul contre des bots » (`Salon.solo`).
- Charger (`emplacements:charger`, `GestionnaireSalons.chargerSauvegarde`) : nouveau jeton pour l'auteur, qui devient l'hôte ; même code de salon si libre (les autres retrouvent leur place avec leur ancienne session ou « Rejoindre » + même pseudonyme), nouveau code s'il est pris par une autre partie, refus si la même partie est encore jouée par quelqu'un.
- Dépôts : `DepotSql` (PostgreSQL via `DATABASE_URL`, par exemple Neon), `DepotFichier` (`data/emplacements.json`, en local seulement : désactivé sur Render, dont le disque est effacé), `DepotMemoire` (tests). Les tests utilisent PGlite, un vrai PostgreSQL dans le processus.
- Avec `DATABASE_URL`, l'état de tous les salons est aussi écrit dans la table `etat_serveur` (au plus toutes les 3 s, et à l'arrêt du serveur) puis rechargé au démarrage : une mise à jour ou une mise en veille ne coupe plus les parties. Les copies chiffrées sur les appareils restent en secours.
- Le serveur annonce `capacites: { comptes }` à la connexion : sans dépôt, pas de comptes et le client garde l'ancien bouton « Reprendre une sauvegarde » (fichier).

## Retour d'un joueur sur un autre appareil

Un joueur qui n'a plus sa session (autre appareil, données du navigateur effacées) utilise « Rejoindre une partie » avec le code et **le même pseudonyme**. Pendant une partie, le serveur n'y voit pas une arrivée mais une **demande de place** : elle ne vise qu'une place libre (joueur absent ou remplacé par un bot) et doit être **acceptée par un joueur présent**, car un pseudonyme n'est pas une preuve d'identité. En cas d'accord, cette place reçoit un nouveau jeton (l'ancien ne fonctionne plus) et le joueur la reprend comme une reconnexion. Une demande disparaît si le demandeur ferme sa page, si le joueur revient par lui-même, si la partie se termine ou au bout de 10 minutes. Les demandes ne sont jamais sauvegardées.
- Le menu ☰ permet aussi de télécharger un fichier (copie chiffrée + session du joueur), repris depuis l'accueil : pour continuer un autre jour ou sur un autre appareil.
- La copie contient la solution et les mains : sans la clé, elle est illisible ; le chiffrement authentifié empêche aussi de la modifier. La clé ne doit pas changer, sinon les sauvegardes existantes deviennent inutilisables.
