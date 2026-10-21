// Les cartes d'indice de l'affaire de l'Étoile du Simplon.
//
// Comme pour le manoir, chaque carte relie deux éléments (« si X est coupable, ce n'est pas
// avec Y ») : aucune n'innocente à elle seule un suspect, un lieu ou une arme. S'y ajoutent
// des témoignages partiels (« si l'arme est X, le coupable est A ou B ») et les pages du
// carnet d'Octave. Le générateur ne retient une carte que si elle est vraie pour la solution.

import { elementsDe, type ArmeId, type CarteIndice, type ElementId, type LieuId, type SuspectId } from '../types';
import { genererFauxIndices, seulsSuspects } from './fauxIndices';
import { ARMES_TRAIN, LIEUX_TRAIN, PERSONNAGES_TRAIN } from './train';

const TRAIN = elementsDe('train');
const pas = (a: ElementId, b: ElementId) => ({ type: 'pasEnsemble', a, b }) as const;
const deuxSuspects = (pivot: LieuId | ArmeId, suspects: SuspectId[]) => seulsSuspects(TRAIN.suspects, pivot, suspects);

export const INDICES_TRAIN: CarteIndice[] = [
  // --- Un suspect et un lieu ---
  {
    id: 'TR-01',
    titre: 'Le dogue du fourgon',
    categorie: 'temoignage',
    texte:
      "Le dogue du colonel dort enchaîné dans le fourgon à bagages et grogne au moindre pas. Mordue dans son enfance, Irina en a une peur panique : à Dijon, le chef de train l'a vue rebrousser chemin dès le premier grognement. Si Irina est coupable, ce n'est pas dans le fourgon.",
    concerne: ['irina', 'fourgon'],
    regles: [pas('irina', 'fourgon')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-02',
    titre: 'Le vertige du colonel',
    categorie: 'document',
    texte:
      "Le livret militaire du colonel porte la mention « vertige incurable, réformé des postes d'observation ». Il n'a jamais mis un pied sur la plate-forme, suspendue au-dessus du ravin. Si le colonel est coupable, ce n'est pas sur la plate-forme d'observation.",
    concerne: ['hector', 'plateforme'],
    regles: [pas('hector', 'plateforme')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-03',
    titre: 'Le règlement de la voiture-salon',
    categorie: 'temoignage',
    texte:
      "Le règlement de la Compagnie interdit la voiture-salon au personnel de maison des voyageurs. Le barman, qui n'a pas quitté son comptoir, a refusé l'entrée à Mathilde à minuit et demi. Si Mathilde est coupable, ce n'est pas dans la voiture-salon.",
    concerne: ['mathilde', 'voiture_salon'],
    regles: [pas('mathilde', 'voiture_salon')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-04',
    titre: 'Deux compagnies rivales',
    categorie: 'temoignage',
    texte:
      "Le wagon-restaurant appartient à une autre compagnie que les wagons-lits, et son chef de rang déteste Lucas, qu'il accuse de voler ses bouteilles. Il l'aurait signalé au premier pas. Si Lucas est coupable, ce n'est pas au wagon-restaurant.",
    concerne: ['lucas', 'wagon_restaurant'],
    regles: [pas('lucas', 'wagon_restaurant')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-05',
    titre: 'Les talons de Margaret',
    categorie: 'trace',
    texte:
      "Le parquet du couloir craque à chaque pas, et les talons de Margaret claquent comme des castagnettes. Les voyageurs au sommeil léger n'ont rien entendu de tel de la nuit. Si Margaret est coupable, ce n'est pas dans le couloir des wagons-lits.",
    concerne: ['margaret', 'couloir'],
    regles: [pas('margaret', 'couloir')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-06',
    titre: "L'ordre écrit au conducteur",
    categorie: 'document',
    texte:
      "Dans la poche de Lucas, un ordre signé d'Octave : « Ne jamais laisser entrer M. Agnel dans mon compartiment, sous aucun prétexte. » Le romancier l'avait surpris à fouiller sa serviette. Si Paul est coupable, ce n'est pas dans le compartiment n° 7.",
    concerne: ['paul', 'compartiment'],
    regles: [pas('paul', 'compartiment')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-07',
    titre: 'Le plateau renversé',
    categorie: 'temoignage',
    texte:
      "Depuis qu'il a renversé un plateau de champagne sur une duchesse, Lucas est banni de la voiture-salon : le barman le chasse à vue, et il ne s'y risque plus. Si Lucas est coupable, ce n'est pas dans la voiture-salon.",
    concerne: ['lucas', 'voiture_salon'],
    regles: [pas('lucas', 'voiture_salon')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-08',
    titre: 'La robe de lamé',
    categorie: 'trace',
    texte:
      "Dans le fourgon, tout est couvert d'une suie de charbon qui noircit le moindre tissu. La robe de lamé argent que Margaret portait cette nuit est immaculée. Si Margaret est coupable, ce n'est pas dans le fourgon à bagages.",
    concerne: ['margaret', 'fourgon'],
    regles: [pas('margaret', 'fourgon')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-09',
    titre: "L'esclandre du dîner",
    categorie: 'temoignage',
    texte:
      "Ivre au dîner, Paul a insulté le maître d'hôtel, qui l'a fait reconduire et a fermé à clé la porte du wagon-restaurant côté wagons-lits. Le romancier n'a pas pu y revenir. Si Paul est coupable, ce n'est pas au wagon-restaurant.",
    concerne: ['paul', 'wagon_restaurant'],
    regles: [pas('paul', 'wagon_restaurant')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-10',
    titre: 'La saison de la Fenice',
    categorie: 'document',
    texte:
      "Le contrat d'Irina avec la Fenice comporte une clause : la moindre angine annule la saison. Elle ne sort jamais au froid, et son manteau de fourrure, resté pendu dans sa cabine, est parfaitement sec. Si Irina est coupable, ce n'est pas sur la plate-forme d'observation.",
    concerne: ['irina', 'plateforme'],
    regles: [pas('irina', 'plateforme')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-11',
    titre: 'Le bordeaux bouchonné',
    categorie: 'temoignage',
    texte:
      "Furieux d'un bordeaux bouchonné, le colonel a juré devant tout le train de ne plus jamais remettre les pieds au wagon-restaurant. Homme d'honneur, il s'est fait servir dans son compartiment. Si le colonel est coupable, ce n'est pas au wagon-restaurant.",
    concerne: ['hector', 'wagon_restaurant'],
    regles: [pas('hector', 'wagon_restaurant')],
    disponibleDesManche: 1,
  },

  // --- Un suspect et une arme ---
  {
    id: 'TR-12',
    titre: 'Le poignet de la danseuse',
    categorie: 'document',
    texte:
      "Irina s'est foulé le poignet en répétition à Paris : le bandage du médecin de l'Opéra est encore en place. Elle ne peut rien soulever de lourd. Si Irina est coupable, ce n'est ni avec la clé à molette ni avec la canne à pommeau d'argent.",
    concerne: ['irina', 'cle_molette', 'canne'],
    regles: [pas('irina', 'cle_molette'), pas('irina', 'canne')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-13',
    titre: 'Les lunettes perdues',
    categorie: 'temoignage',
    texte:
      "Le colonel a perdu ses lunettes à Dijon et ne distingue plus rien de près : il a dû demander au conducteur de lire son billet. Doser des gouttes au compte-gouttes lui est impossible. Si le colonel est coupable, ce n'est pas avec le flacon de somnifère.",
    concerne: ['hector', 'somnifere'],
    regles: [pas('hector', 'somnifere')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-14',
    titre: 'Les rhumatismes de Mathilde',
    categorie: 'document',
    texte:
      "Mathilde souffre de rhumatismes si sévères qu'elle ne parvient pas à tourner la clé de sa propre malle. La détente du pistolet à crosse de nacre est d'une dureté redoutable. Si Mathilde est coupable, ce n'est pas avec le pistolet.",
    concerne: ['mathilde', 'pistolet'],
    regles: [pas('mathilde', 'pistolet')],
    disponibleDesManche: 2,
  },
  {
    id: 'TR-15',
    titre: 'Les mains brûlées',
    categorie: 'document',
    texte:
      "En relançant le poêle du wagon à Dijon, Lucas s'est brûlé les deux paumes ; le médecin de la gare les a bandées. Serrer une cordelette lui arracherait un cri. Si Lucas est coupable, ce n'est pas avec la cordelette de soie.",
    concerne: ['lucas', 'cordelette'],
    regles: [pas('lucas', 'cordelette')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-16',
    titre: 'Les gants blancs',
    categorie: 'trace',
    texte:
      "Margaret n'a pas quitté ses longs gants de soie blanche de la nuit : le barman et deux voyageurs l'attestent, et ils sont immaculés. Le stylet aurait laissé du sang, la clé à molette du cambouis. Si Margaret est coupable, ce n'est ni avec le stylet ni avec la clé à molette.",
    concerne: ['margaret', 'stylet', 'cle_molette'],
    regles: [pas('margaret', 'stylet'), pas('margaret', 'cle_molette')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-17',
    titre: 'Le dos du romancier',
    categorie: 'document',
    texte:
      "Un télégramme du médecin de Paul est arrivé à Brigue : hernie discale, interdiction de lever le bras au-dessus de l'épaule. Brandir une lourde canne lui est impossible. Si Paul est coupable, ce n'est pas avec la canne à pommeau d'argent.",
    concerne: ['paul', 'canne'],
    regles: [pas('paul', 'canne')],
    disponibleDesManche: 3,
  },
  {
    id: 'TR-18',
    titre: 'Le sac de Mathilde',
    categorie: 'temoignage',
    texte:
      "La canne du colonel pèse plus de deux kilos. Mathilde, frêle et rhumatisante, a dû faire porter son propre sac de voyage par un porteur à la gare de Lyon. Si Mathilde est coupable, ce n'est pas avec la canne à pommeau d'argent.",
    concerne: ['mathilde', 'canne'],
    regles: [pas('mathilde', 'canne')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-19',
    titre: 'Les ongles vernis',
    categorie: 'trace',
    texte:
      "Margaret porte de longs ongles vernis de rouge, intacts et sans la moindre éraflure. Serrer une cordelette de soie de toutes ses forces les aurait brisés net. Si Margaret est coupable, ce n'est pas avec la cordelette.",
    concerne: ['margaret', 'cordelette'],
    regles: [pas('margaret', 'cordelette')],
    disponibleDesManche: 1,
  },

  // --- Un lieu et une arme ---
  {
    id: 'TR-20',
    titre: 'Les cloisons de papier',
    categorie: 'temoignage',
    texte:
      "Les cloisons du couloir des wagons-lits sont si minces qu'on y entend les voisins ronfler. Un coup de feu aurait réveillé tout le wagon : tout le monde dormait. Si le crime a eu lieu dans le couloir, ce n'était pas avec le pistolet.",
    concerne: ['couloir', 'pistolet'],
    regles: [pas('couloir', 'pistolet')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-21',
    titre: 'Le fourgon glacé',
    categorie: 'trace',
    texte:
      "Il fait dix degrés sous zéro dans le fourgon : on n'y trouve ni verre ni bouteille, et toute boisson y gèlerait en quelques minutes. Si le crime a eu lieu dans le fourgon à bagages, ce n'était pas avec le somnifère.",
    concerne: ['fourgon', 'somnifere'],
    regles: [pas('fourgon', 'somnifere')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-22',
    titre: "L'auvent givré",
    categorie: 'trace',
    texte:
      "Au-dessus de la plate-forme, l'auvent de toile est si bas qu'un objet long brandi à bout de bras l'aurait crevé. Sa croûte de givre est intacte. Si le crime a eu lieu sur la plate-forme d'observation, ce n'était pas avec la canne.",
    concerne: ['plateforme', 'canne'],
    regles: [pas('plateforme', 'canne')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-23',
    titre: 'Les nappes de minuit',
    categorie: 'trace',
    texte:
      "Les nappes du wagon-restaurant ont été changées à minuit et sont d'une blancheur parfaite. Une lame aurait laissé des projections. Si le crime a eu lieu au wagon-restaurant, ce n'était pas avec le stylet.",
    concerne: ['wagon_restaurant', 'stylet'],
    regles: [pas('wagon_restaurant', 'stylet')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-24',
    titre: 'Les lustres de cristal',
    categorie: 'trace',
    texte:
      "Les miroirs et les lustres de la voiture-salon tintent au moindre choc ; aucun n'est fêlé et le barman n'a rien entendu. Si le crime a eu lieu dans la voiture-salon, ce n'était ni avec la clé à molette ni avec la canne.",
    concerne: ['voiture_salon', 'cle_molette', 'canne'],
    regles: [pas('voiture_salon', 'cle_molette'), pas('voiture_salon', 'canne')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-25',
    titre: "L'odeur de poudre",
    categorie: 'trace',
    texte:
      "Le compartiment n° 7 est resté fermé jusqu'à la découverte du corps. On n'y a senti aucune odeur de poudre, qui s'attarde des heures dans un espace si étroit. Si le crime a eu lieu dans le compartiment, ce n'était pas avec le pistolet.",
    concerne: ['compartiment', 'pistolet'],
    regles: [pas('compartiment', 'pistolet')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-26',
    titre: 'Le mécanicien aux aguets',
    categorie: 'temoignage',
    texte:
      "Le vent porte les sons de la plate-forme jusqu'à la locomotive, où le mécanicien a veillé toute la nuit en guettant l'avalanche. Il n'a entendu aucun coup de feu. Si le crime a eu lieu sur la plate-forme, ce n'était pas avec le pistolet.",
    concerne: ['plateforme', 'pistolet'],
    regles: [pas('plateforme', 'pistolet')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-27',
    titre: 'Les malles jusqu’au plafond',
    categorie: 'objet',
    texte:
      "Le fourgon est si encombré de malles qu'on s'y faufile de côté. Impossible d'y brandir un objet long sans renverser une pile : aucune n'a bougé. Si le crime a eu lieu dans le fourgon, ce n'était pas avec la canne.",
    concerne: ['fourgon', 'canne'],
    regles: [pas('fourgon', 'canne')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-28',
    titre: 'Le tapis brossé',
    categorie: 'trace',
    texte:
      "À 1 h 30, avant la découverte du corps, Lucas a brossé le tapis rouge du couloir. Sa brosse est propre : pas une goutte de sang. Si le crime a eu lieu dans le couloir des wagons-lits, ce n'était pas avec le stylet.",
    concerne: ['couloir', 'stylet'],
    regles: [pas('couloir', 'stylet')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-29',
    titre: 'Le barman',
    categorie: 'temoignage',
    texte:
      "Au bar de la voiture-salon, le barman sert lui-même chaque verre et ne laisse jamais une bouteille sans surveillance. Personne n'a pu verser quoi que ce soit dans une boisson. Si le crime a eu lieu dans la voiture-salon, ce n'était pas avec le somnifère.",
    concerne: ['voiture_salon', 'somnifere'],
    regles: [pas('voiture_salon', 'somnifere')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-30',
    titre: 'Le plafond bas',
    categorie: 'trace',
    texte:
      "Le plafond du compartiment n° 7 est si bas qu'une canne levée aurait heurté la lampe de laiton. La lampe est intacte et le plafond sans marque. Si le crime a eu lieu dans le compartiment, ce n'était pas avec la canne.",
    concerne: ['compartiment', 'canne'],
    regles: [pas('compartiment', 'canne')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-31',
    titre: 'Les carafes sous clé',
    categorie: 'objet',
    texte:
      "À la fermeture, le chef de rang a mis sous clé toutes les bouteilles et carafes du wagon-restaurant, comme chaque soir ; l'inventaire du matin est complet. Rien à boire après 23 h. Si le crime a eu lieu au wagon-restaurant, ce n'était pas avec le somnifère.",
    concerne: ['wagon_restaurant', 'somnifere'],
    regles: [pas('wagon_restaurant', 'somnifere')],
    disponibleDesManche: 1,
  },

  // --- Témoignages partiels : une trace qui désigne deux coupables possibles ---
  {
    id: 'TR-32',
    titre: 'Le cadenas du fourgon',
    categorie: 'objet',
    texte:
      "Le fourgon à bagages est fermé par un cadenas qui n'a pas été forcé. Deux clés seulement existent : celle du conducteur Lucas et celle du colonel, autorisé à rendre visite à son chien. Si le crime a eu lieu dans le fourgon, le coupable est l'un des deux.",
    concerne: ['fourgon', 'lucas', 'hector'],
    regles: deuxSuspects('fourgon', ['lucas', 'hector']),
    disponibleDesManche: 1,
  },
  {
    id: 'TR-33',
    titre: 'Le rouge carmin',
    categorie: 'trace',
    texte:
      "Sur le bar de la voiture-salon, deux verres à champagne portent un rouge à lèvres carmin, laissé après minuit. Seules Irina et Margaret portent ce rouge, acheté le même jour chez le même parfumeur. Si le crime a eu lieu dans la voiture-salon, la coupable est l'une des deux.",
    concerne: ['voiture_salon', 'irina', 'margaret'],
    regles: deuxSuspects('voiture_salon', ['irina', 'margaret']),
    disponibleDesManche: 1,
  },
  {
    id: 'TR-34',
    titre: 'Le nœud de marin',
    categorie: 'objet',
    texte:
      "La cordelette de soie a été serrée par un nœud de chaise double, un nœud de marin. Deux voyageurs seulement savent le faire : Mathilde, fille de pêcheur, et Paul, ancien matelot. Si l'arme est la cordelette, le coupable est l'un des deux.",
    concerne: ['cordelette', 'mathilde', 'paul'],
    regles: deuxSuspects('cordelette', ['mathilde', 'paul']),
    disponibleDesManche: 1,
  },
  {
    id: 'TR-35',
    titre: 'Le cran de sûreté',
    categorie: 'document',
    texte:
      "Le pistolet à crosse de nacre est un modèle américain dont le cran de sûreté se débloque à l'envers. Deux voyageurs savent le manier : Margaret, à qui il appartient, et le colonel, qui l'a démonté au dîner pour l'impressionner. Si l'arme est le pistolet, le coupable est l'un des deux.",
    concerne: ['pistolet', 'margaret', 'hector'],
    regles: deuxSuspects('pistolet', ['margaret', 'hector']),
    disponibleDesManche: 1,
  },
  {
    id: 'TR-36',
    titre: 'Les cendres de pipe',
    categorie: 'trace',
    texte:
      "Sur la plate-forme d'observation, la neige fraîche garde des cendres de pipe et deux allumettes suédoises. Seuls Paul et le conducteur Lucas fument la pipe à bord. Si le crime a eu lieu sur la plate-forme, le coupable est l'un des deux.",
    concerne: ['plateforme', 'paul', 'lucas'],
    regles: deuxSuspects('plateforme', ['paul', 'lucas']),
    disponibleDesManche: 1,
  },
  {
    id: 'TR-37',
    titre: 'Le gant de chevreau',
    categorie: 'trace',
    texte:
      "Sur la garde du stylet, l'empreinte d'un gant de chevreau très fin. Deux voyageurs seulement portent ces gants : le colonel, et Irina, qui ne les quitte jamais pour protéger ses mains. Si l'arme est le stylet, le coupable est l'un des deux.",
    concerne: ['stylet', 'hector', 'irina'],
    regles: deuxSuspects('stylet', ['hector', 'irina']),
    disponibleDesManche: 1,
  },

  // --- Le carnet d'Octave : sept pages, du 3 au 9 mars ---
  {
    id: 'TR-38',
    titre: "Carnet d'Octave — 3 mars",
    categorie: 'journal',
    texte:
      "« La petite Lowell m'a giflé ce soir devant tout le Ritz. J'ai réservé le n° 7 pour le voyage et prévenu la Compagnie : le conducteur a ordre de ne jamais la laisser entrer dans mon compartiment. Elle paiera cette gifle au centuple. »",
    concerne: ['margaret', 'compartiment'],
    regles: [pas('margaret', 'compartiment')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-39',
    titre: "Carnet d'Octave — 4 mars",
    categorie: 'journal',
    texte:
      "« Déjeuner avec Brassac. Le pauvre a les doigts gourds depuis ses engelures de 1916 : il ne sait même plus nouer sa cravate, c'est son ordonnance qui s'en charge. Et ce vieux héros croit encore me faire peur. »",
    concerne: ['hector', 'cordelette'],
    regles: [pas('hector', 'cordelette')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-40',
    titre: "Carnet d'Octave — 5 mars",
    categorie: 'journal',
    texte:
      "« La Volkova refuse de dîner en public : l'odeur des cuisines lui soulève le cœur avant de danser. Dans le train, elle se fera servir dans sa cabine, comme toujours. Une princesse, vraiment ? »",
    concerne: ['irina', 'wagon_restaurant'],
    regles: [pas('irina', 'wagon_restaurant')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-41',
    titre: "Carnet d'Octave — 6 mars",
    categorie: 'journal',
    texte:
      "« Bertin m'a avoué qu'il ne sait pas lire. Il reconnaît les flacons à leur couleur, et mes gouttes ont la même que l'eau de Vichy : il serait bien incapable de doser mon somnifère. Voilà l'homme à qui je confie mes secrets. »",
    concerne: ['lucas', 'somnifere'],
    regles: [pas('lucas', 'somnifere')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-42',
    titre: "Carnet d'Octave — 7 mars",
    categorie: 'journal',
    texte:
      "« Mathilde tousse depuis Noël. Le docteur Weiss lui interdit le froid : pas un pas dehors avant le printemps, pas même sur un quai de gare. Elle restera au chaud, à recopier mes lettres. »",
    concerne: ['mathilde', 'plateforme'],
    regles: [pas('mathilde', 'plateforme')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-43',
    titre: "Carnet d'Octave — 8 mars",
    categorie: 'journal',
    texte:
      "« Agnel remplit ses romans de coups de feu, mais il m'a avoué en rougissant n'avoir jamais tenu une arme : la moindre détonation le paralyse. Un écrivain de crimes qui a peur d'un pétard. »",
    concerne: ['paul', 'pistolet'],
    regles: [pas('paul', 'pistolet')],
    disponibleDesManche: 1,
  },
  {
    id: 'TR-44',
    titre: "Carnet d'Octave — 9 mars",
    categorie: 'journal',
    texte:
      "« Départ ce soir. J'ai exigé du chef de train qu'aucun outil ne traîne dans le couloir des wagons-lits : la dernière fois, je me suis pris le pied dans une caisse. Il a promis : tout sera rangé dans le fourgon. »",
    concerne: ['couloir', 'cle_molette'],
    regles: [pas('couloir', 'cle_molette')],
    disponibleDesManche: 1,
  },
];

/** Faux indices de la ruse « Dossier trafiqué » pour le train. */
export const FAUX_INDICES_TRAIN: CarteIndice[] = genererFauxIndices(TRAIN, { personnages: PERSONNAGES_TRAIN, lieux: LIEUX_TRAIN, armes: ARMES_TRAIN }, {
  prefixe: 'FAUX-T',
  titrePage: (n) => `Carnet d'Octave — ${3 + n} mars`,
  prenoms: { irina: 'la Volkova', hector: 'Brassac', mathilde: 'Mathilde', lucas: 'Bertin', margaret: 'la petite Lowell', paul: 'Agnel' },
  pageSuspectLieu: (prenom, lieu) =>
    `« Ce soir, ${prenom} m'a juré de ne jamais mettre les pieds ${lieu} de tout le voyage. Je l'ai noté, comme je note tout : un jour, cela pourra servir. »`,
  pageSuspectArme: (prenom, arme) =>
    `« J'ai fait mettre ${arme} sous clé, et ${prenom} ignore tout de la cachette. Une précaution de plus : dans ce train, je ne compte plus mes ennemis. »`,
  pageLieuArme: (lieu, arme) =>
    `« J'ai exigé du chef de train qu'on retire ${arme} : il n'y a plus rien de tel ${lieu}, et nous sommes seuls, lui et moi, à savoir où c'est rangé. »`,
});
