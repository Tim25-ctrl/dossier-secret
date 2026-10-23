// Mobiles du crime, propres à chaque histoire (mode « Grande enquête » seulement).
// N'importe quel suspect peut avoir agi pour n'importe quel mobile : les fiches des suspects
// donnent une raison d'en vouloir à la victime, les indices des archives écartent des paires
// « suspect + mobile ». `recit` complète la révélation finale ({coupable} = nom du coupable).

import type { AffaireId } from '../types';
import type { FicheMobile, MobilesDe } from './modeles';

export const MOBILES_MANOIR: Record<MobilesDe<'manoir'>, FicheMobile> = {
  manoir_heritage: {
    id: 'manoir_heritage',
    nom: "L'héritage",
    article: "pour l'héritage",
    description: "Armand parlait de revoir son testament : quelqu'un craignait d'en être rayé.",
    recit: "Le mobile était l'héritage : {coupable} ne pouvait pas laisser Armand modifier son testament.",
    icone: 'testament',
  },
  manoir_jalousie: {
    id: 'manoir_jalousie',
    nom: 'La jalousie',
    article: 'par jalousie',
    description: 'Un amour contrarié, une rivalité ancienne : Armand prenait ce que les autres désiraient.',
    recit: "Le mobile était la jalousie : Armand prenait tout, et {coupable} n'a plus supporté de tout lui céder.",
    icone: 'jalousie',
  },
  manoir_vengeance: {
    id: 'manoir_vengeance',
    nom: 'La vengeance',
    article: 'par vengeance',
    description: "Une vieille blessure qu'Armand avait infligée, et que quelqu'un n'avait jamais oubliée.",
    recit: "Le mobile était la vengeance : {coupable} n'avait jamais pardonné le mal qu'Armand avait fait, il y a bien des années.",
    icone: 'gant',
  },
  manoir_dette: {
    id: 'manoir_dette',
    nom: 'Une dette de jeu',
    article: 'pour effacer une dette de jeu',
    description: 'Des reconnaissances de dette signées autour de la table de cartes, et réclamées le soir même.',
    recit: "Le mobile était une dette de jeu : Armand réclamait son dû pour le lendemain, et {coupable} n'avait pas de quoi payer.",
    icone: 'cartes',
  },
  manoir_chantage: {
    id: 'manoir_chantage',
    nom: 'Le chantage',
    article: 'pour échapper à un chantage',
    description: 'Armand savait quelque chose, et le faisait payer.',
    recit: 'Le mobile était le chantage : Armand savait tout, et {coupable} a préféré le faire taire plutôt que de payer encore.',
    icone: 'enveloppe',
  },
  manoir_secret: {
    id: 'manoir_secret',
    nom: 'Un secret de famille',
    article: 'pour protéger un secret de famille',
    description: 'Une naissance, une lettre, un nom : un secret que les Valombre gardaient depuis des années.',
    recit: 'Le mobile était un secret de famille : Armand allait tout révéler au notaire, et {coupable} ne pouvait pas le laisser faire.',
    icone: 'medaillon',
  },
};

export const MOBILES_TRAIN: Record<MobilesDe<'train'>, FicheMobile> = {
  train_espionnage: {
    id: 'train_espionnage',
    nom: "L'espionnage",
    article: 'pour des documents secrets',
    description: 'Octave transportait des papiers que plusieurs gouvernements auraient payés cher.',
    recit: "Le mobile était l'espionnage : les documents de la serviette d'Octave valaient une fortune, et {coupable} avait promis de les livrer avant la frontière.",
    icone: 'documentSecret',
  },
  train_argent: {
    id: 'train_argent',
    nom: "L'argent volé",
    article: "pour l'argent volé",
    description: "Quelqu'un puisait dans l'argent d'Octave depuis des années, et il venait de s'en apercevoir.",
    recit: "Le mobile était l'argent volé : Octave venait de découvrir qui puisait dans ses comptes, et {coupable} ne pouvait pas le laisser parler.",
    icone: 'mallette',
  },
  train_amour: {
    id: 'train_amour',
    nom: "L'amour trahi",
    article: 'par amour trahi',
    description: 'Une promesse faite, puis reniée, entre deux gares.',
    recit: "Le mobile était l'amour trahi : Octave avait fait une promesse, puis l'avait reniée, et {coupable} ne l'a pas supporté.",
    icone: 'coeurBrise',
  },
  train_vengeance: {
    id: 'train_vengeance',
    nom: 'La vengeance',
    article: 'par vengeance',
    description: "Octave avait ruiné une réputation, autrefois ; quelqu'un à bord ne l'avait pas oublié.",
    recit: "Le mobile était la vengeance : {coupable} attendait depuis des années l'occasion de faire payer à Octave une vieille humiliation.",
    icone: 'gant',
  },
  train_chantage: {
    id: 'train_chantage',
    nom: 'Le chantage',
    article: 'pour échapper à un chantage',
    description: 'Octave collectionnait les secrets des autres, et savait les monnayer.',
    recit: "Le mobile était le chantage : Octave réclamait un nouveau versement à l'arrivée, et {coupable} a choisi de ne plus jamais payer.",
    icone: 'enveloppe',
  },
  train_faillite: {
    id: 'train_faillite',
    nom: 'La faillite',
    article: 'pour éviter la faillite',
    description: "Une signature d'Octave pouvait sauver une fortune au bord du gouffre, ou la couler.",
    recit: "Le mobile était la faillite : la signature d'Octave pouvait tout sauver, il l'a refusée, et {coupable} n'avait plus rien à perdre.",
    icone: 'faillite',
  },
};

export const MOBILES_PAQUEBOT: Record<MobilesDe<'paquebot'>, FicheMobile> = {
  paquebot_assurance: {
    id: 'paquebot_assurance',
    nom: "La prime d'assurance",
    article: "pour la prime d'assurance",
    description: "Une police d'assurance sur la vie d'Édouard avait été signée en avril, pour une somme énorme.",
    recit: "Le mobile était la prime d'assurance : la police signée en avril rapportait une fortune, et {coupable} en connaissait le montant.",
    icone: 'parapluie',
  },
  paquebot_jalousie: {
    id: 'paquebot_jalousie',
    nom: 'La jalousie',
    article: 'par jalousie',
    description: 'Un regard de trop au bal du commandant, une rivalité qui couvait depuis Le Havre.',
    recit: "Le mobile était la jalousie : au bal du commandant, {coupable} a vu de trop près ce qu'Édouard avait pris.",
    icone: 'jalousie',
  },
  paquebot_chantage: {
    id: 'paquebot_chantage',
    nom: 'Le chantage',
    article: 'pour échapper à un chantage',
    description: 'Édouard gardait dans sa suite des lettres qui pouvaient briser une carrière.',
    recit: 'Le mobile était le chantage : Édouard gardait dans sa suite des lettres qui pouvaient tout briser, et {coupable} a voulu les reprendre.',
    icone: 'enveloppe',
  },
  paquebot_vengeance: {
    id: 'paquebot_vengeance',
    nom: 'La vengeance',
    article: 'par vengeance',
    description: "Les affaires d'Édouard avaient laissé derrière elles des carrières brisées et des familles ruinées.",
    recit: "Le mobile était la vengeance : Édouard avait brisé une vie, et {coupable} ne l'avait jamais oublié.",
    icone: 'gant',
  },
  paquebot_contrebande: {
    id: 'paquebot_contrebande',
    nom: 'La contrebande',
    article: 'pour couvrir une contrebande',
    description: 'Des caisses sans étiquette dans les cales, et Édouard qui posait trop de questions.',
    recit: 'Le mobile était la contrebande : Édouard avait ouvert une caisse de trop, et {coupable} ne pouvait pas le laisser arriver à New York.',
    icone: 'caisse',
  },
  paquebot_heritage: {
    id: 'paquebot_heritage',
    nom: "L'héritage",
    article: "pour l'héritage",
    description: 'La fortune Lancret attendait un héritier ; certains à bord comptaient les jours.',
    recit: "Le mobile était l'héritage : la fortune Lancret attendait un héritier, et {coupable} ne voulait plus attendre.",
    icone: 'testament',
  },
};

export const MOBILES_PAR_HISTOIRE: Record<AffaireId, Record<string, FicheMobile>> = {
  manoir: MOBILES_MANOIR,
  train: MOBILES_TRAIN,
  paquebot: MOBILES_PAQUEBOT,
};
