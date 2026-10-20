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
    data/manoir.ts     Personnages, lieux, armes (fiches complètes)
    data/indices.ts    79 cartes d'indice (règles logiques, faits chronologiques, témoignages partiels, journal d'Armand) + modèles de faux indices
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
  server/            Serveur HTTP + WebSocket
    salons.ts          Salons, codes, identités, hôte, reconnexion, sauvegarde
    serveur.ts         Socket.IO, diffusion des vues, minuteurs, bots, limitation de débit
    validation.ts      Schémas zod des messages entrants
    index.ts           Lecture de la configuration et démarrage
  client/            Interface React (écrans, composants, connexion temps réel)
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

Chaque action (acceptée ou refusée, avec le motif) est enregistrée côté serveur dans `partie.audit`, avec la solution et le complice à la création. Il est sauvegardé dans `data/salons.json` et n'est jamais envoyé aux navigateurs.
