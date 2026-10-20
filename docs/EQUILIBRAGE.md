# Équilibrage — résultats des simulations

Commande : `npm run simulate` (300 parties par taille de table ; `-- --parties 100` pour aller plus vite, `-- --variante 0` pour une seule variante).

## ⚠️ À lire avant les chiffres

Les simulations opposent des **bots**, pas des humains. Ils ne discutent pas, ne soupçonnent personne, ne bluffent qu'à travers les pouvoirs et n'oublient rien de ce qu'ils ont décidé de retenir. **Les pourcentages indiquent une tendance, pas des taux de victoire fiables.** Seules des parties entre humains permettront de conclure.

Deux profils encadrent le comportement humain :

| Profil | Ce que le bot exploite |
|---|---|
| **Expert** | Propagation logique complète (« Bob a montré une carte pour A/B/C, il n'a ni A ni B, donc il a C »), taille des mains, toutes les réponses. Borne haute, inatteignable pour un humain. |
| **Occasionnel** | Éliminations directes seulement : sa main, les pièces à conviction lues, les cartes qu'on lui montre, les indices lus. C'est ce que fait un joueur qui coche son carnet. |

Le complice-bot ment (60 % des cas utiles) quand l'hypothèse ne vise pas le meurtrier, falsifie toute hypothèse qui vise le vrai meurtrier, et n'accuse jamais. La colonne « sans pouvoirs » rejoue les mêmes parties avec un complice qui n'utilise jamais ses pouvoirs. Avec une hypothèse à 2 PA, les bots lisent les archives au lieu d'interroger environ un tour sur trois.

## Corrections appliquées (décision du 19/10/2026 — numérotation des pistes proposées initialement)

1. **Cartes restantes → pièces à conviction.** À 4 et 6 joueurs, les 3 cartes non distribuées ne sont plus posées face visible : elles sont rangées dans les archives (ouverture aux manches 2, 4 et 6) et se consultent pour 1 PA, en privé.
3. **Hypothèse à 2 PA.** À chaque tour : une hypothèse, OU deux consultations d'archives.
4. **Pouvoirs selon la taille de la table.** 3–4 joueurs : 2 mensonges, 1 falsification. 5–6 joueurs : 3 mensonges, 2 falsifications (jamais deux falsifications sur la même hypothèse).

Inchangé : 1 complice, 12 manches, 2 PA par tour, nombre de joueurs interrogés.

## Résultats (300 parties par taille)

**Enquêteurs gagnants (%) — bots experts / bots occasionnels**

| Joueurs | Règles initiales | Correction 1 seule | Correction 3 seule (2 PA) | Correction 4 seule (pouvoirs) | **Règles actuelles (1 + 3 + 4)** |
|---:|---:|---:|---:|---:|---:|
| 3 | 79 / 83 | 79 / 83 | 62 / 61 | 79 / 83 | **62 / 61** |
| 4 | 98 / 100 | 100 / 100 | 95 / 96 | 98 / 100 | **88 / 70** |
| 5 | 98 / 98 | 98 / 98 | 90 / 82 | 97 / 97 | **88 / 80** |
| 6 | 100 / 100 | 100 / 100 | 100 / 98 | 100 / 100 | **97 / 88** |

**Manche moyenne de fin — règles actuelles (expert / occasionnel)** : 3 joueurs 9,5 / 11,7 · 4 joueurs 10,7 / 11,7 · 5 joueurs 8,8 / 11,8 · 6 joueurs 9,9 / 11,7 (contre 4 à 11 avant).

Aucune action refusée par le moteur sur l'ensemble des simulations, et aucune violation d'invariant (voir `tests/parties-completes.test.ts`). À 3 et 5 joueurs, la correction 1 n'a aucun effet : il n'y a pas de carte restante.

## Lecture

- **L'hypothèse à 2 PA est le levier principal** : elle divise par deux le rythme d'interrogation. Seule, elle fait passer le complice de ~20 % à ~38 % de victoires à 3 joueurs.
- **Les trois corrections se renforcent** à 4, 5 et 6 joueurs : chacune seule y change peu, mais ensemble elles ramènent les enquêteurs « occasionnels » de 98–100 % à 70–88 %.
- **Le complice gagne désormais une partie sur 8 à une sur 3** selon la table et le niveau des joueurs. Les enquêteurs restent favoris, surtout à 6 joueurs (5 enquêteurs pour 1 complice).
- **Durée** : les parties vont presque toujours jusqu'aux manches 9 à 12. Avec 6 joueurs et des tours de 3 minutes, une partie peut dépasser 30 minutes : choisir une durée de tour courte (1 ou 2 minutes) pour les grandes tables.

## Pistes si l'avantage des enquêteurs reste trop net en vraie partie

- À 6 joueurs, passer à 4 mensonges (modifie `pouvoirs` dans `src/engine/config.ts`).
- Ouvrir les pièces à conviction plus tard (`ouverturePieces`).
- Réduire le nombre d'indices publics ou de dossiers d'archives.

Chaque piste se mesure en quelques minutes avec `npm run simulate`.

---

# Mode « Complice rusé » (par défaut depuis le 19/10/2026)

## Les règles du mode

Objectif : des pouvoirs **invisibles sur le moment**, mais qui laissent des **traces recoupables**, pour que le complice soit facile à jouer tout en restant démasquable.

| Élément | Règle |
|---|---|
| Réserve de ruses | 3 (3 joueurs), 4 (4 joueurs), 5 (5 ou 6 joueurs) |
| Mensonge — 1 ruse | Interrogé, répondre « aucune carte » alors qu'on en a une |
| Carte empruntée — 2 ruses | Interrogé, montrer une carte de l'hypothèse qu'on n'a pas (jamais celle du meurtrier). Le complice ignorant le lieu et l'arme, la carte peut faire partie de la solution |
| Hypothèse falsifiée — 1 ruse | Inchangée |
| Dossier trafiqué — 1 ruse | En lisant un dossier, le complice le remplace par un faux indice (toujours faux pour cette solution, présenté sous la même catégorie) pour tous les lecteurs suivants |
| Empreintes | Une ruse laisse une empreinte avec une probabilité de 35 % (3 j.), 50 % (4 j.), 60 % (5 j.), 70 % (6 j.). Publiée 1 ou 2 manches plus tard : « L'empreinte n'appartient pas à X » (toujours vraie, X tiré au hasard) |
| Dénonciation — 1 PA | Une fois par partie et par joueur. Juste : complice démasqué publiquement, ruses perdues. Fausse : le dénonciateur perd son prochain tour |

Le mode « Classique » (mensonges + falsifications, sans empreintes ni dénonciation) reste disponible dans le salon d'attente.

## Comment le complice peut être trouvé

- **Mensonge** : il montre plus tard une carte qu'il prétendait ne pas avoir.
- **Carte empruntée** : deux joueurs ont montré la même carte, ou la taille d'une main devient impossible, ou toutes les possibilités d'une catégorie sont éliminées.
- **Dossier trafiqué** : le faux indice finit par contredire les cartes et les autres indices ; l'historique dit qui avait ouvert ce dossier avant soi.
- **Empreintes** : chacune innocente un joueur ; recoupées, elles isolent le complice.

## Réglage par simulation (200 parties par taille)

Les bots enquêteurs utilisent les empreintes, dénoncent quand un seul suspect reste possible, et — comme un humain prudent — ne se méfient des informations d'un joueur qu'en cas de contradiction.

| Joueurs | Enquêteurs gagnent (expert / occasionnel) | Complice démasqué | Mode classique, pour comparaison (expert / occasionnel) |
|---:|---:|---:|---:|
| 3 | 53 % / 47 % | 72 % | 71 % / 59 % |
| 4 | 56 % / 65 % | 61 % | 88 % / 81 % |
| 5 | 74 % / 59 % | 57–61 % | 83 % / 79 % |
| 6 | 78 % / 71 % | 43–44 % | 98 % / 84 % |

Étapes du réglage (toutes mesurées) :
1. Première version (empreinte à chaque ruse, « assis à côté de X ») : complice démasqué dans ~100 % des parties → trop facile.
2. Empreintes « parmi A, B » : un joueur cité avec un seul autre identifiait aussitôt le complice → encore ~95 %.
3. Empreintes « n'appartient pas à X », probabilité selon la taille de table → 43 à 72 % : trouvable mais pas automatique.
4. Coûts : la carte empruntée passe à 2 ruses ; une 6ᵉ ruse à 6 joueurs n'aidait pas le complice (seulement plus d'empreintes) → non retenue.

Contribution mesurée de chaque ruse (bots occasionnels, 3/4/5/6 joueurs) : sans le **dossier trafiqué**, les enquêteurs gagnent environ 20 points de plus — c'est la ruse la plus forte ; la **carte empruntée** pèse peu dans ce modèle de bots.

Les enquêteurs restent favoris à 5 et 6 joueurs ; à 3 et 4 joueurs la partie est proche de l'équilibre. Comme toujours, ces chiffres viennent de bots : la discussion entre humains peut faire pencher la balance dans les deux sens.

---

# Indices relationnels (20/10/2026)

**Problème signalé en partie** : le dossier public écartait directement « Éléonore » alors qu'un joueur avait la carte Éléonore — sa carte ne servait plus à rien. C'est général : chaque indice du type « X n'est pas coupable » révèle à tous l'information d'une carte détenue par quelqu'un.

**Correction** : le dossier public et les archives ne contiennent plus que des **indices relationnels**, qui relient deux éléments sans en écarter aucun à eux seuls :
- « Si le docteur Morel est coupable, le crime a eu lieu dans la serre » ;
- « Le crime n'a pas eu lieu dans la cave avec le revolver ».

Ils ne deviennent décisifs qu'en les combinant avec les cartes des joueurs. 18 nouveaux indices relationnels ont été écrits (IND-37 à IND-54) ; 31 sont disponibles au total. Les 23 anciens indices « directs » restent dans la boîte mais ne sont plus tirés. Un test vérifie, sur 200 affaires, qu'aucun indice n'écarte seul un suspect, un lieu ou une arme. Les faux indices du « Dossier trafiqué » sont eux aussi relationnels, pour rester indiscernables.

La réserve de ruses à 3 joueurs passe de 3 à 2 pour compenser.

## Résultats (mode rusé, 200 parties par taille)

| Joueurs | Enquêteurs gagnent (expert / occasionnel) | Complice démasqué |
|---:|---:|---:|
| 3 | 67 % / 37 % | 59 % |
| 4 | 56 % / 47 % | 67 % |
| 5 | 70 % / 50 % | 52–56 % |
| 6 | 76 % / 50 % | 45–46 % |

Les bots « experts » (qui raisonnent sur les cartes) sont peu affectés ; les bots « occasionnels » trouvent un peu moins souvent, car les indices demandent désormais d'être combinés avec les cartes.

## Mise à jour : indices « pas X avec Y » uniquement (20/10/2026)

**Problème signalé** : un indice « Si Éléonore est coupable, le crime a eu lieu dans la bibliothèque » donne le lieu dès qu'on connaît le coupable.

**Correction** : seuls les indices « pas X avec Y » sont tirés (ex. « si le crime a eu lieu dans la cave, ce n'était pas avec le revolver »). Chacun n'écarte qu'une ou deux paires : il n'écarte jamais un élément seul et ne déduit jamais un élément d'un autre (test automatique sur 200 affaires). 23 indices de ce type sont rédigés ; 108 modèles de faux indices « pas X avec Y » (une par paire) servent uniquement à la ruse « Dossier trafiqué ».

**Effet mesuré (150–200 parties par taille, hypothèse à 2 PA conservée par décision du 20/10/2026)** :

| Joueurs | Enquêteurs gagnent (expert / occasionnel) | Sans pouvoirs du complice (expert / occasionnel) | Complice démasqué |
|---:|---:|---:|---:|
| 3 | 50 % / 22 % | 100 % / 36 % | 56 % |
| 4 | 48 % / 27 % | 96 % / 37 % | 65 % |
| 5 | 54 % / 19 % | 100 % / 31 % | 60–63 % |
| 6 | 58 % / 30 % | 100 % / 45 % | 48–49 % |

L'enquête est désormais **exigeante** : les indices ne valent que combinés aux cartes. Un joueur qui raisonne sur les mains des autres (profil expert) gagne environ une partie sur deux ; un joueur qui se contente de cocher ce qu'il voit gagne rarement.

Pistes testées si les parties s'avèrent trop dures en vrai : hypothèse à 1 PA (enquêteurs 60–80 %, testé mais non retenu), ou plus d'indices (peu d'effet : chaque indice « pas X avec Y » apporte peu).

## Mise à jour : témoignages partiels et journal d'Armand (20/10/2026)

**Ajout** : 13 nouveaux indices, tous construits uniquement avec des règles « pas X avec Y » (rien n'est écarté seul).

- **6 témoignages partiels** (IND-67 à IND-72) : une trace désigne deux coupables possibles pour un lieu ou une arme (« si le crime a eu lieu dans la serre, le coupable est Victor ou Gabriel »). Chacun équivaut à 4 règles « pas X avec Y ». C'est le seul type d'indice où connaître un élément ne laisse que **2** possibilités dans une autre catégorie (au lieu de 4 au moins) ; le test automatique a été adapté en conséquence, avec l'accord de l'auteur du jeu. Trois témoignages sont déclarés incompatibles avec une page ou un indice qui les contredirait narrativement (ex. la cendre de cigare de Victor dans la cave et la page du 12 octobre où Victor refuse d'y descendre).
- **7 pages du journal d'Armand** (IND-73 à IND-79), datées du 11 au 17 octobre : chacune raconte une dispute et écarte une paire. Elles s'affichent sur papier jauni. L'écran de fin montre toutes les pages vraies pour la solution, dans l'ordre, en signalant celles lues pendant la partie.
- **108 fausses pages du journal** (modèles) : un dossier « Journal d'Armand » trafiqué par le complice contient une page de journal fausse, datée de la même semaine, pour ne pas se trahir.

36 indices « pas X avec Y » sont désormais tirables (contre 23).

**Effet mesuré (200 parties par taille, réglages par défaut, mode rusé)** :

| Joueurs | Enquêteurs gagnent (expert / occasionnel) | Avant (expert / occasionnel) | Complice démasqué |
|---:|---:|---:|---:|
| 3 | 59 % / 29 % | 50 % / 22 % | 54 % |
| 4 | 47 % / 32 % | 48 % / 27 % | 63 % |
| 5 | 60 % / 29 % | 54 % / 19 % | 68 % |
| 6 | 64 % / 34 % | 58 % / 30 % | 47 % |

Les témoignages partiels rendent l'enquête un peu moins dure, surtout pour les joueurs « occasionnels », sans la rendre facile.

## Mise à jour : plus de dossier public (20/10/2026)

**Décision de l'auteur du jeu** : le dossier public est supprimé. Il n'y a plus d'indice gratuit au départ ni à la manche 6 (`nbIndicesPublicsDepart: 0`, `manchesIndicesPublics: []`) ; tous les indices sont dans les 6 dossiers d'archives (1 PA chacun, lus en secret). Le moteur sait toujours publier des indices si on le règle (les « règles initiales » des simulations historiques gardent 1 + 1 indice public). Le panneau « Dossier public » n'apparaît plus que s'il contient quelque chose (anciennes parties).

**Effet mesuré (200 parties par taille, réglages par défaut, mode rusé)** :

| Joueurs | Enquêteurs gagnent (expert / occasionnel) | Avec dossier public | Complice démasqué |
|---:|---:|---:|---:|
| 3 | 56 % / 26 % | 59 % / 29 % | 54 % |
| 4 | 39 % / 26 % | 47 % / 32 % | 62 % |
| 5 | 59 % / 19 % | 60 % / 29 % | 62 % |
| 6 | 66 % / 35 % | 64 % / 34 % | 40 % |

Les enquêteurs perdent quelques points, surtout à 4 joueurs et chez les joueurs « occasionnels ». Sur 200 parties, l'incertitude est d'environ ± 7 points : seules les baisses à 4 joueurs (expert) et à 5 joueurs (occasionnel) sont nettes. Si les parties deviennent trop dures, la piste la plus simple est d'ajouter un 7ᵉ dossier d'archives.

## Mise à jour : empreintes plus tardives, suspension au lieu de perte des ruses (20/10/2026)

**Problème signalé en partie** : l'empreinte arrivait dès la manche 2 et, à 3 joueurs, « n'appartient pas à X » désignait directement le complice (chaque enquêteur n'a que deux suspects).

**Corrections (validées par l'auteur du jeu)** :

- empreinte publiée **2 à 3 manches** après la ruse (au lieu de 1 à 2), et **jamais avant la manche 4** (`delaiEmpreinte`, `premiereMancheEmpreinte`) ;
- **à 3 joueurs, empreinte anonyme** : « le complice a rusé pendant la manche N », sans nommer personne (`empreinteAnonymeJusqua: 3`) ;
- probabilités un peu plus basses : 35 / 40 / 50 / 60 % (3 / 4 / 5 / 6 joueurs) ;
- complice démasqué : ses ruses sont **suspendues 3 manches** puis reviennent (`suspensionDemasque: 3`), **sans aucune perte de ruse** (choix de l'auteur) ; plus aucune empreinte après le démasquage.

**Effet mesuré, à code identique** (200 parties par taille ; « avant » = anciennes empreintes rejouées avec `npm run simulate -- --variante 7`) :

| Joueurs | Enquêteurs gagnent, expert (avant → après) | Occasionnel (avant → après) | Complice démasqué (avant → après) |
|---:|---:|---:|---:|
| 3 | 56 % → 62 % | 26 % → 26 % | 54 % → 0 % * |
| 4 | 46 % → 45 % | 28 % → 28 % | 62 % → 44 % |
| 5 | 59 % → 64 % | 19 % → 17 % | 62 % → 46 % |
| 6 | 74 % → 72 % | 42 % → 45 % | 40 % → 22 % |

\* Les bots ne savent pas exploiter l'empreinte anonyme (ils ne raisonnent que sur des noms) : à 3 joueurs, ils ne démasquent donc jamais le complice. Des joueurs humains qui recoupent les événements de la manche indiquée y parviendront parfois.

Le complice est nettement moins souvent démasqué, et les victoires restent dans la marge d'incertitude (± 7 points) : chez les bots, démasquer le complice change peu l'issue de l'enquête.

Remarque : depuis la renumérotation des archives par manche d'ouverture, les bots consultent les pièces à conviction plus tôt (ils ouvrent les dossiers dans l'ordre) ; c'est ce qui fait monter la colonne « sans pouvoirs » par rapport aux tableaux précédents, indépendamment des empreintes.
