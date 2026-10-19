// L'affaire du Manoir des Brumes : personnages, lieux et armes.
// Données publiques (fiches du dossier). La solution n'est JAMAIS ici :
// elle est tirée au sort par le serveur au début de chaque partie.

import type { ArmeId, ElementId, LieuId, SuspectId } from '../types';

export const AFFAIRE = {
  id: 'manoir-des-brumes',
  titre: "L'affaire du Manoir des Brumes",
  victime: 'Armand de Valombre',
  resume: [
    'Le 17 octobre, à 23 h 17, Armand de Valombre, riche collectionneur, est retrouvé mort dans son bureau. Une violente tempête isole son vieux manoir du reste du monde.',
    "Six personnes se trouvaient au manoir ce soir-là. Toutes avaient une raison de lui en vouloir. Toutes cachent un secret. Plusieurs ont menti sur leurs déplacements.",
    "Le légiste situe la mort entre 22 h 50 et 23 h 10. Le corps a été découvert dans le bureau, mais rien ne prouve que le crime y ait été commis.",
    "Parmi vous se cache un complice : il connaît le nom du meurtrier et fera tout pour que l'enquête échoue.",
  ],
  fenetreCrime: { de: '22:50', a: '23:10' },
};

export interface FichePersonnage {
  id: SuspectId;
  nom: string;
  titre: string;
  description: string;
  histoire: string;
  relation: string;
  mobile: string;
  secret: string;
  alibi: string;
  connaissances: string;
  /** Phrase utilisée dans l'explication finale lorsque ce personnage est coupable. */
  aveu: string;
  couleur: string;
}

export const PERSONNAGES: Record<SuspectId, FichePersonnage> = {
  eleonore: {
    id: 'eleonore',
    nom: 'Éléonore de Valombre',
    titre: "l'héritière",
    description: "Fille unique d'Armand, élégante et tranchante, elle gère déjà une partie du domaine.",
    histoire:
      "Élevée au manoir après la mort de sa mère, Éléonore a passé sa vie à attendre que son père lui confie les clés de la collection. Elle a étudié l'histoire de l'art à Paris et rêve de vendre le manoir.",
    relation: 'Sa fille. Leurs rapports étaient glacials depuis deux ans.',
    mobile: "Elle a appris que son père avait modifié son testament au profit d'une fondation.",
    secret: 'Elle a contracté des dettes de jeu importantes à Deauville.',
    alibi: "Elle affirme avoir passé la soirée dans la bibliothèque, mais son récit reste flou sur les horaires.",
    connaissances: 'Connaît le contenu de l\'ancien testament et le nom du notaire, Maître Ferrand.',
    aveu: "Éléonore ne supportait pas l'idée de voir l'héritage de sa mère partir à une fondation. Elle a rejoint son père pour une dernière discussion, qui a mal tourné.",
    couleur: '#b65c6b',
  },
  victor: {
    id: 'victor',
    nom: 'Victor Delorme',
    titre: "l'associé",
    description: "Homme d'affaires affable, toujours un cigare à la main, partenaire d'Armand depuis quinze ans.",
    histoire:
      "Victor a fait fortune avec Armand dans le commerce d'antiquités. Depuis un an, plusieurs ventes à l'étranger se sont révélées douteuses et les comptes ne tombent plus juste.",
    relation: "Associé commercial et partenaire de chasse d'Armand.",
    mobile: 'Des documents laissent penser que certaines transactions ont été falsifiées ; Armand menaçait de porter plainte.',
    secret: 'Il a vendu des copies en les faisant passer pour des originaux.',
    alibi: 'Il affirme avoir travaillé dans le petit salon avant et après le dîner.',
    connaissances: 'Sait où Armand rangeait les livres de comptes et les certificats d\'authenticité.',
    aveu: "Victor savait qu'Armand allait le dénoncer à la première heure. Il a tenté de récupérer les preuves, et Armand l'a surpris.",
    couleur: '#c08a3e',
  },
  morel: {
    id: 'morel',
    nom: 'Docteur Lucien Morel',
    titre: 'le médecin',
    description: 'Médecin de famille réservé, passionné de botanique, il vient au manoir chaque semaine.',
    histoire:
      "Lucien Morel soigne les Valombre depuis vingt ans. Il entretient la serre du manoir, où il cultive des plantes rares. On le dit discret, presque trop.",
    relation: "Médecin personnel et confident d'Armand.",
    mobile: "Armand menaçait de révéler une ancienne erreur médicale qui pourrait lui coûter sa carrière.",
    secret: "Il a eu une consultation confidentielle avec Armand l'après-midi même et refuse d'en révéler la teneur.",
    alibi: 'Il prétend être resté dans la serre une grande partie de la soirée.',
    connaissances: "Connaît l'état de santé exact d'Armand et l'heure à laquelle il prenait ses médicaments.",
    aveu: "Le docteur Morel ne pouvait pas laisser Armand ruiner trente ans de carrière. Leur dernière conversation fut la plus courte.",
    couleur: '#6f9e7a',
  },
  marchand: {
    id: 'marchand',
    nom: 'Étienne Marchand',
    titre: 'le majordome',
    description: 'Majordome impeccable, au service des Valombre depuis trente ans ; il connaît chaque couloir et chaque clé.',
    histoire:
      "Entré au manoir à seize ans, Étienne Marchand connaît les passages dérobés, les trousseaux et les habitudes de chacun. Armand venait de lui annoncer son renvoi sans pension.",
    relation: 'Son majordome, presque un membre de la famille.',
    mobile: 'Il venait d\'être congédié sans pension après trente ans de service.',
    secret: "Il reconnaît avoir déplacé un objet après avoir entendu un bruit, mais minimise l'importance de ce geste.",
    alibi: "Il dit avoir servi les invités, répondu aux sonnettes et fermé les portes, comme chaque soir.",
    connaissances: 'Détient toutes les clés du manoir et sait quelles portes étaient fermées.',
    aveu: "Trente ans de loyauté effacés d'un mot : Étienne Marchand a profité de sa connaissance parfaite du manoir pour agir sans être vu.",
    couleur: '#7d8aa8',
  },
  camille: {
    id: 'camille',
    nom: 'Camille Vasseur',
    titre: 'la journaliste',
    description: 'Journaliste tenace, carnet toujours ouvert, invitée sous prétexte d\'écrire un portrait du collectionneur.',
    histoire:
      "Camille Vasseur enquête depuis des semaines sur la provenance de la collection Valombre. Elle soupçonne des pièces volées pendant la guerre.",
    relation: "Invitée d'Armand, qui croyait pouvoir contrôler son article.",
    mobile: "Armand avait découvert sa véritable enquête et menaçait de la faire licencier.",
    secret: 'Plusieurs pages des archives familiales ont disparu depuis son arrivée.',
    alibi: 'Elle affirme avoir consulté les archives familiales au grenier.',
    connaissances: "Connaît l'origine douteuse de plusieurs objets de la collection.",
    aveu: "Camille tenait le scoop de sa vie. Lorsqu'Armand a voulu détruire ses preuves, elle n'a pas reculé.",
    couleur: '#9c7bb5',
  },
  gabriel: {
    id: 'gabriel',
    nom: 'Gabriel Roche',
    titre: "l'ancien ami",
    description: "Ami d'enfance d'Armand, revenu sans prévenir après dix ans d'absence.",
    histoire:
      "Gabriel et Armand étaient inséparables avant une brouille mystérieuse. Gabriel est revenu au manoir pour récupérer une lettre compromettante qu'Armand gardait sous clé.",
    relation: 'Ancien meilleur ami, devenu rival.',
    mobile: 'Armand le faisait chanter avec une lettre compromettante.',
    secret: 'La lettre prouve que Gabriel a été mêlé à une vieille affaire de faux testament.',
    alibi: 'Il prétend être parti avant le drame, mais personne ne confirme précisément son départ.',
    connaissances: 'Connaît les anciens passages du manoir, du temps de leur jeunesse.',
    aveu: "Gabriel n'était pas parti. Il est revenu chercher la lettre, et Armand l'attendait.",
    couleur: '#5f8fa3',
  },
};

export interface FicheLieu {
  id: LieuId;
  nom: string;
  article: string; // « dans le bureau »
  description: string;
  details: string[];
  recit: string;
  icone: string;
}

export const LIEUX_FICHES: Record<LieuId, FicheLieu> = {
  bureau: {
    id: 'bureau',
    nom: 'Le bureau',
    article: 'dans le bureau',
    description: "Pièce lambrissée où Armand traitait ses affaires. C'est là que le corps a été découvert.",
    details: ['Tapis persan épais', 'Courrier décacheté sur le sous-main', 'Cheminée encore tiède', 'Coffre-fort mural'],
    recit: "Dans le bureau, à l'abri des lambris, personne n'a rien entendu à cause de l'orage.",
    icone: 'bureau',
  },
  bibliotheque: {
    id: 'bibliotheque',
    nom: 'La bibliothèque',
    article: 'dans la bibliothèque',
    description: 'Deux étages de rayonnages, une échelle coulissante et une vitrine de pièces rares.',
    details: ['Volets intérieurs verrouillables', 'Vitrine fermée à clé', 'Lampe à pétrole', 'Échelle sur rail'],
    recit: 'Dans la bibliothèque, les rayonnages ont étouffé le moindre bruit.',
    icone: 'bibliotheque',
  },
  serre: {
    id: 'serre',
    nom: 'La serre',
    article: 'dans la serre',
    description: 'Une serre de verre et de fonte, chauffée par une chaudière capricieuse, où poussent des plantes rares.',
    details: ['Allées de sable ratissé', 'Registre de chauffe', 'Plafond de verre bas', 'Fougères géantes'],
    recit: "Dans la serre, la pluie battant sur les vitres a couvert tous les bruits.",
    icone: 'serre',
  },
  cave: {
    id: 'cave',
    nom: 'La cave',
    article: 'dans la cave',
    description: 'Voûtes de pierre, bouteilles centenaires et un soupirail donnant sur le parc.',
    details: ['Porte scellée à la cire', 'Soupirail à barreaux', 'Écho très sonore', 'Terre battue humide'],
    recit: 'Dans la cave, loin des étages, personne ne pouvait voir ce qui se passait.',
    icone: 'cave',
  },
  salle_a_manger: {
    id: 'salle_a_manger',
    nom: 'La salle à manger',
    article: 'dans la salle à manger',
    description: 'Longue table de chêne, argenterie et grande cheminée surmontée de chandeliers.',
    details: ['Cheminée monumentale', 'Bougies changées chaque soir', 'Galerie vitrée', "Desserte d'argenterie"],
    recit: 'Dans la salle à manger, une fois les bougies éteintes, la pièce était plongée dans le noir.',
    icone: 'salle_a_manger',
  },
  salon_musique: {
    id: 'salon_musique',
    nom: 'Le salon de musique',
    article: 'dans le salon de musique',
    description: 'Un piano à queue, des partitions anciennes et une panoplie d\'armes de collection au mur.',
    details: ['Housses sur les meubles', 'Panoplie murale', 'Partitions éparpillées', 'Parquet poussiéreux'],
    recit: 'Dans le salon de musique, fermé pour la saison, personne ne venait jamais.',
    icone: 'salon_musique',
  },
};

export interface FicheArme {
  id: ArmeId;
  nom: string;
  article: string; // « avec le chandelier en bronze »
  description: string;
  caracteristiques: string[];
  recit: string;
  icone: string;
}

export const ARMES_FICHES: Record<ArmeId, FicheArme> = {
  chandelier: {
    id: 'chandelier',
    nom: 'Chandelier en bronze',
    article: 'avec le chandelier en bronze',
    description: 'Lourd chandelier à trois branches, couvert de cire ivoire.',
    caracteristiques: ['Très lourd', 'Laisse des gouttes de cire', 'Habituellement dans la salle à manger'],
    recit: 'Le chandelier en bronze, lourd et anodin, ne laissait derrière lui que quelques gouttes de cire.',
    icone: 'chandelier',
  },
  coupe_papier: {
    id: 'coupe_papier',
    nom: 'Coupe-papier en argent',
    article: 'avec le coupe-papier en argent',
    description: "Lame fine et ciselée aux armes des Valombre, toujours posée sur le sous-main d'Armand.",
    caracteristiques: ['Lame fine', 'Léger et discret', 'Habituellement dans le bureau'],
    recit: 'Le coupe-papier en argent, si familier qu\'on ne le remarquait plus, a été essuyé puis reposé.',
    icone: 'coupe_papier',
  },
  revolver: {
    id: 'revolver',
    nom: 'Revolver ancien',
    article: 'avec le revolver ancien',
    description: "Revolver d'ordonnance du siècle dernier, pièce de collection.",
    caracteristiques: ['Bruyant', 'Crosse lourde', 'Exposé dans une vitrine'],
    recit: "Le revolver ancien n'a pas tiré : c'est sa lourde crosse qui a servi, sans un bruit.",
    icone: 'revolver',
  },
  dague: {
    id: 'dague',
    nom: 'Dague de collection',
    article: 'avec la dague de collection',
    description: 'Dague à garde dorée, accrochée à la panoplie du salon de musique.',
    caracteristiques: ['Lame longue', 'Garde ouvragée', 'Accrochée au mur'],
    recit: 'La dague de collection a quitté sa panoplie le temps d\'un instant, avant d\'être raccrochée.',
    icone: 'dague',
  },
  presse_papier: {
    id: 'presse_papier',
    nom: 'Presse-papier lourd',
    article: 'avec le presse-papier lourd',
    description: "Bloc de cristal massif, cadeau d'un client d'Armand.",
    caracteristiques: ['Très lourd', 'Facile à dissimuler', 'Habituellement sur le bureau'],
    recit: 'Le presse-papier, massif et transparent, a été posé ailleurs comme si de rien n\'était.',
    icone: 'presse_papier',
  },
  poison: {
    id: 'poison',
    nom: 'Fiole de poison',
    article: 'avec la fiole de poison',
    description: "Petite fiole ancienne du cabinet de curiosités. Élément purement fictif du récit.",
    caracteristiques: ['Silencieux', 'Fiole scellée à la cire', 'Exposée dans le cabinet de curiosités'],
    recit: "La fiole du cabinet de curiosités a été rebouchée et remise à sa place dans l'obscurité.",
    icone: 'poison',
  },
};

export function nomElement(id: ElementId): string {
  if (id in PERSONNAGES) return PERSONNAGES[id as SuspectId].nom;
  if (id in LIEUX_FICHES) return LIEUX_FICHES[id as LieuId].nom;
  if (id in ARMES_FICHES) return ARMES_FICHES[id as ArmeId].nom;
  return id;
}

/** Nom court (prénom pour les personnages, sans article pour les lieux). */
export function nomCourt(id: ElementId): string {
  if (id in PERSONNAGES) {
    const p = PERSONNAGES[id as SuspectId];
    return id === 'morel' ? 'Dr Morel' : p.nom.split(' ')[0];
  }
  if (id in LIEUX_FICHES) return LIEUX_FICHES[id as LieuId].nom.replace(/^(Le |La |L')/, '');
  return nomElement(id);
}
