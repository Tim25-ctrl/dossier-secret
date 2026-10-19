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
