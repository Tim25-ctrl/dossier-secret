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
