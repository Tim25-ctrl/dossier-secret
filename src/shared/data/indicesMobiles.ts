// Indices sur les mobiles (mode « Grande enquête » seulement : une partie classique ne les tire jamais).
//
// Même principe que les autres indices : chaque carte relie deux éléments (« si X est coupable,
// ce n'est pas par jalousie »), sans rien écarter à elle seule. Pour chaque histoire :
//   - 6 documents ou témoignages « suspect + mobile » ;
//   - 3 pages du carnet de la victime « suspect + mobile » ;
//   - 3 témoignages partiels « si le mobile est X, le coupable est A ou B ».
// Les paires écartées ne contredisent jamais la fiche d'un suspect (la raison qu'il avait d'en
// vouloir à la victime reste toujours possible).

import { elementsDe, type CarteIndice, type ElementId, type MobileId, type SuspectId } from '../types';
import { seulsSuspects } from './fauxIndices';

const pas = (a: ElementId, b: ElementId) => ({ type: 'pasEnsemble', a, b }) as const;
const deux = (affaire: 'manoir' | 'train' | 'paquebot') => (mobile: MobileId, suspects: SuspectId[]) =>
  seulsSuspects(elementsDe(affaire).suspects, mobile, suspects);

const deuxManoir = deux('manoir');
const deuxTrain = deux('train');
const deuxPaquebot = deux('paquebot');

export const INDICES_MOBILES_MANOIR: CarteIndice[] = [
  {
    id: 'MM-01',
    titre: 'Les fiançailles de Monsieur',
    categorie: 'temoignage',
    texte:
      "La femme de chambre est formelle : Éléonore se moquait bien des fiançailles de son père avec la veuve Darcourt, elle en riait même au dîner. Si Éléonore est coupable, ce n'est pas par jalousie.",
    concerne: ['eleonore', 'manoir_jalousie'],
    regles: [pas('eleonore', 'manoir_jalousie')],
    disponibleDesManche: 1,
  },
  {
    id: 'MM-02',
    titre: 'Le registre de la société',
    categorie: 'document',
    texte:
      "Le registre de la société montre que Victor n'est entré au service d'Armand qu'il y a deux ans, arrivé de Lyon : il ne connaît de la famille Valombre que ce qu'en disent les journaux. Si Victor est coupable, ce n'est pas pour protéger un secret de famille.",
    concerne: ['victor', 'manoir_secret'],
    regles: [pas('victor', 'manoir_secret')],
    disponibleDesManche: 1,
  },
  {
    id: 'MM-03',
    titre: 'Les comptes du docteur',
    categorie: 'document',
    texte:
      "Les comptes du docteur Morel, rangés dans sa sacoche, sont tenus au centime près : aucun créancier, aucune dette, pas même chez le tailleur. Il ne touche jamais aux cartes. Si le docteur est coupable, ce n'est pas pour effacer une dette de jeu.",
    concerne: ['morel', 'manoir_dette'],
    regles: [pas('morel', 'manoir_dette')],
    disponibleDesManche: 1,
  },
  {
    id: 'MM-04',
    titre: 'La lettre du notaire',
    categorie: 'document',
    texte:
      "Une lettre de Maître Ferrand rappelle à Armand qu'aucun de ses domestiques ne figure à son testament, « conformément à vos instructions ». Étienne en avait reçu copie. Si Étienne Marchand est coupable, ce n'est pas pour l'héritage.",
    concerne: ['marchand', 'manoir_heritage'],
    regles: [pas('marchand', 'manoir_heritage')],
    disponibleDesManche: 1,
  },
  {
    id: 'MM-05',
    titre: 'Les lettres du soir',
    categorie: 'temoignage',
    texte:
      "Camille n'est au manoir que depuis cinq jours, et le jardinier l'a vue écrire chaque soir à un fiancé resté à Paris. Personne ici ne pouvait lui inspirer de jalousie. Si Camille est coupable, ce n'est pas par jalousie.",
    concerne: ['camille', 'manoir_jalousie'],
    regles: [pas('camille', 'manoir_jalousie')],
    disponibleDesManche: 1,
  },
  {
    id: 'MM-06',
    titre: 'La chance de Gabriel',
    categorie: 'temoignage',
    texte:
      "Cet été, Gabriel a gagné gros au casino de Deauville : le croupier qui l'a vu repartir les poches pleines est le cousin du cuisinier. Il ne devait rien à personne. Si Gabriel est coupable, ce n'est pas pour effacer une dette de jeu.",
    concerne: ['gabriel', 'manoir_dette'],
    regles: [pas('gabriel', 'manoir_dette')],
    disponibleDesManche: 1,
  },
  {
    id: 'MM-07',
    titre: "Journal d'Armand — 12 octobre",
    categorie: 'journal',
    texte:
      "« J'ai présenté Victor à la veuve Darcourt : il ne lui a parlé que du cours du cuivre. Cet homme ne connaîtra jamais la jalousie, seulement l'avidité. »",
    concerne: ['victor', 'manoir_jalousie'],
    regles: [pas('victor', 'manoir_jalousie')],
    disponibleDesManche: 1,
  },
  {
    id: 'MM-08',
    titre: "Journal d'Armand — 14 octobre",
    categorie: 'journal',
    texte:
      "« Lucien me doit sa clientèle, sa maison, jusqu'à sa réputation. Il me sait gré de tout : la rancune n'est pas dans son caractère, et il n'a aucune raison d'en nourrir contre moi. »",
    concerne: ['morel', 'manoir_vengeance'],
    regles: [pas('morel', 'manoir_vengeance')],
    disponibleDesManche: 1,
  },
  {
    id: 'MM-09',
    titre: "Journal d'Armand — 16 octobre",
    categorie: 'journal',
    texte:
      "« Mademoiselle Vasseur m'a demandé, avec un aplomb rare, qui hériterait du manoir. Je lui ai répondu : certainement pas une journaliste. Elle a ri. Elle ne cherche pas l'argent, elle cherche une histoire. »",
    concerne: ['camille', 'manoir_heritage'],
    regles: [pas('camille', 'manoir_heritage')],
    disponibleDesManche: 1,
  },
  {
    id: 'MM-10',
    titre: 'Le brouillon du testament',
    categorie: 'document',
    texte:
      "Dans la corbeille du bureau, un brouillon de testament à moitié brûlé. Seuls deux noms y sont rayés, ceux qui avaient tout à perdre : Éléonore et Gabriel. Si le mobile est l'héritage, le coupable est Éléonore ou Gabriel.",
    concerne: ['manoir_heritage', 'eleonore', 'gabriel'],
    regles: deuxManoir('manoir_heritage', ['eleonore', 'gabriel']),
    disponibleDesManche: 3,
  },
  {
    id: 'MM-11',
    titre: 'La boîte à cigares',
    categorie: 'objet',
    texte:
      "Dans le double fond d'une boîte à cigares, Armand gardait deux enveloppes cachetées : l'une au nom du docteur Morel, l'autre à celui de Gabriel Roche. Il ne faisait chanter personne d'autre. Si le mobile est le chantage, le coupable est le docteur Morel ou Gabriel.",
    concerne: ['manoir_chantage', 'morel', 'gabriel'],
    regles: deuxManoir('manoir_chantage', ['morel', 'gabriel']),
    disponibleDesManche: 3,
  },
  {
    id: 'MM-12',
    titre: 'La page arrachée',
    categorie: 'document',
    texte:
      "La page disparue des archives familiales a été retrouvée glissée dans la reliure d'un missel : elle parle d'une enfant née hors mariage et confiée en secret à une nourrice. Seules Éléonore et Camille avaient approché ces archives cette semaine. Si le mobile est un secret de famille, le coupable est Éléonore ou Camille.",
    concerne: ['manoir_secret', 'eleonore', 'camille'],
    regles: deuxManoir('manoir_secret', ['eleonore', 'camille']),
    disponibleDesManche: 3,
  },
];

export const INDICES_MOBILES_TRAIN: CarteIndice[] = [
  {
    id: 'MT-01',
    titre: 'Les billets de Vallorbe',
    categorie: 'temoignage',
    texte:
      "Le douanier de Vallorbe a compté les billets dans le sac d'Irina : de quoi acheter le wagon entier. Ses saisons à Paris lui ont rapporté une fortune. Si Irina est coupable, ce n'est pas pour éviter la faillite.",
    concerne: ['irina', 'train_faillite'],
    regles: [pas('irina', 'train_faillite')],
    disponibleDesManche: 1,
  },
  {
    id: 'MT-02',
    titre: 'La photographie du colonel',
    categorie: 'objet',
    texte:
      "Dans le portefeuille du colonel, la photographie de sa femme, morte en 1919, et une lettre où il jure de ne jamais se remarier. Le barman confirme : il ne parle qu'à son chien. Si le colonel est coupable, ce n'est pas par amour trahi.",
    concerne: ['hector', 'train_amour'],
    regles: [pas('hector', 'train_amour')],
    disponibleDesManche: 1,
  },
  {
    id: 'MT-03',
    titre: 'Les annonces du chef de train',
    categorie: 'temoignage',
    texte:
      "Mathilde ne parle aucune langue étrangère et n'avait jamais quitté la France avant ce voyage : le chef de train a dû lui traduire chaque annonce. Des documents secrets n'auraient eu aucune valeur pour elle. Si Mathilde est coupable, ce n'est pas pour des documents secrets.",
    concerne: ['mathilde', 'train_espionnage'],
    regles: [pas('mathilde', 'train_espionnage')],
    disponibleDesManche: 1,
  },
  {
    id: 'MT-04',
    titre: 'Le registre des équipages',
    categorie: 'document',
    texte:
      "Lucas n'est au service des wagons-lits que depuis l'automne, et le registre des équipages prouve qu'il n'avait jamais croisé Octave avant le départ de Paris. Si Lucas est coupable, ce n'est pas par vengeance.",
    concerne: ['lucas', 'train_vengeance'],
    regles: [pas('lucas', 'train_vengeance')],
    disponibleDesManche: 1,
  },
  {
    id: 'MT-05',
    titre: 'Ce que veut dire « Simplon »',
    categorie: 'temoignage',
    texte:
      "Margaret a passé la soirée à demander au barman ce que voulait dire « Simplon ». Les secrets d'État l'ennuient à mourir, dit-elle, comme tout ce qui ne s'imprime pas dans les magazines de mode. Si Margaret est coupable, ce n'est pas pour des documents secrets.",
    concerne: ['margaret', 'train_espionnage'],
    regles: [pas('margaret', 'train_espionnage')],
    disponibleDesManche: 1,
  },
  {
    id: 'MT-06',
    titre: 'Le livret de caisse d’épargne',
    categorie: 'document',
    texte:
      "Paul n'a jamais été payé par Octave ni chargé de ses affaires : son livret de caisse d'épargne ne montre que ses droits d'auteur, versés par l'éditeur. Si Paul est coupable, ce n'est pas pour l'argent volé.",
    concerne: ['paul', 'train_argent'],
    regles: [pas('paul', 'train_argent')],
    disponibleDesManche: 1,
  },
  {
    id: 'MT-07',
    titre: "Carnet d'Octave — 4 mars",
    categorie: 'journal',
    texte:
      "« Brassac a encore refusé l'argent que je lui offrais pour son rapport. Ce vieil entêté ne touche pas à un sou qui ne soit pas le sien : il préfère mourir pauvre et honorable. »",
    concerne: ['hector', 'train_argent'],
    regles: [pas('hector', 'train_argent')],
    disponibleDesManche: 1,
  },
  {
    id: 'MT-08',
    titre: "Carnet d'Octave — 6 mars",
    categorie: 'journal',
    texte:
      "« La petite Lowell me croit son ami. Elle ignore tout de ce que je sais, et c'est tant mieux : elle n'a aucune raison de m'en vouloir. Pas encore. »",
    concerne: ['margaret', 'train_vengeance'],
    regles: [pas('margaret', 'train_vengeance')],
    disponibleDesManche: 1,
  },
  {
    id: 'MT-09',
    titre: "Carnet d'Octave — 8 mars",
    categorie: 'journal',
    texte:
      "« Agnel vient de signer un contrat mirobolant pour son prochain roman. L'argent ne lui manquera plus jamais. Il lui reste à craindre autre chose que la ruine… »",
    concerne: ['paul', 'train_faillite'],
    regles: [pas('paul', 'train_faillite')],
    disponibleDesManche: 1,
  },
  {
    id: 'MT-10',
    titre: 'Le carnet noir',
    categorie: 'objet',
    texte:
      "Dans la doublure du manteau d'Octave, un carnet noir : des initiales, des dates, des sommes versées chaque mois. Deux noms seulement y paient encore : la Volkova et Agnel. Si le mobile est le chantage, le coupable est Irina ou Paul.",
    concerne: ['train_chantage', 'irina', 'paul'],
    regles: deuxTrain('train_chantage', ['irina', 'paul']),
    disponibleDesManche: 3,
  },
  {
    id: 'MT-11',
    titre: 'Le télégramme de la banque',
    categorie: 'document',
    texte:
      "Un télégramme de la Banque de Genève confirme qu'Octave a refusé cette semaine deux demandes de prêt pressantes : celle de Margaret Lowell et celle de Mathilde Fersen. Si le mobile est la faillite, le coupable est Margaret ou Mathilde.",
    concerne: ['train_faillite', 'margaret', 'mathilde'],
    regles: deuxTrain('train_faillite', ['margaret', 'mathilde']),
    disponibleDesManche: 3,
  },
  {
    id: 'MT-12',
    titre: 'La serviette de cuir',
    categorie: 'temoignage',
    texte:
      "La serviette d'Octave contenait des plans de fortifications alpines. Deux voyageurs seulement savaient qu'ils existaient : le colonel, qui les a reconnus au dîner, et Lucas, qui portait la serviette. Si le mobile est l'espionnage, le coupable est le colonel ou Lucas.",
    concerne: ['train_espionnage', 'hector', 'lucas'],
    regles: deuxTrain('train_espionnage', ['hector', 'lucas']),
    disponibleDesManche: 3,
  },
];

export const INDICES_MOBILES_PAQUEBOT: CarteIndice[] = [
  {
    id: 'MP-01',
    titre: "L'odeur du mazout",
    categorie: 'temoignage',
    texte:
      "Hélène n'est jamais descendue dans les cales : le maître d'équipage note chaque passage, et elle a horreur de l'odeur du mazout. Si Hélène est coupable, ce n'est pas pour couvrir une contrebande.",
    concerne: ['helene', 'paquebot_contrebande'],
    regles: [pas('helene', 'paquebot_contrebande')],
    disponibleDesManche: 1,
  },
  {
    id: 'MP-02',
    titre: 'Le bal du commandant',
    categorie: 'temoignage',
    texte:
      "Le Goff vit à bord depuis vingt ans, sans femme ni fiancée. Le bal du commandant l'ennuie : il y passe dix minutes par politesse et retourne à la passerelle. Si le second est coupable, ce n'est pas par jalousie.",
    concerne: ['legoff', 'paquebot_jalousie'],
    regles: [pas('legoff', 'paquebot_jalousie')],
    disponibleDesManche: 1,
  },
  {
    id: 'MP-03',
    titre: 'La copie du testament',
    categorie: 'document',
    texte:
      "Une copie du testament d'Édouard, rangée dans le coffre de la suite, ne mentionne pas la comtesse : elle n'est ni sa parente ni sa légataire. Si la comtesse est coupable, ce n'est pas pour l'héritage.",
    concerne: ['isabella', 'paquebot_heritage'],
    regles: [pas('isabella', 'paquebot_heritage')],
    disponibleDesManche: 1,
  },
  {
    id: 'MP-04',
    titre: 'Les hiéroglyphes du bal',
    categorie: 'temoignage',
    texte:
      "Le professeur ne vit que pour ses momies. Au bal, il a passé la soirée à expliquer les hiéroglyphes à un garçon d'ascenseur, sans un regard pour la piste de danse. Si le professeur est coupable, ce n'est pas par jalousie.",
    concerne: ['breval', 'paquebot_jalousie'],
    regles: [pas('breval', 'paquebot_jalousie')],
    disponibleDesManche: 1,
  },
  {
    id: 'MP-05',
    titre: "L'engagement de Rose",
    categorie: 'document',
    texte:
      "Le contrat de Rose avec la compagnie de radiotélégraphie date de la veille du départ : elle n'avait jamais entendu parler d'Édouard avant de lire son nom sur un télégramme. Si Rose est coupable, ce n'est pas par vengeance.",
    concerne: ['rose', 'paquebot_vengeance'],
    regles: [pas('rose', 'paquebot_vengeance')],
    disponibleDesManche: 1,
  },
  {
    id: 'MP-06',
    titre: 'Les nuits de baccara',
    categorie: 'temoignage',
    texte:
      "Depuis le départ, Max n'a pas quitté les salons de jeu : le chef steward l'a vu chaque nuit à la table de baccara jusqu'à l'aube. Les cales, il ne sait même pas où elles se trouvent. Si Max est coupable, ce n'est pas pour couvrir une contrebande.",
    concerne: ['max', 'paquebot_contrebande'],
    regles: [pas('max', 'paquebot_contrebande')],
    disponibleDesManche: 1,
  },
  {
    id: 'MP-07',
    titre: "Journal d'Édouard — 4 juin",
    categorie: 'journal',
    texte:
      "« Le Goff ne sait rien de mes polices d'assurance, et n'y figure pas : je ne laisse rien à ceux qui me servent. Il le sait, et il me sert quand même. »",
    concerne: ['legoff', 'paquebot_assurance'],
    regles: [pas('legoff', 'paquebot_assurance')],
    disponibleDesManche: 1,
  },
  {
    id: 'MP-08',
    titre: "Journal d'Édouard — 6 juin",
    categorie: 'journal',
    texte:
      "« Bréval me demande sans cesse quand le musée recevra la collection. Il se moque bien de ma fortune et de ce qu'elle deviendra après moi ; il ne pense qu'à ses vieilles pierres. »",
    concerne: ['breval', 'paquebot_heritage'],
    regles: [pas('breval', 'paquebot_heritage')],
    disponibleDesManche: 1,
  },
  {
    id: 'MP-09',
    titre: "Journal d'Édouard — 8 juin",
    categorie: 'journal',
    texte:
      "« La petite Tanner ne regarde personne à bord : elle a un fiancé à New York, m'a dit le commissaire, et compte les jours jusqu'à l'arrivée. »",
    concerne: ['rose', 'paquebot_jalousie'],
    regles: [pas('rose', 'paquebot_jalousie')],
    disponibleDesManche: 1,
  },
  {
    id: 'MP-10',
    titre: 'La police de la Lloyd',
    categorie: 'document',
    texte:
      "Dans le coffre de la suite, une police d'assurance sur la vie d'Édouard, signée en avril. Deux bénéficiaires seulement : la comtesse Ricci, « en garantie d'un prêt », et Hélène Marceau. Si le mobile est la prime d'assurance, le coupable est la comtesse ou Hélène.",
    concerne: ['paquebot_assurance', 'isabella', 'helene'],
    regles: deuxPaquebot('paquebot_assurance', ['isabella', 'helene']),
    disponibleDesManche: 3,
  },
  {
    id: 'MP-11',
    titre: 'Les caisses sans étiquette',
    categorie: 'objet',
    texte:
      "Dans la salle des machines, deux caisses sans étiquette : des statuettes emballées dans de la paille, et un émetteur radio de fortune. Le registre de chargement ne cite que deux noms, Bréval et Rose Tanner. Si le mobile est la contrebande, le coupable est le professeur ou Rose.",
    concerne: ['paquebot_contrebande', 'breval', 'rose'],
    regles: deuxPaquebot('paquebot_contrebande', ['breval', 'rose']),
    disponibleDesManche: 3,
  },
  {
    id: 'MP-12',
    titre: 'Le courrier refusé',
    categorie: 'document',
    texte:
      "Le commissaire de bord a retrouvé deux lettres de menace dans le courrier qu'Édouard refusait d'ouvrir : l'une signée du second, l'autre de Max Delaroche. Personne d'autre à bord n'avait de compte à régler avec lui. Si le mobile est la vengeance, le coupable est le second ou Max.",
    concerne: ['paquebot_vengeance', 'legoff', 'max'],
    regles: deuxPaquebot('paquebot_vengeance', ['legoff', 'max']),
    disponibleDesManche: 3,
  },
];
