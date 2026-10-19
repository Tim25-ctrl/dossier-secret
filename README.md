# Dossier Secret

**Jeu multijoueur en ligne de déduction, d'enquête et de bluff — de 3 à 6 joueurs, dans le navigateur.**

Le 17 octobre, à 23 h 17, Armand de Valombre est retrouvé mort dans son manoir isolé par la tempête. Six suspects, six lieux, six armes : les joueurs doivent découvrir qui a tué, où, et avec quoi. Mais l'un d'eux est le **complice** : il connaît le meurtrier et peut mentir ou falsifier une hypothèse pour faire échouer l'enquête.

- Interface en français, ordinateur / tablette / smartphone
- Salons privés avec code et lien d'invitation, synchronisation en temps réel
- Rôles secrets, cartes privées, interrogations, deux pouvoirs du complice, accusations finales
- Carnet de déduction privé, discussion écrite, archives à consulter
- Reconnexion automatique (rafraîchissement, coupure réseau, redémarrage du serveur)
- Joueurs automatiques (bots) pour compléter une table ou tester seul
- 93 tests automatisés, dont des parties complètes jouées en réseau

Les règles complètes sont dans le jeu (bouton « Règles du jeu »).

---

## 1. Prérequis

- **Node.js 20 ou plus récent** (testé avec Node 24). Téléchargement : <https://nodejs.org> (version « LTS »).
- Aucun compte, aucune clé, aucune base de données n'est nécessaire pour jouer en local.

Vérifiez l'installation dans un terminal :

```bash
node -v
```

## 2. Installation

Dans le dossier du projet :

```bash
npm install
```

## 3. Lancer le jeu

### Mode simple (recommandé pour jouer)

```bash
npm run build
```

```bash
npm start
```

Puis ouvrez <http://localhost:3001>.

`npm run build` prépare l'interface (à refaire après chaque modification du code du client) ; `npm start` lance le serveur qui sert à la fois le site et le temps réel.

### Mode développement (pour modifier le code)

```bash
npm run dev
```

Puis ouvrez <http://localhost:5173>. L'interface se recharge automatiquement à chaque modification ; le serveur redémarre tout seul.

## 4. Tester une partie à plusieurs

**Seul, sur un ordinateur :**
1. Ouvrez le jeu, cliquez sur « Créer une partie ».
2. Ouvrez un **deuxième onglet** (ou une fenêtre de navigation privée) à la même adresse, cliquez sur « Rejoindre une partie » et saisissez le code (ou collez le lien d'invitation). Chaque onglet est un joueur différent.
3. Ou bien, dans le salon, cliquez sur **« Ajouter un bot »** (réservé à l'hôte) pour compléter la table : il faut au moins 3 joueurs.
4. L'hôte clique sur « Lancer l'enquête ».

**À plusieurs, sur le même réseau Wi-Fi :**
1. Lancez `npm run build` puis `npm start` sur votre ordinateur.
2. Trouvez l'adresse IP locale de l'ordinateur : sous Windows, tapez `ipconfig` dans un terminal et notez l'« Adresse IPv4 » (par exemple `192.168.1.20`).
3. Les autres joueurs ouvrent `http://192.168.1.20:3001` sur leur téléphone ou ordinateur.
4. Si Windows affiche une alerte du pare-feu pour Node.js, autorisez l'accès sur les **réseaux privés**.

> Jouer avec des personnes qui ne sont pas sur votre réseau nécessite de **déployer** le jeu (section 7). Un serveur local n'est pas accessible depuis Internet.

## 5. Tests automatisés

```bash
npm test
```

Vérification des types :

```bash
npm run typecheck
```

Simulations d'équilibrage (environ 2 minutes) :

```bash
npm run simulate
```

Ce que couvrent les tests (`tests/`) :

| Fichier | Contenu |
|---|---|
| `generation.test.ts` | Données de l'affaire, 36 indices, génération valide pour les 216 solutions, détection des affaires incohérentes, distribution des cartes pour 3 à 6 joueurs |
| `regles.test.ts` | Rôles, points d'action, tours, hypothèses, ordre d'interrogation, une seule carte révélée, Mensonge, Hypothèse falsifiée, accusations, victoire, carnet |
| `parties-completes.test.ts` | 100 parties complètes simulées (3 à 6 joueurs) avec contrôle des invariants après chaque action, fin par limite de manches, reconnexion en cours de partie |
| `salons.test.ts` | Pseudonymes, codes, transfert d'hôte, sauvegarde/restauration après redémarrage |
| `serveur.test.ts` | Vrais clients WebSocket : salons, salon complet, filtrage des données privées, actions hors tour, requêtes simultanées, reconnexion, jeton forgé, deux parties complètes jouées en réseau |

## 6. Configuration

Toutes les valeurs ont un défaut raisonnable : **aucune configuration n'est obligatoire**. Pour les modifier, copiez `.env.example` en `.env` et éditez-le.

| Variable | Défaut | Rôle |
|---|---|---|
| `PORT` | `3001` | Port HTTP (fourni automatiquement par les hébergeurs) |
| `DATA_DIR` | `./data` | Dossier de sauvegarde des salons ; vide = pas de sauvegarde |
| `ENABLE_BOTS` | `true` | Autoriser l'hôte à ajouter des bots |
| `FALSIFICATION_WINDOW_SECONDS` | `8` | Durée fixe laissée au complice pour falsifier une hypothèse |
| `RESPONSE_TIMEOUT_SECONDS` | `60` | Délai pour répondre à une interrogation (puis réponse automatique honnête) |
| `TURN_TIMEOUT_SECONDS` | `180` | Durée maximale d'un tour |
| `DISCONNECTED_TURN_SECONDS` | `25` | Délai réduit quand le joueur concerné est déconnecté |
| `CORS_ORIGINS` | *(vide)* | Origines autorisées si le site est servi depuis un autre domaine |

Les règles du jeu elles-mêmes (12 manches, 2 PA, pouvoirs, nombre d'indices…) sont dans `src/engine/config.ts`.

## 7. Déployer en ligne (gratuit) avec Render

Render propose une offre gratuite qui supporte les WebSockets. Ce qu'il faut savoir (vérifié en octobre 2026 dans la [documentation Render](https://render.com/docs/free)) :

- **Mise en veille** après 15 minutes sans trafic (requêtes HTTP ou messages WebSocket) ; le réveil prend **environ une minute** — la première personne qui ouvre le site attend un peu.
- **750 heures gratuites par mois** et par compte (un service allumé en permanence en consomme environ 730).
- **Le disque est effacé** à chaque mise en veille, redémarrage ou redéploiement : les salons en cours sont alors perdus. Pendant une partie active, les messages échangés maintiennent le service éveillé.
- Pour supprimer la mise en veille : passer le service sur une instance payante (à partir d'environ 7 $/mois). Rien n'est facturé tant que vous restez sur l'offre gratuite.

**Ce que vous devez faire (comptes à créer) :**

1. Créez un compte **GitHub** (<https://github.com>) si vous n'en avez pas.
2. Créez un dépôt **vide** sur GitHub (par exemple `dossier-secret`), puis envoyez-y le projet. Le dépôt git local est déjà prêt ; dans le dossier du projet :

   ```bash
   git remote add origin https://github.com/VOTRE-NOM/dossier-secret.git
   ```

   ```bash
   git push -u origin main
   ```

3. Créez un compte **Render** (<https://render.com>), en vous connectant avec GitHub. Aucune carte bancaire n'est demandée pour l'offre gratuite.
4. Dans Render : **New → Blueprint**, choisissez votre dépôt. Render lit `render.yaml` et configure tout (commande de build, de démarrage, contrôle de santé).
   *Alternative :* **New → Web Service**, choisissez le dépôt, puis
   - Build Command : `npm ci --include=dev && npm run build`
   - Start Command : `npm start`
   - Instance Type : `Free`
5. Attendez la fin du déploiement (quelques minutes). Render affiche l'adresse publique, par exemple `https://dossier-secret.onrender.com`. Partagez-la : chacun crée ou rejoint un salon depuis son appareil.

Aucune clé secrète n'est nécessaire. Un `Dockerfile` est aussi fourni pour d'autres hébergeurs (Fly.io, Railway, Koyeb, VPS…).

> **Statut :** le jeu est déployé sur **https://dossier-secret.onrender.com** (service Render gratuit, région Francfort, redéploiement automatique à chaque envoi sur la branche `main` de GitHub). Une partie à deux joueurs + un bot y a été lancée avec succès depuis deux onglets. Elle n'a pas encore été testée depuis plusieurs appareils différents.

## 8. Ce qui est terminé

- Moteur de règles complet et indépendant de l'interface : affaire, solution secrète, rôles, cartes, tours, 2 PA, hypothèses, interrogations (1/2/2/3 interrogés), règle « une seule carte », pouvoirs **Mensonge** (2) et **Hypothèse falsifiée** (1) avec versions originale/publique, accusations finales, conditions de victoire, 12 manches.
- Générateur d'affaires avec 36 cartes d'indice (7 catégories), règles logiques, faits chronologiques, détection des contradictions, validation automatique avant chaque partie.
- 6 personnages (fiches complètes et portraits), 6 lieux, 6 armes illustrés en SVG.
- Serveur multijoueur autoritaire : salons privés (codes de 6 caractères, liens d'invitation), 6 joueurs maximum, validation de toutes les entrées, filtrage des données par joueur, limitation de débit, reconnexion, sauvegarde/restauration, transfert d'hôte, journal d'audit.
- Interface : accueil, tutoriel de premier lancement, règles, paramètres (taille du texte, animations), lobby, écran de jeu, interrogation, pouvoirs du complice (avec infobulles), carnet de déduction, archives, historique, discussion, écran de fin (solution, récit, indices décisifs, complice, pouvoirs utilisés, mains de chacun), « Rejouer ».
- Responsive (testé à 375 px de large sans défilement horizontal), zones privées distinguées par icône, texte et style (pas seulement par la couleur).
- Bots et simulations d'équilibrage ; 93 tests automatisés.

## 9. Limites connues

- **Équilibrage :** les simulations montrent un net avantage des enquêteurs, surtout à 4 et 6 joueurs. Les chiffres viennent de bots et ne remplacent pas des parties entre humains. Analyse et pistes de correction dans [docs/EQUILIBRAGE.md](docs/EQUILIBRAGE.md) — aucune règle validée n'a été modifiée.
- **Une seule affaire** (Manoir des Brumes). Le code est prêt pour en ajouter d'autres (données séparées dans `src/shared/data/`), mais il n'y a pas encore de sélecteur d'affaire.
- **Une seule instance de serveur :** l'état est en mémoire. Pour plusieurs instances, il faudrait un stockage partagé (Redis ou base de données).
- **Sur l'offre gratuite de Render**, un redémarrage ou une mise en veille efface les salons en cours (voir section 7).
- **Pas de comptes utilisateurs :** l'identité repose sur un jeton par salon gardé dans l'onglet. Fermer l'onglet puis revenir fonctionne via « Reprendre ma partie » sur le même navigateur, pas depuis un autre appareil.
- **Illustrations** simples (SVG dessinés à la main), sans ambition artistique poussée.
- **Pas de chat vocal** (non demandé) ; la discussion est écrite.
- Accessibilité : contrastes, focus clavier, libellés et tailles de texte soignés, mais aucun audit formel avec lecteur d'écran n'a été réalisé.

## 10. Documentation technique

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — choix techniques, organisation du code, modèle de sécurité, génération des affaires.
- [docs/EQUILIBRAGE.md](docs/EQUILIBRAGE.md) — méthode et résultats des simulations.
