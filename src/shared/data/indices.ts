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

import type { CarteIndice } from '../types';

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
];

export const INDICES_PAR_ID: Record<string, CarteIndice> = Object.fromEntries(INDICES.map((c) => [c.id, c]));

export const LIBELLES_CATEGORIE_INDICE: Record<CarteIndice['categorie'], string> = {
  temoignage: 'Témoignage',
  objet: 'Objet',
  horaire: 'Horaire',
  deplacement: 'Déplacement',
  document: 'Document',
  trace: 'Trace',
  contradiction: 'Contradiction',
};
