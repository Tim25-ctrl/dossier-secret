# Équilibrage — résultats des simulations

Commande : `npm run simulate` (300 parties par taille de table par défaut ; `-- --parties 100` pour aller plus vite, `-- --variante 0` pour une seule variante).

## ⚠️ À lire avant les chiffres

Les simulations opposent des **bots**, pas des humains. Ils ne discutent pas, ne soupçonnent personne, ne bluffent qu'à travers les pouvoirs, ne se trompent jamais en lisant un indice et n'oublient jamais rien de ce qu'ils ont décidé de retenir. **Les pourcentages ci-dessous indiquent une tendance ; ce ne sont pas des taux de victoire fiables pour de vraies parties.** Seules des parties tests entre humains permettront de conclure.

Trois profils encadrent le comportement humain :

| Profil | Ce que le bot exploite |
|---|---|
| **Expert** | Tout : propagation logique complète (« Bob a montré une carte pour A/B/C, il n'a ni A ni B, donc il a C »), taille des mains, réponses de toutes les interrogations. Borne haute, inatteignable pour un humain. |
| **Attentif** | Comme l'expert, mais ne retient qu'environ 35 % des réponses aux hypothèses des **autres** joueurs. |
| **Occasionnel** | Éliminations directes seulement : sa main, les cartes publiques, les cartes qu'on lui montre, les indices qu'il a lus. C'est ce que fait un joueur qui coche son carnet sans plus. |

Le complice-bot ment (60 % des cas utiles) quand l'hypothèse ne vise pas le meurtrier, falsifie toute hypothèse qui vise le vrai meurtrier, et ne fait jamais d'accusation. La colonne « sans pouvoirs » rejoue les mêmes parties avec un complice qui n'utilise jamais ses pouvoirs.

## Résultats (300 parties par taille, réglages par défaut)

Réglages par défaut : 1 indice public au départ, 6 dossiers d'archives (ouverts aux manches 1, 2, 3, 5, 7, 9), 1 indice public supplémentaire en manche 6, 1 hypothèse maximum par tour.

| Joueurs | Enquêteurs gagnent — expert | — occasionnel | Occasionnel sans pouvoirs | Manche moyenne de fin (expert / occasionnel) |
|---:|---:|---:|---:|---:|
| 3 | 79 % | 83 % | 94 % | 7,8 / 10,9 |
| 4 | 98 % | 100 % | 100 % | 5,2 / 8,1 |
| 5 | 98 % | 98 % | 98 % | 6,9 / 10,3 |
| 6 | 100 % | 100 % | 100 % | 4,3 / 8,2 |

Aucune action refusée par le moteur sur l'ensemble des simulations (les bots ne jouent que des coups légaux), et aucune violation d'invariant (voir `tests/parties-completes.test.ts`).

### Variantes testées (non retenues)

| Variante | Effet observé |
|---|---|
| **2 hypothèses par tour** | Parties beaucoup plus courtes (fin vers la manche 3–6), enquêteurs encore plus favorisés. → **Limite d'1 hypothèse par tour retenue.** |
| **Beaucoup d'indices** (2 publics + 8 dossiers + 2 différés) | Fin 1 à 1,5 manche plus tôt ; le complice perd l'essentiel de ses chances à 3 joueurs (occasionnel : 97 % pour les enquêteurs). |
| **Indices rares** (1 public + 5 dossiers étalés) | Parties plus longues (fin manche 9–11 en occasionnel), complice un peu plus fort à 3 et 5 joueurs (79 % et 93 %), aucun effet à 4 et 6 joueurs. |

Le réglage par défaut est un compromis : assez d'indices pour que l'enquête « documentaire » ait du sens, sans rendre l'affaire triviale.

## Diagnostic : déséquilibre en faveur des enquêteurs

Le déséquilibre est **manifeste**, même avec des bots occasionnels. Causes identifiées :

1. **Victoire collective.** Il suffit qu'*un seul* enquêteur trouve. Plus il y a d'enquêteurs, plus le complice doit tromper de monde à la fois. D'où les 100 % à 4 et 6 joueurs.
2. **Durée longue par rapport au flux d'informations.** En 12 manches, chaque enquêteur formule jusqu'à 12 hypothèses et lit les archives. Dès 4 joueurs (2 ou 3 interrogés), presque chaque hypothèse rapporte une carte.
3. **Cartes publiques à 4 et 6 joueurs.** Les 3 cartes restantes, visibles par tous, éliminent d'office 3 des 15 fausses pistes.
4. **Pouvoirs trop rares pour la longueur de la partie.** 2 mensonges + 1 falsification sur 20 à 50 hypothèses : leur effet est mesurable à 3 joueurs (−10 à −20 points pour les enquêteurs), presque nul au-delà.
5. **Ce que les simulations ne mesurent pas** : la discussion. Le complice humain peut accuser à tort, semer le doute dans le chat, contester une falsification, faire perdre du temps. C'est probablement là que se jouera l'équilibre réel.

## Corrections proposées (NON appliquées)

Les valeurs validées (1 complice, 2 mensonges, 1 falsification, 12 manches, 2 PA, nombre d'interrogés) n'ont pas été modifiées. Pistes à essayer en parties tests, par ordre d'impact attendu :

1. **Ne plus poser les cartes restantes face visible** à 4 et 6 joueurs, mais les verser dans les archives comme « pièces à conviction » à consulter (1 PA). Ne touche à aucune règle validée ; à tester en priorité.
2. **Mauvaise accusation = révélation d'une fausse piste ?** Non : contraire à la règle « aucune information supplémentaire ». À l'inverse, envisager qu'**une accusation ratée coûte la partie à toute l'équipe** au-delà de N échecs (rend l'accusation plus risquée). Modifie une règle : décision à prendre par vous.
3. **Hypothèse à 2 PA** (une hypothèse OU deux consultations par tour). Ralentit fortement le flux d'informations. Modifie le coût des actions : décision à prendre par vous.
4. **Pouvoirs proportionnels au nombre de joueurs** (par exemple 3 mensonges à 5–6 joueurs). Modifie des valeurs validées : décision à prendre par vous.

Tous ces paramètres sont centralisés dans `src/engine/config.ts`, et le script de simulation permet d'en mesurer l'effet en quelques minutes.
