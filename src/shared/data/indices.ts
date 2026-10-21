// Les cartes d'indice réutilisables de l'affaire du Manoir des Brumes.
//
// Chaque carte porte des RÈGLES logiques (ce qu'elle permet d'écarter) et,
// éventuellement, des FAITS chronologiques. Un fait qui couvre toute la fenêtre
// du crime (22 h 50 – 23 h 10) produit automatiquement une règle :
//   - la personne / l'arme était hors des six lieux possibles  -> elle est écartée ;
//   - elle était dans l'un des six lieux                       -> si elle est en cause,
//                                                                 le crime a eu lieu là.
// Le générateur ne retient une carte que si toutes ses règles sont vraies pour la
// solution tirée au sort : un indice ne peut donc jamais exclure la vraie solution.

import { elementsDe, type ArmeId, type CarteIndice, type LieuId, type RegleIndice, type SuspectId } from '../types';
import { genererFauxIndices, seulsSuspects as seulsSuspectsParmi } from './fauxIndices';
import { ARMES_FICHES, LIEUX_FICHES, PERSONNAGES } from './manoir';

const MANOIR = elementsDe('manoir');

/**
 * Témoignage partiel : « si le crime a eu lieu là (ou avec cette arme), le coupable est l'un de
 * ces deux suspects ». Traduit en une règle « pas X avec Y » pour chacun des quatre autres suspects :
 * l'indice n'écarte rien à lui seul et laisse toujours deux coupables possibles.
 */
function seulsSuspects(pivot: LieuId | ArmeId, suspects: SuspectId[]): RegleIndice[] {
  return seulsSuspectsParmi(MANOIR.suspects, pivot, suspects);
}

export const INDICES: CarteIndice[] = [
  {
    id: 'IND-01',
    titre: "L'appel au notaire",
    categorie: 'temoignage',
    texte:
      "Le central téléphonique du village a enregistré un appel passé depuis le téléphone du hall de 22 h 40 à 23 h 20. Maître Ferrand, le notaire, est formel : c'est Éléonore qui lui a parlé du testament pendant tout ce temps, sans interruption.",
    concerne: ['eleonore'],
    regles: [],
    faits: [{ entite: 'eleonore', endroit: 'hall', de: '22:40', a: '23:20' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-02',
    titre: 'La porte du petit salon',
    categorie: 'temoignage',
    texte:
      "À la demande de Victor, qui voulait travailler au calme, Marchand l'a enfermé à clé dans le petit salon à 22 h 30 et ne lui a rouvert qu'à 23 h 25. Les fenêtres sont barreaudées et la seule clé ne quitte jamais le trousseau du majordome.",
    concerne: ['victor', 'marchand'],
    regles: [],
    faits: [{ entite: 'victor', endroit: 'petit_salon', de: '22:30', a: '23:25' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-03',
    titre: 'Le registre de chauffe',
    categorie: 'horaire',
    texte:
      "La chaudière de la serre doit être réglée à la main toutes les quinze minutes. Le registre porte des relevés à 22 h 40, 22 h 55, 23 h 10 et 23 h 25, tous de l'écriture du docteur Morel, et chaque réglage a bien été effectué.",
    concerne: ['morel', 'serre'],
    regles: [],
    faits: [{ entite: 'morel', endroit: 'serre', de: '22:40', a: '23:25' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-04',
    titre: 'Le tableau des sonnettes',
    categorie: 'horaire',
    texte:
      "Le tableau des sonnettes de l'office garde la trace de chaque appel. Entre 22 h 45 et 23 h 15, Marchand a répondu à cinq sonneries venues de l'étage des chambres, à quelques minutes d'intervalle, sans jamais redescendre.",
    concerne: ['marchand'],
    regles: [],
    faits: [{ entite: 'marchand', endroit: 'chambres', de: '22:45', a: '23:15' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-05',
    titre: 'La fiche du grenier',
    categorie: 'document',
    texte:
      "Le registre de consultation des archives familiales, au grenier, est signé par Camille à 22 h 40 et à 23 h 15. L'escalier du grenier grince affreusement : personne ne l'a entendue descendre entre-temps, et la poussière couvre encore ses manches.",
    concerne: ['camille'],
    regles: [],
    faits: [{ entite: 'camille', endroit: 'grenier', de: '22:40', a: '23:15' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-06',
    titre: 'Le passeur du gué',
    categorie: 'deplacement',
    texte:
      "Le passeur du gué de la Brume, hors du domaine, a fait traverser Gabriel Roche à 22 h 35. À cause de la tempête, il l'a hébergé jusqu'au matin. Sa femme confirme que Gabriel n'a pas quitté la cuisine de la maisonnette.",
    concerne: ['gabriel'],
    regles: [],
    faits: [{ entite: 'gabriel', endroit: 'gue', de: '22:35', a: '23:59' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-07',
    titre: 'Le corps déplacé',
    categorie: 'trace',
    texte:
      "Le légiste est formel : le corps a été déplacé après la mort. La position des taches sur la peau ne correspond pas à celle dans laquelle Armand a été trouvé, et le tapis du bureau ne porte aucune trace de lutte. Le crime n'a pas été commis dans le bureau.",
    concerne: ['bureau'],
    regles: [{ type: 'pas', element: 'bureau' }],
    disponibleDesManche: 2,
  },
  {
    id: 'IND-08',
    titre: 'Le scellé de la cave',
    categorie: 'objet',
    texte:
      "Comme chaque soir, Marchand a posé un scellé de cire sur la porte de la cave à 21 h. Il était intact à minuit, et le soupirail est fermé par des barreaux rouillés que personne n'a pu écarter. Personne n'est entré dans la cave ce soir-là.",
    concerne: ['cave', 'marchand'],
    regles: [{ type: 'pas', element: 'cave' }],
    incompatibleAvec: ['IND-14', 'IND-18'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-09',
    titre: 'Le sable ratissé',
    categorie: 'trace',
    texte:
      "Les allées de la serre sont ratissées chaque soir. À 23 h 25, le sable était parfaitement lisse : seule une ligne de pas mène de la porte à la chaudière. Aucune lutte, aucun corps traîné : le crime n'a pas eu lieu dans la serre.",
    concerne: ['serre'],
    regles: [{ type: 'pas', element: 'serre' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-10',
    titre: 'La table du petit-déjeuner',
    categorie: 'temoignage',
    texte:
      "Marchand a dressé seul la table du petit-déjeuner dans la salle à manger de 22 h 45 à 23 h 15 : les bougies neuves allumées à 22 h 45 ont été soufflées à 23 h 15, et la table est dressée à la perfection. Si un crime a eu lieu dans cette pièce, il n'a pas pu échapper au majordome.",
    concerne: ['marchand', 'salle_a_manger'],
    regles: [{ type: 'siAlors', si: 'salle_a_manger', alors: 'marchand' }],
    faits: [{ entite: 'marchand', endroit: 'salle_a_manger', de: '22:45', a: '23:15' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-11',
    titre: 'La poussière du salon de musique',
    categorie: 'trace',
    texte:
      "Le salon de musique est fermé pour la saison. Les housses blanches recouvrent les meubles et une fine couche de poussière, parfaitement intacte, couvre tout le parquet. Personne n'y a mis les pieds depuis des jours.",
    concerne: ['salon_musique'],
    regles: [{ type: 'pas', element: 'salon_musique' }],
    incompatibleAvec: ['IND-17'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-12',
    titre: 'Les volets de la bibliothèque',
    categorie: 'contradiction',
    texte:
      "Éléonore affirme avoir passé la soirée à la bibliothèque. Pourtant, la porte et les volets intérieurs de la bibliothèque sont verrouillés depuis 22 h à cause de la tempête, la clé est restée au tableau de Marchand et la poussière du verrou n'a pas été dérangée. Personne n'y est entré : son récit est faux, et la bibliothèque est hors de cause.",
    concerne: ['bibliotheque', 'eleonore'],
    regles: [{ type: 'pas', element: 'bibliotheque' }],
    incompatibleAvec: ['IND-13'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-13',
    titre: 'La lampe de la bibliothèque',
    categorie: 'deplacement',
    texte:
      "La lampe à pétrole de la bibliothèque a brûlé de 22 h 45 à 23 h 15, exactement le temps d'un réservoir. Le châle et les lunettes d'Éléonore étaient posés à côté, sur le testament annoté de sa main : elle n'a pas quitté la pièce pendant ce temps.",
    concerne: ['eleonore', 'bibliotheque'],
    regles: [],
    faits: [{ entite: 'eleonore', endroit: 'bibliotheque', de: '22:45', a: '23:15' }],
    incompatibleAvec: ['IND-12'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-14',
    titre: 'Le cigare de Victor',
    categorie: 'contradiction',
    texte:
      "Victor dit avoir travaillé dans le petit salon. Mais son cigare, consumé régulièrement de 22 h 40 à 23 h 20, a été retrouvé dans un cendrier de la cave, à côté d'un inventaire des grands crus rédigé de sa main pendant cette période.",
    concerne: ['victor', 'cave'],
    regles: [],
    faits: [{ entite: 'victor', endroit: 'cave', de: '22:40', a: '23:20' }],
    incompatibleAvec: ['IND-08'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-15',
    titre: "La radiographie du docteur",
    categorie: 'document',
    texte:
      "Une radiographie datée de la veille montre que le docteur Morel souffre d'une épaule luxée. Son bras est immobilisé : il est incapable de soulever un objet lourd comme le chandelier en bronze ou le presse-papier.",
    concerne: ['morel', 'chandelier', 'presse_papier'],
    regles: [
      { type: 'pasEnsemble', a: 'morel', b: 'chandelier' },
      { type: 'pasEnsemble', a: 'morel', b: 'presse_papier' },
    ],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-16',
    titre: "L'argenterie de minuit",
    categorie: 'deplacement',
    texte:
      "Marchand a poli toute l'argenterie dans la cuisine de 22 h 30 à 23 h 15. Les quatre-vingts couverts sont alignés, encore tièdes du chiffon, et le produit à polir tache ses gants : un tel travail ne laisse pas une minute de répit.",
    concerne: ['marchand'],
    regles: [],
    faits: [{ entite: 'marchand', endroit: 'cuisine', de: '22:30', a: '23:15' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-17',
    titre: 'Les photographies de Camille',
    categorie: 'contradiction',
    texte:
      "Camille prétend avoir consulté les archives au grenier. Or son appareil a pris une série de clichés numérotés, un toutes les cinq minutes de 22 h 50 à 23 h 10, depuis la fenêtre du salon de musique, où elle guettait quelque chose dans le parc.",
    concerne: ['camille', 'salon_musique'],
    regles: [],
    faits: [{ entite: 'camille', endroit: 'salon_musique', de: '22:50', a: '23:10' }],
    incompatibleAvec: ['IND-11'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-18',
    titre: 'La bougie de Gabriel',
    categorie: 'contradiction',
    texte:
      "Gabriel jure être parti avant le drame. Pourtant, il est revenu par le soupirail de la cave à 22 h 45 et s'y est caché jusqu'à 23 h 20 : la bougie retrouvée a brûlé exactement trente-cinq minutes et porte ses empreintes. Confronté, il l'admet.",
    concerne: ['gabriel', 'cave'],
    regles: [],
    faits: [{ entite: 'gabriel', endroit: 'cave', de: '22:45', a: '23:20' }],
    incompatibleAvec: ['IND-08'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-19',
    titre: 'Le chandelier intact',
    categorie: 'objet',
    texte:
      "Sur la cheminée de la salle à manger, la cire coulée du chandelier en bronze forme une croûte continue qui le soude à son socle. Elle n'a pas été brisée : le chandelier n'a pas été déplacé de la soirée.",
    concerne: ['chandelier'],
    regles: [{ type: 'pas', element: 'chandelier' }],
    faits: [{ entite: 'chandelier', endroit: 'salle_a_manger', de: '20:00', a: '23:59' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-20',
    titre: 'Le revolver grippé',
    categorie: 'objet',
    texte:
      "Le revolver ancien est grippé par la rouille : son barillet ne tourne plus et sa crosse est couverte d'une poussière que personne n'a essuyée. Il n'a pas servi.",
    concerne: ['revolver'],
    regles: [{ type: 'pas', element: 'revolver' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-21',
    titre: "Le rapport d'autopsie",
    categorie: 'document',
    texte:
      "Le rapport complet d'autopsie est arrivé : aucune plaie par lame. Ni le coupe-papier en argent, ni la dague de collection n'ont pu causer la mort.",
    concerne: ['coupe_papier', 'dague'],
    regles: [
      { type: 'pas', element: 'coupe_papier' },
      { type: 'pas', element: 'dague' },
    ],
    disponibleDesManche: 4,
  },
  {
    id: 'IND-22',
    titre: "L'analyse du laboratoire",
    categorie: 'document',
    texte:
      "Le laboratoire de Rouen rend ses conclusions : rien d'anormal dans le verre d'Armand ni dans les échantillons prélevés. La fiole n'a joué aucun rôle dans sa mort.",
    concerne: ['poison'],
    regles: [{ type: 'pas', element: 'poison' }],
    disponibleDesManche: 6,
  },
  {
    id: 'IND-23',
    titre: "L'aveu du majordome",
    categorie: 'temoignage',
    texte:
      "Marchand avoue enfin l'objet déplacé : à 22 h 20, après un bruit sourd, il a ramassé le presse-papier sur le tapis du bureau et l'a enfermé dans la vitrine du hall. La vitrine est restée verrouillée jusqu'au matin, et il en a l'unique clé.",
    concerne: ['presse_papier', 'marchand'],
    regles: [],
    faits: [{ entite: 'presse_papier', endroit: 'vitrine', de: '22:20', a: '23:59' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-24',
    titre: 'La cire de la serre',
    categorie: 'trace',
    texte:
      "Le chandelier en bronze a été retrouvé dans la serre, au pied des fougères. Ses bougies, allumées vers 22 h 40, ont coulé en une seule flaque de cire jusqu'à 23 h 30 : il n'a pas bougé de là pendant tout ce temps.",
    concerne: ['chandelier', 'serre'],
    regles: [],
    faits: [{ entite: 'chandelier', endroit: 'serre', de: '22:40', a: '23:30' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-25',
    titre: 'Le coupe-papier pris dans la cire',
    categorie: 'objet',
    texte:
      "Dans le bureau, une bougie renversée vers 22 h 45 a coulé sur le coupe-papier en argent. La cire, d'un seul bloc et jamais rompue, le retenait encore au sous-main à minuit.",
    concerne: ['coupe_papier', 'bureau'],
    regles: [],
    faits: [{ entite: 'coupe_papier', endroit: 'bureau', de: '22:45', a: '23:59' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-26',
    titre: "La toile d'araignée",
    categorie: 'trace',
    texte:
      "Sur la panoplie du salon de musique, une toile d'araignée est tendue entre la garde de la dague de collection et son crochet. Elle est intacte : la dague n'a pas été décrochée.",
    concerne: ['dague'],
    regles: [{ type: 'pas', element: 'dague' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-27',
    titre: 'La fiole scellée',
    categorie: 'objet',
    texte:
      "Dans le cabinet de curiosités, la fiole est toujours fermée par son cachet de cire d'origine, au sceau du collectionneur. Le cachet n'a jamais été brisé.",
    concerne: ['poison'],
    regles: [{ type: 'pas', element: 'poison' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-28',
    titre: 'Le premier constat du légiste',
    categorie: 'document',
    texte:
      "Le légiste a relevé une blessure fine et nette, faite par une lame. L'arme du crime est donc le coupe-papier en argent ou la dague de collection.",
    concerne: ['coupe_papier', 'dague'],
    regles: [{ type: 'parmi', elements: ['coupe_papier', 'dague'] }],
    disponibleDesManche: 4,
  },
  {
    id: 'IND-29',
    titre: 'Le choc à la tempe',
    categorie: 'document',
    texte:
      "Le légiste note un choc violent à la tempe, porté avec un objet lourd. Seuls le chandelier en bronze, le presse-papier ou la crosse du revolver ancien ont pu produire une telle blessure.",
    concerne: ['chandelier', 'presse_papier', 'revolver'],
    regles: [{ type: 'parmi', elements: ['chandelier', 'presse_papier', 'revolver'] }],
    disponibleDesManche: 4,
  },
  {
    id: 'IND-30',
    titre: 'Le silence de la cave',
    categorie: 'temoignage',
    texte:
      "Les voûtes de la cave résonnent comme une cloche : le moindre choc métallique y est entendu jusqu'au grenier. Personne n'a rien entendu de tel. Si le crime a eu lieu dans la cave, ce n'était pas avec le revolver ancien.",
    concerne: ['cave', 'revolver'],
    regles: [{ type: 'pasEnsemble', a: 'revolver', b: 'cave' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-31',
    titre: 'Le plafond de verre',
    categorie: 'trace',
    texte:
      "Le plafond de la serre est si bas qu'un objet long et lourd brandi à bout de bras aurait brisé les vitres. Toutes les vitres sont intactes : si le crime a eu lieu dans la serre, ce n'était pas avec le chandelier.",
    concerne: ['serre', 'chandelier'],
    regles: [{ type: 'pasEnsemble', a: 'chandelier', b: 'serre' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-32',
    titre: 'Les partitions immaculées',
    categorie: 'trace',
    texte:
      "Les partitions posées sur le piano du salon de musique sont d'une blancheur parfaite. Une lame aurait laissé des projections : si le crime a eu lieu dans le salon de musique, ce n'était ni avec la dague, ni avec le coupe-papier.",
    concerne: ['salon_musique', 'dague', 'coupe_papier'],
    regles: [
      { type: 'pasEnsemble', a: 'salon_musique', b: 'dague' },
      { type: 'pasEnsemble', a: 'salon_musique', b: 'coupe_papier' },
    ],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-33',
    titre: 'Le bras en écharpe',
    categorie: 'document',
    texte:
      "Un certificat du dispensaire atteste que Gabriel s'est fracturé le poignet droit la semaine dernière. Son bras est en écharpe : il ne peut pas manier un objet lourd comme le chandelier ou le presse-papier.",
    concerne: ['gabriel', 'chandelier', 'presse_papier'],
    regles: [
      { type: 'pasEnsemble', a: 'gabriel', b: 'chandelier' },
      { type: 'pasEnsemble', a: 'gabriel', b: 'presse_papier' },
    ],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-34',
    titre: 'La traînée sur le parquet',
    categorie: 'trace',
    texte:
      "Une légère traînée sur le parquet ciré montre que le corps a été transporté depuis l'aile ouest, où se trouvent la bibliothèque, le salon de musique et la salle à manger. Le crime a été commis dans l'une de ces trois pièces.",
    concerne: ['bibliotheque', 'salon_musique', 'salle_a_manger'],
    regles: [{ type: 'parmi', elements: ['bibliotheque', 'salon_musique', 'salle_a_manger'] }],
    disponibleDesManche: 3,
  },
  {
    id: 'IND-35',
    titre: 'La terre des semelles',
    categorie: 'trace',
    texte:
      "Les semelles de la victime portent de la terre humide et des brins de fougère. Armand se trouvait dans la serre ou dans la cave au moment de sa mort.",
    concerne: ['serre', 'cave'],
    regles: [{ type: 'parmi', elements: ['serre', 'cave'] }],
    disponibleDesManche: 3,
  },
  {
    id: 'IND-36',
    titre: 'Le revolver montré à Victor',
    categorie: 'horaire',
    texte:
      "Le revolver ancien a été sorti de la vitrine de la galerie à 22 h 30 pour être montré à Victor, qui l'a examiné dans le petit salon jusqu'à 23 h 20 sans en sortir, une loupe à la main ; Marchand l'a ensuite raccroché.",
    concerne: ['revolver', 'victor'],
    regles: [],
    faits: [
      { entite: 'revolver', endroit: 'petit_salon', de: '22:30', a: '23:20' },
      { entite: 'victor', endroit: 'petit_salon', de: '22:30', a: '23:20' },
    ],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-37',
    titre: 'Les catalogues de vente',
    categorie: 'deplacement',
    texte:
      "Victor a passé la soirée dans la bibliothèque à annoter les catalogues de vente d'Armand : ses notes, datées à la minute près, s'enchaînent sans interruption de 22 h 40 à 23 h 20.",
    concerne: ['victor', 'bibliotheque'],
    regles: [],
    faits: [{ entite: 'victor', endroit: 'bibliotheque', de: '22:40', a: '23:20' }],
    incompatibleAvec: ['IND-12'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-38',
    titre: 'La chaudière de la cave',
    categorie: 'temoignage',
    texte:
      "Marchand est descendu à la cave à 22 h 45 pour relancer la vieille chaudière, et n'en est remonté qu'à 23 h 15 : le registre d'entretien porte ses relevés de pression toutes les cinq minutes.",
    concerne: ['marchand', 'cave'],
    regles: [],
    faits: [{ entite: 'marchand', endroit: 'cave', de: '22:45', a: '23:15' }],
    incompatibleAvec: ['IND-08'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-39',
    titre: 'La machine à écrire',
    categorie: 'horaire',
    texte:
      "Camille a tapé son article sur la machine à écrire du bureau de 22 h 40 à 23 h 15 : chaque feuillet est daté, et le cliquetis de la machine n'a jamais cessé plus de quelques minutes.",
    concerne: ['camille', 'bureau'],
    regles: [],
    faits: [{ entite: 'camille', endroit: 'bureau', de: '22:40', a: '23:15' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-40',
    titre: 'Les cigarettes au filtre doré',
    categorie: 'trace',
    texte:
      "Le cendrier de la salle à manger déborde des cigarettes au filtre doré que seul Gabriel fume. Elles ont été allumées une à une, toutes les cinq minutes environ, de 22 h 45 à 23 h 15.",
    concerne: ['gabriel', 'salle_a_manger'],
    regles: [],
    faits: [{ entite: 'gabriel', endroit: 'salle_a_manger', de: '22:45', a: '23:15' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-41',
    titre: 'La sonate interrompue',
    categorie: 'temoignage',
    texte:
      "De 22 h 45 à 23 h 15, le docteur Morel a joué du piano au salon de musique : on entendait la même sonate, reprise sans relâche, dans tout le rez-de-chaussée.",
    concerne: ['morel', 'salon_musique'],
    regles: [],
    faits: [{ entite: 'morel', endroit: 'salon_musique', de: '22:45', a: '23:15' }],
    incompatibleAvec: ['IND-11'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-42',
    titre: 'Les mégots du ficus',
    categorie: 'trace',
    texte:
      "Éléonore s'est réfugiée dans la serre pour fumer en cachette : ses mégots tachés de rouge à lèvres s'accumulent dans le pot du ficus, à intervalles réguliers, de 22 h 40 à 23 h 20.",
    concerne: ['eleonore', 'serre'],
    regles: [],
    faits: [{ entite: 'eleonore', endroit: 'serre', de: '22:40', a: '23:20' }],
    incompatibleAvec: ['IND-09'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-43',
    titre: 'La dague sur le piano',
    categorie: 'objet',
    texte:
      "La dague de collection a été décrochée vers 22 h 40 et posée sur le piano du salon de musique, où on l'a retrouvée à 23 h 20 : la fine poussière autour d'elle montre qu'elle n'a pas bougé entre-temps.",
    concerne: ['dague', 'salon_musique'],
    regles: [],
    faits: [{ entite: 'dague', endroit: 'salon_musique', de: '22:40', a: '23:20' }],
    incompatibleAvec: ['IND-26', 'IND-11'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-44',
    titre: 'Le ruban de soie',
    categorie: 'objet',
    texte:
      "Sorti de sa vitrine pour être expertisé, le revolver ancien reposait sur la grande table de la bibliothèque. Le ruban de soie posé dessus à 22 h 30 n'avait pas glissé d'un millimètre à 23 h 30.",
    concerne: ['revolver', 'bibliotheque'],
    regles: [],
    faits: [{ entite: 'revolver', endroit: 'bibliotheque', de: '22:30', a: '23:30' }],
    incompatibleAvec: ['IND-12'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-45',
    titre: 'La fiole sur la desserte',
    categorie: 'trace',
    texte:
      "La fiole du cabinet de curiosités a été retrouvée sur la desserte de la salle à manger. Le cercle de poussière sous elle prouve qu'elle y a été posée vers 22 h 30 et n'en a pas bougé avant 23 h 30.",
    concerne: ['poison', 'salle_a_manger'],
    regles: [],
    faits: [{ entite: 'poison', endroit: 'salle_a_manger', de: '22:30', a: '23:30' }],
    incompatibleAvec: ['IND-27'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-46',
    titre: 'La lettre sous le presse-papier',
    categorie: 'objet',
    texte:
      "Toute la soirée, le presse-papier en cristal a maintenu une lettre ouverte sur le bureau d'Armand : la trace d'humidité qu'il a laissée sur le papier prouve qu'il n'a pas été déplacé avant minuit.",
    concerne: ['presse_papier', 'bureau'],
    regles: [],
    faits: [{ entite: 'presse_papier', endroit: 'bureau', de: '20:00', a: '23:59' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-47',
    titre: "L'allergie de Victor",
    categorie: 'document',
    texte:
      "Un certificat médical atteste que Victor fait une violente réaction au contact de l'argent massif, et ses gants sont restés au vestiaire toute la soirée. S'il est le coupable, il n'a pas utilisé le coupe-papier en argent.",
    concerne: ['victor', 'coupe_papier'],
    regles: [{ type: 'pasEnsemble', a: 'victor', b: 'coupe_papier' }],
    disponibleDesManche: 2,
  },
  {
    id: 'IND-48',
    titre: 'Le compteur de la cave',
    categorie: 'trace',
    texte:
      "Le compteur électrique de la cave a sauté à 22 h 30 et n'a été relevé qu'au matin. Dans le noir complet, impossible d'y manier une petite fiole ou de viser avec un revolver : si le crime a eu lieu dans la cave, ce n'était avec aucun des deux.",
    concerne: ['cave', 'poison', 'revolver'],
    regles: [
      { type: 'pasEnsemble', a: 'cave', b: 'poison' },
      { type: 'pasEnsemble', a: 'cave', b: 'revolver' },
    ],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-49',
    titre: 'Le pansement de Camille',
    categorie: 'document',
    texte:
      "À 21 h, le docteur Morel a bandé la main de Camille, entaillée en ouvrant une malle du grenier. Elle ne peut plus serrer un manche : si elle est la coupable, elle n'a utilisé ni la dague ni le coupe-papier.",
    concerne: ['camille', 'dague', 'coupe_papier'],
    regles: [
      { type: 'pasEnsemble', a: 'camille', b: 'dague' },
      { type: 'pasEnsemble', a: 'camille', b: 'coupe_papier' },
    ],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-50',
    titre: 'Les mains du majordome',
    categorie: 'document',
    texte:
      "Le médecin du village le confirme : Marchand souffre d'un tremblement qui l'empêche d'ouvrir une petite fiole scellée sans en renverser le contenu. S'il est le coupable, il n'a pas utilisé la fiole.",
    concerne: ['marchand', 'poison'],
    regles: [{ type: 'pasEnsemble', a: 'marchand', b: 'poison' }],
    disponibleDesManche: 3,
  },
  {
    id: 'IND-51',
    titre: "L'odeur de la bibliothèque",
    categorie: 'trace',
    texte:
      "Les vieux papiers de la bibliothèque gardent les odeurs pendant des jours. Aucune odeur de poudre n'y a été relevée : si le crime a eu lieu dans la bibliothèque, ce n'était pas avec le revolver.",
    concerne: ['bibliotheque', 'revolver'],
    regles: [{ type: 'pasEnsemble', a: 'bibliotheque', b: 'revolver' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-52',
    titre: 'Le dallage de verre',
    categorie: 'trace',
    texte:
      "Le sol de la serre est un dallage de verre épais mais fragile : un objet lourd tombé à terre l'aurait fendu. Aucune fissure : si le crime a eu lieu dans la serre, ce n'était pas avec le presse-papier.",
    concerne: ['serre', 'presse_papier'],
    regles: [{ type: 'pasEnsemble', a: 'serre', b: 'presse_papier' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-53',
    titre: 'La clé du salon de musique',
    categorie: 'contradiction',
    texte:
      "Camille jure n'avoir jamais mis les pieds au salon de musique. Pourtant, la seule clé de cette pièce, fermée pour la saison, était dans son sac. Si le crime a eu lieu dans le salon de musique, c'est Camille qui l'a commis.",
    concerne: ['salon_musique', 'camille'],
    regles: [{ type: 'siAlors', si: 'salon_musique', alors: 'camille' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-54',
    titre: 'Le trousseau unique',
    categorie: 'contradiction',
    texte:
      "Marchand affirme que la cave est restée fermée. Mais lui seul en possède la clé, et la serrure n'a pas été forcée : si le crime a eu lieu dans la cave, personne d'autre que le majordome n'a pu le commettre.",
    concerne: ['cave', 'marchand'],
    regles: [{ type: 'siAlors', si: 'cave', alors: 'marchand' }],
    incompatibleAvec: ['IND-14', 'IND-18'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-55',
    titre: 'La peur des caves',
    categorie: 'document',
    texte:
      "Un certificat du médecin de famille l'atteste : Éléonore souffre de claustrophobie depuis l'enfance et n'est jamais descendue à la cave. Si elle est la coupable, le crime n'a pas eu lieu dans la cave.",
    concerne: ['eleonore', 'cave'],
    regles: [{ type: 'pasEnsemble', a: 'eleonore', b: 'cave' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-56',
    titre: 'Le rhume des foins',
    categorie: 'temoignage',
    texte:
      "Victor souffre d'un rhume des foins si violent que la moindre fougère le fait éternuer à grand bruit. Personne n'a entendu le moindre éternuement du côté de la serre : si Victor est le coupable, ce n'est pas dans la serre.",
    concerne: ['victor', 'serre'],
    regles: [{ type: 'pasEnsemble', a: 'victor', b: 'serre' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-57',
    titre: 'La poussière des grimoires',
    categorie: 'document',
    texte:
      "Le docteur Morel est gravement allergique à la poussière des vieux livres : il ne peut rester plus d'une minute dans la bibliothèque sans suffoquer. S'il est le coupable, le crime n'a pas eu lieu dans la bibliothèque.",
    concerne: ['morel', 'bibliotheque'],
    regles: [{ type: 'pasEnsemble', a: 'morel', b: 'bibliotheque' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-58',
    titre: 'Les chaussures cloutées',
    categorie: 'trace',
    texte:
      "Les chaussures cloutées de Marchand marquent le parquet ciré à chaque pas. Celui du salon de musique ne porte aucune de ces marques : si le majordome est le coupable, ce n'est pas dans le salon de musique.",
    concerne: ['marchand', 'salon_musique'],
    regles: [{ type: 'pasEnsemble', a: 'marchand', b: 'salon_musique' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-59',
    titre: "L'urticaire de Camille",
    categorie: 'document',
    texte:
      "La veille, Camille a fait une crise d'urticaire spectaculaire après avoir traversé la serre, à cause du pollen. Ce soir, sa peau est intacte : si elle est la coupable, le crime n'a pas eu lieu dans la serre.",
    concerne: ['camille', 'serre'],
    regles: [{ type: 'pasEnsemble', a: 'camille', b: 'serre' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-60',
    titre: 'La serrure changée',
    categorie: 'objet',
    texte:
      "Depuis leur brouille, Armand avait fait changer la serrure du bureau, et Gabriel ignore tout du nouveau mécanisme à combinaison. Si Gabriel est le coupable, ce n'est pas dans le bureau.",
    concerne: ['gabriel', 'bureau'],
    regles: [{ type: 'pasEnsemble', a: 'gabriel', b: 'bureau' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-61',
    titre: 'Les étagères basses',
    categorie: 'trace',
    texte:
      "Entre les étagères basses de la serre, une lame aussi longue que la dague de collection n'aurait pas pu être brandie sans renverser les pots. Aucun pot n'a bougé : si le crime a eu lieu dans la serre, ce n'était pas avec la dague.",
    concerne: ['serre', 'dague'],
    regles: [{ type: 'pasEnsemble', a: 'serre', b: 'dague' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-62',
    titre: 'Le régime du docteur',
    categorie: 'temoignage',
    texte:
      "Sur ordre de son médecin, Armand ne buvait plus rien dans son bureau, et aucun verre ni aucune tasse n'y a été retrouvé. Si le crime a eu lieu dans le bureau, ce n'était pas avec la fiole.",
    concerne: ['bureau', 'poison'],
    regles: [{ type: 'pasEnsemble', a: 'bureau', b: 'poison' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-63',
    titre: "Le règlement de 1921",
    categorie: 'document',
    texte:
      "Depuis le petit incendie de 1921, aucune flamme n'entre dans la bibliothèque : le règlement est encadré à l'entrée, et il n'y a pas la moindre goutte de cire au sol. Si le crime a eu lieu dans la bibliothèque, ce n'était pas avec le chandelier.",
    concerne: ['bibliotheque', 'chandelier'],
    regles: [{ type: 'pasEnsemble', a: 'bibliotheque', b: 'chandelier' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-64',
    titre: "L'argent qui noircit",
    categorie: 'objet',
    texte:
      "Dans l'humidité de la cave, l'argent noircit en quelques minutes. Le coupe-papier est resté parfaitement brillant : si le crime a eu lieu dans la cave, ce n'était pas avec le coupe-papier.",
    concerne: ['cave', 'coupe_papier'],
    regles: [{ type: 'pasEnsemble', a: 'cave', b: 'coupe_papier' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-65',
    titre: 'La vue du sang',
    categorie: 'temoignage',
    texte:
      "Éléonore s'est évanouie la semaine dernière à la simple vue d'une coupure au doigt : tout le manoir en parle encore. Si elle est la coupable, elle n'a pas utilisé la dague.",
    concerne: ['eleonore', 'dague'],
    regles: [{ type: 'pasEnsemble', a: 'eleonore', b: 'dague' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-66',
    titre: 'Le mécanisme du revolver',
    categorie: 'document',
    texte:
      "Le revolver ancien possède un mécanisme de sûreté que seul un connaisseur sait débloquer. Marchand n'a jamais tenu une arme de sa vie, son livret militaire l'atteste : s'il est le coupable, ce n'est pas avec le revolver.",
    concerne: ['marchand', 'revolver'],
    regles: [{ type: 'pasEnsemble', a: 'marchand', b: 'revolver' }],
    disponibleDesManche: 1,
  },

  // --- Témoignages partiels : une trace qui désigne deux coupables possibles pour un lieu ou une arme ---
  {
    id: 'IND-67',
    titre: "L'empreinte de la serre",
    categorie: 'trace',
    texte:
      "Dans la terre meuble de la serre, les policiers ont relevé une empreinte toute fraîche de chaussure d'homme, pointure 42, au talon usé du côté gauche. Seuls deux hommes du manoir chaussent du 42 : Victor Delorme et Gabriel Roche. Si le crime a eu lieu dans la serre, le coupable est l'un des deux.",
    concerne: ['serre', 'victor', 'gabriel'],
    regles: seulsSuspects('serre', ['victor', 'gabriel']),
    incompatibleAvec: ['IND-56'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-68',
    titre: 'Le parfum de violette',
    categorie: 'trace',
    texte:
      "Une odeur de violette flottait encore dans la bibliothèque à minuit. Ce parfum, un flacon rare acheté à Paris, n'est porté que par deux personnes au manoir : Éléonore et Camille. Si le crime a eu lieu dans la bibliothèque, la coupable est l'une des deux.",
    concerne: ['bibliotheque', 'eleonore', 'camille'],
    regles: seulsSuspects('bibliotheque', ['eleonore', 'camille']),
    disponibleDesManche: 1,
  },
  {
    id: 'IND-69',
    titre: 'Le gant oublié',
    categorie: 'objet',
    texte:
      "Au pied du chandelier en bronze, on a retrouvé un gant d'homme en cuir fin, taille 9. Deux hommes seulement portent des gants de cette taille : Victor et le docteur Morel. Si l'arme est le chandelier, le coupable est l'un des deux.",
    concerne: ['chandelier', 'victor', 'morel'],
    regles: seulsSuspects('chandelier', ['victor', 'morel']),
    disponibleDesManche: 1,
  },
  {
    id: 'IND-70',
    titre: 'La cendre de cigare',
    categorie: 'trace',
    texte:
      "Sur une marche de l'escalier de la cave, une cendre de cigare cubain encore fraîche. Au manoir, seuls Victor et Gabriel fument ces cigares : Victor en a offert une boîte à Gabriel le soir de son arrivée. Si le crime a eu lieu dans la cave, le coupable est l'un des deux.",
    concerne: ['cave', 'victor', 'gabriel'],
    regles: seulsSuspects('cave', ['victor', 'gabriel']),
    incompatibleAvec: ['IND-74'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-71',
    titre: 'Le bouton arraché',
    categorie: 'objet',
    texte:
      "Sous la panoplie du salon de musique, juste à l'endroit où pendait la dague, un bouton de gilet en nacre a été arraché. Deux gilets du manoir portent ces boutons : celui de Marchand et celui du docteur Morel. Si l'arme est la dague, le coupable est l'un des deux.",
    concerne: ['dague', 'marchand', 'morel'],
    regles: seulsSuspects('dague', ['marchand', 'morel']),
    incompatibleAvec: ['IND-75'],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-72',
    titre: 'La partition annotée',
    categorie: 'document',
    texte:
      "Sur le pupitre du piano, une partition porte des annotations au crayon, tracées pendant la soirée. Deux personnes seulement savent lire la musique au manoir : Éléonore et le docteur Morel. Si le crime a eu lieu dans le salon de musique, le coupable est l'un des deux.",
    concerne: ['salon_musique', 'eleonore', 'morel'],
    regles: seulsSuspects('salon_musique', ['eleonore', 'morel']),
    disponibleDesManche: 1,
  },

  // --- Le journal d'Armand : sept pages, du 11 au 17 octobre ---
  {
    id: 'IND-73',
    titre: "Journal d'Armand — 11 octobre",
    categorie: 'journal',
    texte:
      "« Éléonore a encore crié ce soir à propos du testament. Quand j'ai sorti le revolver de mon père pour le nettoyer, elle a pâli et quitté la pièce. Depuis l'accident de chasse de sa mère, elle ne supporte même pas de le voir. Ma fille ne touchera jamais à cette arme. »",
    concerne: ['eleonore', 'revolver'],
    regles: [{ type: 'pasEnsemble', a: 'eleonore', b: 'revolver' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-74',
    titre: "Journal d'Armand — 12 octobre",
    categorie: 'journal',
    texte:
      "« Victor m'a encore demandé d'aller chercher le bourgogne moi-même. Il refuse de descendre à la cave depuis qu'il y est resté enfermé toute une nuit, il y a des années. Un homme qui a peur du noir et prétend me faire peur… »",
    concerne: ['victor', 'cave'],
    regles: [{ type: 'pasEnsemble', a: 'victor', b: 'cave' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-75',
    titre: "Journal d'Armand — 13 octobre",
    categorie: 'journal',
    texte:
      "« Lucien a refusé de m'ôter une simple écharde. Ses mains tremblent dès qu'il voit une lame, depuis cette opération ratée dont il ne parle jamais. Et c'est cet homme qu'on appelle docteur. »",
    concerne: ['morel', 'dague'],
    regles: [{ type: 'pasEnsemble', a: 'morel', b: 'dague' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-76',
    titre: "Journal d'Armand — 14 octobre",
    categorie: 'journal',
    texte:
      "« J'ai surpris Étienne à lire mes lettres dans la bibliothèque. Je lui ai repris la clé : il n'y entrera plus. Trente ans de service, et voilà comment il me remercie. Je lui annoncerai son renvoi demain. »",
    concerne: ['marchand', 'bibliotheque'],
    regles: [{ type: 'pasEnsemble', a: 'marchand', b: 'bibliotheque' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-77',
    titre: "Journal d'Armand — 15 octobre",
    categorie: 'journal',
    texte:
      "« La journaliste fouille partout. J'ai fait poser un second verrou à mon bureau, dont je garde l'unique clé sur moi. Mademoiselle Vasseur n'y mettra plus jamais les pieds. »",
    concerne: ['camille', 'bureau'],
    regles: [{ type: 'pasEnsemble', a: 'camille', b: 'bureau' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-78',
    titre: "Journal d'Armand — 16 octobre",
    categorie: 'journal',
    texte:
      "« Gabriel est revenu. Il a refusé de s'asseoir à ma table et jure qu'il ne remettra jamais les pieds dans cette salle à manger où je l'ai humilié il y a dix ans. Qu'il garde sa fierté : j'ai toujours sa lettre. »",
    concerne: ['gabriel', 'salle_a_manger'],
    regles: [{ type: 'pasEnsemble', a: 'gabriel', b: 'salle_a_manger' }],
    disponibleDesManche: 1,
  },
  {
    id: 'IND-79',
    titre: "Journal d'Armand — 17 octobre",
    categorie: 'journal',
    texte:
      "« J'ai fait retirer le chandelier du salon de musique : la cire a encore taché le piano. Demain, je parlerai au notaire. Tant de gens dans cette maison auraient intérêt à ce que je me taise… »",
    concerne: ['salon_musique', 'chandelier'],
    regles: [{ type: 'pasEnsemble', a: 'salon_musique', b: 'chandelier' }],
    disponibleDesManche: 1,
  },
];

/** Jour d'une page du carnet de la victime (« Journal d'Armand — 12 octobre » -> 12), pour les trier. */
export function jourDuJournal(c: CarteIndice): number {
  return Number(/(\d+)(?:er)?\s+\p{L}+\s*$/u.exec(c.titre)?.[1] ?? 0);
}

/** Faux indices de la ruse « Dossier trafiqué » (voir fauxIndices.ts). Identifiants inchangés pour les parties sauvegardées. */
export const FAUX_INDICES: CarteIndice[] = genererFauxIndices(MANOIR, { personnages: PERSONNAGES, lieux: LIEUX_FICHES, armes: ARMES_FICHES }, {
  prefixe: 'FAUX',
  titrePage: (n) => `Journal d'Armand — ${11 + n} octobre`,
  prenoms: { eleonore: 'Éléonore', victor: 'Victor', morel: 'Lucien', marchand: 'Étienne', camille: 'Mademoiselle Vasseur', gabriel: 'Gabriel' },
  pageSuspectLieu: (prenom, lieu) =>
    `« ${prenom} m'a juré ce soir de ne plus jamais mettre les pieds ${lieu}, pas même pour me faire plaisir. Pour une fois, je le crois : il y a des souvenirs qu'on ne veut pas réveiller. »`,
  pageSuspectArme: (prenom, arme) =>
    `« J'ai mis ${arme} sous clé, et ${prenom} ignore tout de la cachette. Voilà au moins une chose qui ne pourra pas se retourner contre moi dans cette maison. »`,
  pageLieuArme: (lieu, arme) =>
    `« Ce matin, j'ai fait retirer ${arme} : il n'y a plus rien de tel ${lieu}, et je suis le seul à connaître sa cachette. Les domestiques chuchotent ; qu'ils chuchotent. »`,
});
