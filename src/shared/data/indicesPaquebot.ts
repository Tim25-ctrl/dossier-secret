// Les cartes d'indice de l'affaire de l'Aurélia.
//
// Comme pour les autres affaires, chaque carte relie deux éléments (« si X est coupable, ce n'est
// pas avec Y ») : aucune n'innocente à elle seule un suspect, un lieu ou une arme. S'y ajoutent
// des témoignages partiels (« si l'arme est X, le coupable est A ou B ») et les pages du journal
// d'Édouard. Le générateur ne retient une carte que si elle est vraie pour la solution.
//
// Les liens entre éléments suivent exactement la même structure que ceux du train (équilibre
// vérifié par simulation) ; seuls les personnages, les lieux, les armes et les textes changent.

import { elementsDe, type ArmeId, type CarteIndice, type ElementId, type LieuId, type SuspectId } from '../types';
import { genererFauxIndices, seulsSuspects } from './fauxIndices';
import { ARMES_PAQUEBOT, LIEUX_PAQUEBOT, PERSONNAGES_PAQUEBOT } from './paquebot';

const PAQUEBOT = elementsDe('paquebot');
const pas = (a: ElementId, b: ElementId) => ({ type: 'pasEnsemble', a, b }) as const;
const deuxSuspects = (pivot: LieuId | ArmeId, suspects: SuspectId[]) => seulsSuspects(PAQUEBOT.suspects, pivot, suspects);

export const INDICES_PAQUEBOT: CarteIndice[] = [
  // --- Un suspect et un lieu ---
  {
    id: 'PQ-01',
    titre: 'La voix assurée',
    categorie: 'document',
    texte:
      "Le contrat d'assurance de la voix d'Hélène lui interdit d'approcher les chaudières : la suie et la vapeur brûlante pourraient l'abîmer, et l'assureur ne paierait plus rien. Le chef mécanicien confirme qu'elle n'est jamais descendue. Si Hélène est coupable, ce n'est pas dans la salle des machines.",
    concerne: ['helene', 'salle_machines'],
    regles: [pas('helene', 'salle_machines')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-02',
    titre: 'Le règlement des officiers',
    categorie: 'document',
    texte:
      "Le règlement de la Compagnie interdit aux officiers de paraître la nuit sur le pont promenade, réservé aux passagers de première. Le veilleur de nuit, qui l'arpente d'un bout à l'autre, n'y a croisé aucun uniforme. Si Le Goff est coupable, ce n'est pas sur le pont promenade.",
    concerne: ['legoff', 'pont'],
    regles: [pas('legoff', 'pont')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-03',
    titre: 'La querelle du fumoir',
    categorie: 'temoignage',
    texte:
      "Au dîner, le professeur Bréval a traité les joueurs de cartes de « parasites », et le barman du fumoir l'a pris pour lui. Il lui a refusé l'entrée à 23 h 30, puis n'a pas quitté son comptoir de la nuit. Si le professeur est coupable, ce n'est pas au fumoir.",
    concerne: ['breval', 'fumoir'],
    regles: [pas('breval', 'fumoir')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-04',
    titre: 'Le maître-nageur',
    categorie: 'temoignage',
    texte:
      "Le maître-nageur a ordre de ne laisser entrer aucun membre d'équipage dans le bassin des passagers, et il n'a pas quitté sa chaise jusqu'à minuit. Il jure n'avoir vu ni uniforme ni casque d'écoute. Si Rose est coupable, ce n'est pas dans la piscine couverte.",
    concerne: ['rose', 'piscine'],
    regles: [pas('rose', 'piscine')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-05',
    titre: "L'échelle du poste de radio",
    categorie: 'trace',
    texte:
      "On n'accède au poste de radio que par une échelle de fer presque verticale. Avec sa robe fourreau et ses talons, la comtesse n'aurait pas pu la gravir, et le lourd tissu de sa robe ne porte pas la moindre trace de rouille. Si la comtesse est coupable, ce n'est pas dans le poste de radio.",
    concerne: ['isabella', 'poste_radio'],
    regles: [pas('isabella', 'poste_radio')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-06',
    titre: "L'ordre au steward",
    categorie: 'document',
    texte:
      "Dans le registre du steward de nuit, un ordre signé d'Édouard : « Ne jamais laisser entrer M. Delaroche dans ma suite, sous aucun prétexte. » L'armateur l'avait surpris à fouiller son secrétaire. Si Max est coupable, ce n'est pas dans la suite de l'armateur.",
    concerne: ['max', 'suite'],
    regles: [pas('max', 'suite')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-07',
    titre: "Le fumoir des premières",
    categorie: 'temoignage',
    texte:
      "Le fumoir des premières est interdit à l'équipage, et le barman connaît chaque visage du personnel. Il a refoulé Rose à 23 h, quand elle est venue chercher un passager, et elle n'est pas revenue. Si Rose est coupable, ce n'est pas au fumoir.",
    concerne: ['rose', 'fumoir'],
    regles: [pas('rose', 'fumoir')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-08',
    titre: 'La robe de satin blanc',
    categorie: 'trace',
    texte:
      "Dans la salle des machines, une suie grasse noircit le moindre tissu qui frôle une rambarde. La robe de satin blanc que la comtesse portait cette nuit est immaculée, de l'ourlet aux épaules. Si la comtesse est coupable, ce n'est pas dans la salle des machines.",
    concerne: ['isabella', 'salle_machines'],
    regles: [pas('isabella', 'salle_machines')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-09',
    titre: 'Le verre dans le bassin',
    categorie: 'temoignage',
    texte:
      "À 23 h, Max a jeté son verre dans le bassin pour amuser la galerie. Le maître-nageur l'a mis dehors et a fermé la piscine à clé derrière lui, une heure avant l'heure. Le joueur n'a pas pu y revenir. Si Max est coupable, ce n'est pas dans la piscine couverte.",
    concerne: ['max', 'piscine'],
    regles: [pas('max', 'piscine')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-10',
    titre: "L'humidité du brouillard",
    categorie: 'document',
    texte:
      "Le contrat d'Hélène avec le music-hall de New York comporte une clause : la moindre extinction de voix annule tout. Elle ne s'expose jamais à l'air humide, et son étole de fourrure, restée sur sa chaise, est parfaitement sèche. Si Hélène est coupable, ce n'est pas sur le pont promenade.",
    concerne: ['helene', 'pont'],
    regles: [pas('helene', 'pont')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-11',
    titre: 'Le naufragé',
    categorie: 'temoignage',
    texte:
      "Depuis le naufrage auquel il a survécu en 1912, Le Goff ne supporte pas l'eau profonde : il fait le tour du navire pour éviter de longer le bassin, et tout l'équipage le sait. Si Le Goff est coupable, ce n'est pas dans la piscine couverte.",
    concerne: ['legoff', 'piscine'],
    regles: [pas('legoff', 'piscine')],
    disponibleDesManche: 1,
  },

  // --- Un suspect et une arme ---
  {
    id: 'PQ-12',
    titre: 'Le poignet de la chanteuse',
    categorie: 'document',
    texte:
      "Lors du gros roulis de mardi, Hélène est tombée dans l'escalier du grand salon : le médecin de bord lui a bandé le poignet et interdit de rien porter. Si Hélène est coupable, ce n'est ni avec le tisonnier ni avec la gaffe d'abordage.",
    concerne: ['helene', 'tisonnier', 'gaffe'],
    regles: [pas('helene', 'tisonnier'), pas('helene', 'gaffe')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-13',
    titre: 'La cave du commissaire',
    categorie: 'temoignage',
    texte:
      "À bord, le champagne sort de la cave du commissaire, bouteille par bouteille, et seulement pour les salons des passagers. Le Goff, en service toute la nuit, n'a pas mis les pieds dans un salon ni demandé la moindre bouteille. Si Le Goff est coupable, ce n'est pas avec la coupe de champagne.",
    concerne: ['legoff', 'champagne'],
    regles: [pas('legoff', 'champagne')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-14',
    titre: 'Les rhumatismes du professeur',
    categorie: 'document',
    texte:
      "Vingt ans de nuits glacées dans le désert ont laissé au professeur Bréval des mains déformées par les rhumatismes : il ne peut plus tourner une clé. La détente du pistolet lance-fusées est d'une dureté redoutable. Si le professeur est coupable, ce n'est pas avec le pistolet lance-fusées.",
    concerne: ['breval', 'lance_fusees'],
    regles: [pas('breval', 'lance_fusees')],
    disponibleDesManche: 2,
  },
  {
    id: 'PQ-15',
    titre: 'Les mains brûlées',
    categorie: 'document',
    texte:
      "En tentant de réparer l'émetteur, Rose s'est brûlé les deux paumes sur une lampe chauffée à blanc ; le médecin de bord les a bandées. Saisir un lourd sextant de laiton lui arracherait un cri. Si Rose est coupable, ce n'est pas avec le sextant.",
    concerne: ['rose', 'sextant'],
    regles: [pas('rose', 'sextant')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-16',
    titre: 'Les gants blancs',
    categorie: 'trace',
    texte:
      "La comtesse n'a pas quitté ses longs gants de chevreau blanc de la nuit : le barman et deux joueurs l'attestent, et ils sont immaculés. La statuette aurait laissé sa poussière ocre, le tisonnier sa suie. Si la comtesse est coupable, ce n'est ni avec la statuette ni avec le tisonnier.",
    concerne: ['isabella', 'statuette', 'tisonnier'],
    regles: [pas('isabella', 'statuette'), pas('isabella', 'tisonnier')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-17',
    titre: "L'épaule du joueur",
    categorie: 'document',
    texte:
      "Au casino de Deauville, la semaine dernière, une bagarre a démis l'épaule de Max ; le médecin de bord lui interdit de lever le bras au-dessus de la tête. Brandir une gaffe de trois mètres lui est impossible. Si Max est coupable, ce n'est pas avec la gaffe d'abordage.",
    concerne: ['max', 'gaffe'],
    regles: [pas('max', 'gaffe')],
    disponibleDesManche: 3,
  },
  {
    id: 'PQ-18',
    titre: 'Le souffle court',
    categorie: 'temoignage',
    texte:
      "La gaffe d'abordage pèse plus de six kilos et mesure trois mètres. Le professeur Bréval, asthmatique, a dû faire porter jusqu'à sa cabine sa propre sacoche de livres par un groom. Si le professeur est coupable, ce n'est pas avec la gaffe.",
    concerne: ['breval', 'gaffe'],
    regles: [pas('breval', 'gaffe')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-19',
    titre: 'Les ongles vernis',
    categorie: 'trace',
    texte:
      "La comtesse porte de longs ongles laqués de rouge, intacts et sans la moindre éraflure. Empoigner et abattre un sextant de laiton aux arêtes vives les aurait brisés net. Si la comtesse est coupable, ce n'est pas avec le sextant.",
    concerne: ['isabella', 'sextant'],
    regles: [pas('isabella', 'sextant')],
    disponibleDesManche: 1,
  },

  // --- Un lieu et une arme ---
  {
    id: 'PQ-20',
    titre: 'La cabine de fils',
    categorie: 'trace',
    texte:
      "Le poste de radio est une cabine minuscule tapissée de fils, de papier et de lampes. Une fusée tirée là-dedans aurait tout embrasé : rien n'a brûlé, pas même une feuille de télégramme. Si le crime a eu lieu dans le poste de radio, ce n'était pas avec le pistolet lance-fusées.",
    concerne: ['poste_radio', 'lance_fusees'],
    regles: [pas('poste_radio', 'lance_fusees')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-21',
    titre: 'La fournaise',
    categorie: 'trace',
    texte:
      "Il fait cinquante degrés dans la salle des machines, et le chef mécanicien y interdit toute boisson autre que l'eau de la citerne : on n'y trouve ni verre ni bouteille. Si le crime a eu lieu dans la salle des machines, ce n'était pas avec la coupe de champagne.",
    concerne: ['salle_machines', 'champagne'],
    regles: [pas('salle_machines', 'champagne')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-22',
    titre: 'Les verrières basses',
    categorie: 'trace',
    texte:
      "Le pont promenade est fermé par des verrières si basses qu'une perche brandie à bout de bras les aurait brisées. Pas une vitre n'est fêlée, et le brouillard n'y a laissé que de la buée. Si le crime a eu lieu sur le pont promenade, ce n'était pas avec la gaffe.",
    concerne: ['pont', 'gaffe'],
    regles: [pas('pont', 'gaffe')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-23',
    titre: 'La peinture qui coule',
    categorie: 'trace',
    texte:
      "La statuette d'Anubis est en bois peint et en plâtre : la moindre éclaboussure d'eau de mer en fait couler les couleurs. Sa peinture est intacte, sans une goutte. Si le crime a eu lieu dans la piscine couverte, ce n'était pas avec la statuette.",
    concerne: ['piscine', 'statuette'],
    regles: [pas('piscine', 'statuette')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-24',
    titre: 'Les lampes de cuivre',
    categorie: 'trace',
    texte:
      "Au fumoir, des lampes de cuivre pendent si bas au-dessus des tables qu'un objet lourd ou long levé les aurait heurtées ; elles tintent au moindre choc. Aucune n'est cabossée, et le barman n'a rien entendu. Si le crime a eu lieu au fumoir, ce n'était ni avec le tisonnier ni avec la gaffe.",
    concerne: ['fumoir', 'tisonnier', 'gaffe'],
    regles: [pas('fumoir', 'tisonnier'), pas('fumoir', 'gaffe')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-25',
    titre: 'Les tentures de velours',
    categorie: 'trace',
    texte:
      "La suite de l'armateur est tendue de velours et de soie. Une fusée tirée dans ces pièces y aurait mis le feu, et l'odeur de soufre s'y attarderait des heures : rien de tel quand le steward est entré. Si le crime a eu lieu dans la suite, ce n'était pas avec le pistolet lance-fusées.",
    concerne: ['suite', 'lance_fusees'],
    regles: [pas('suite', 'lance_fusees')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-26',
    titre: 'La vigie',
    categorie: 'temoignage',
    texte:
      "Toute la nuit, la vigie a guetté le brouillard depuis le nid-de-pie, au-dessus du pont promenade. Une fusée aurait illuminé la brume comme un feu d'artifice : il n'a vu aucune lueur. Si le crime a eu lieu sur le pont promenade, ce n'était pas avec le pistolet lance-fusées.",
    concerne: ['pont', 'lance_fusees'],
    regles: [pas('pont', 'lance_fusees')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-27',
    titre: 'Le dédale de tuyaux',
    categorie: 'objet',
    texte:
      "La salle des machines n'est qu'un dédale de passerelles étroites et de tuyaux brûlants. Impossible d'y manier une perche de trois mètres sans heurter les conduites : aucune n'est cabossée. Si le crime a eu lieu dans la salle des machines, ce n'était pas avec la gaffe.",
    concerne: ['salle_machines', 'gaffe'],
    regles: [pas('salle_machines', 'gaffe')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-28',
    titre: 'Le linoléum ciré',
    categorie: 'trace',
    texte:
      "Le linoléum blanc du poste de radio a été ciré à 22 h. La statuette d'Anubis perd sa poussière ocre au moindre mouvement : on n'en trouve pas un grain sur le sol. Si le crime a eu lieu dans le poste de radio, ce n'était pas avec la statuette.",
    concerne: ['poste_radio', 'statuette'],
    regles: [pas('poste_radio', 'statuette')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-29',
    titre: 'Whisky et cognac',
    categorie: 'temoignage',
    texte:
      "Au fumoir, on ne sert que du whisky et du cognac : le champagne n'y entre jamais, et le barman, qui sert lui-même chaque verre, n'a vu aucune coupe de la nuit. Si le crime a eu lieu au fumoir, ce n'était pas avec la coupe de champagne.",
    concerne: ['fumoir', 'champagne'],
    regles: [pas('fumoir', 'champagne')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-30',
    titre: 'Les portes étroites',
    categorie: 'trace',
    texte:
      "Pour entrer dans la suite avec une gaffe de trois mètres, il aurait fallu la passer en biais par des portes étroites aux boiseries fragiles. L'acajou est sans une rayure, le lustre sans un choc. Si le crime a eu lieu dans la suite, ce n'était pas avec la gaffe.",
    concerne: ['suite', 'gaffe'],
    regles: [pas('suite', 'gaffe')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-31',
    titre: 'Pas de verre au bord du bassin',
    categorie: 'objet',
    texte:
      "Un règlement affiché à l'entrée de la piscine interdit tout verre au bord du bassin, pour épargner les pieds nus ; le maître-nageur confisque la moindre coupe. Ce soir encore, il n'en a laissé passer aucune. Si le crime a eu lieu dans la piscine couverte, ce n'était pas avec la coupe de champagne.",
    concerne: ['piscine', 'champagne'],
    regles: [pas('piscine', 'champagne')],
    disponibleDesManche: 1,
  },

  // --- Témoignages partiels : une trace qui désigne deux coupables possibles ---
  {
    id: 'PQ-32',
    titre: 'La grille de la salle des machines',
    categorie: 'objet',
    texte:
      "La salle des machines est fermée par une grille dont le cadenas n'a pas été forcé. Deux clés seulement existent à bord, hors celles des mécaniciens : celle du second, et celle de Rose, qui relève les compteurs de la dynamo. Si le crime a eu lieu dans la salle des machines, le coupable est l'un des deux.",
    concerne: ['salle_machines', 'rose', 'legoff'],
    regles: deuxSuspects('salle_machines', ['rose', 'legoff']),
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-33',
    titre: 'Le rouge carmin',
    categorie: 'trace',
    texte:
      "Sur une table du fumoir, un verre de cognac porte un rouge à lèvres carmin, laissé après minuit. Seules Hélène et la comtesse portent ce rouge, acheté le même jour chez le même parfumeur de la rue de la Paix. Si le crime a eu lieu au fumoir, la coupable est l'une des deux.",
    concerne: ['fumoir', 'helene', 'isabella'],
    regles: deuxSuspects('fumoir', ['helene', 'isabella']),
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-34',
    titre: 'Le coffret du sextant',
    categorie: 'objet',
    texte:
      "Le sextant a été sorti de son coffret, dont le fermoir à secret est celui des instruments de la marine française ; les officiers de l'Aurélia, eux, se servent de modèles anglais. Deux personnes seulement à bord ont appris sur ce modèle : le professeur Bréval, qui s'oriente aux étoiles dans le désert, et Max, ancien de l'École navale. Si l'arme est le sextant, le coupable est l'un des deux.",
    concerne: ['sextant', 'breval', 'max'],
    regles: deuxSuspects('sextant', ['breval', 'max']),
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-35',
    titre: 'La sûreté du lance-fusées',
    categorie: 'document',
    texte:
      "Le pistolet lance-fusées de l'Aurélia est un modèle anglais dont la sûreté se débloque à l'envers. Deux personnes seulement savent le manier : le second, et la comtesse, qui donnait le départ des régates à Venise. Si l'arme est le pistolet lance-fusées, le coupable est l'un des deux.",
    concerne: ['lance_fusees', 'isabella', 'legoff'],
    regles: deuxSuspects('lance_fusees', ['isabella', 'legoff']),
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-36',
    titre: 'Les cigarettes américaines',
    categorie: 'trace',
    texte:
      "Sur le pont promenade, au pied d'une chaise longue, trois mégots de cigarettes américaines, de la même marque. Seuls Max et Rose fument ces cigarettes à bord. Si le crime a eu lieu sur le pont promenade, le coupable est l'un des deux.",
    concerne: ['pont', 'max', 'rose'],
    regles: deuxSuspects('pont', ['max', 'rose']),
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-37',
    titre: 'Le gant de chevreau',
    categorie: 'trace',
    texte:
      "Sur le socle de la statuette, dans la poussière ocre, l'empreinte d'un gant de chevreau très fin. Deux personnes seulement en portent à bord : le second, avec son uniforme de soirée, et Hélène, qui ne chante jamais sans eux. Si l'arme est la statuette, le coupable est l'un des deux.",
    concerne: ['statuette', 'legoff', 'helene'],
    regles: deuxSuspects('statuette', ['legoff', 'helene']),
    disponibleDesManche: 1,
  },

  // --- Le journal d'Édouard : sept pages, du 3 au 9 juin ---
  {
    id: 'PQ-38',
    titre: "Journal d'Édouard — 3 juin",
    categorie: 'journal',
    texte:
      "« La Ricci m'a giflé ce soir au casino de Deauville, devant tout le monde. J'ai prévenu le commissaire de bord : le steward a ordre de ne jamais la laisser entrer dans ma suite pendant la traversée. Elle paiera cette gifle au centuple. »",
    concerne: ['isabella', 'suite'],
    regles: [pas('isabella', 'suite')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-39',
    titre: "Journal d'Édouard — 4 juin",
    categorie: 'journal',
    texte:
      "« Embarquement au Havre. Le Goff m'accueille à la coupée, la main droite toujours raide depuis l'accident du treuil : il ne peut plus tenir un sextant, c'est le troisième officier qui fait le point. Et il voudrait commander mon plus beau navire ! »",
    concerne: ['legoff', 'sextant'],
    regles: [pas('legoff', 'sextant')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-40',
    titre: "Journal d'Édouard — 5 juin",
    categorie: 'journal',
    texte:
      "« Hélène refuse d'approcher la piscine : le chlore et l'humidité, dit-elle, lui gâtent la voix. Elle fait un détour par le pont des embarcations pour ne pas passer devant. Ma découverte a des caprices de diva. »",
    concerne: ['helene', 'piscine'],
    regles: [pas('helene', 'piscine')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-41',
    titre: "Journal d'Édouard — 6 juin",
    categorie: 'journal',
    texte:
      "« La petite Tanner a juré à sa mère, une ligue de tempérance de Boston, de ne jamais toucher une goutte d'alcool. Elle refuse même de servir une coupe aux passagers : le commissaire a dû l'en dispenser. Une Américaine qui ne boit pas, voilà une curiosité. »",
    concerne: ['rose', 'champagne'],
    regles: [pas('rose', 'champagne')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-42',
    titre: "Journal d'Édouard — 7 juin",
    categorie: 'journal',
    texte:
      "« Bréval tousse à fendre l'âme. Le médecin de bord lui interdit l'air humide du large : plus un pas sur les ponts découverts jusqu'à New York. Il restera dans sa cabine avec ses momies. »",
    concerne: ['breval', 'pont'],
    regles: [pas('breval', 'pont')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-43',
    titre: "Journal d'Édouard — 8 juin",
    categorie: 'journal',
    texte:
      "« Delaroche joue les anciens marins, mais il m'a avoué ce soir que la guerre l'a rendu incapable d'entendre une détonation sans trembler. Il quitte le pont dès qu'on parle d'exercice de détresse. Un joueur qui bluffe jusque sur ses états de service. »",
    concerne: ['max', 'lance_fusees'],
    regles: [pas('max', 'lance_fusees')],
    disponibleDesManche: 1,
  },
  {
    id: 'PQ-44',
    titre: "Journal d'Édouard — 9 juin",
    categorie: 'journal',
    texte:
      "« Le brouillard tombe. J'ai exigé du chef mécanicien qu'aucun outil de chauffe ne monte jamais jusqu'au poste de radio : on y craint l'incendie plus que tout. Il a promis : les tisonniers ne quittent pas les chaudières. »",
    concerne: ['poste_radio', 'tisonnier'],
    regles: [pas('poste_radio', 'tisonnier')],
    disponibleDesManche: 1,
  },
];

/** Faux indices de la ruse « Dossier trafiqué » pour le paquebot. */
export const FAUX_INDICES_PAQUEBOT: CarteIndice[] = genererFauxIndices(
  PAQUEBOT,
  { personnages: PERSONNAGES_PAQUEBOT, lieux: LIEUX_PAQUEBOT, armes: ARMES_PAQUEBOT },
  {
    prefixe: 'FAUX-P',
    titrePage: (n) => `Journal d'Édouard — ${3 + n} juin`,
    prenoms: { helene: 'Hélène', legoff: 'Le Goff', isabella: 'la Ricci', breval: 'Bréval', rose: 'la petite Tanner', max: 'Delaroche' },
    pageSuspectLieu: (prenom, lieu) =>
      `« Ce soir, ${prenom} m'a juré de ne jamais mettre les pieds ${lieu} de toute la traversée. Je l'ai noté, comme je note tout : un jour, cela pourra servir. »`,
    pageSuspectArme: (prenom, arme) =>
      `« J'ai fait mettre ${arme} sous clé, et ${prenom} ignore tout de la cachette. Une précaution de plus : sur ce navire, je ne compte plus mes ennemis. »`,
    pageLieuArme: (lieu, arme) =>
      `« J'ai exigé du commissaire de bord qu'on retire ${arme} : il n'y a plus rien de tel ${lieu}, et nous sommes seuls, lui et moi, à savoir où c'est rangé. »`,
  },
);
