// Filtrage des informations : construit la vue d'UN joueur à partir de l'état
// complet. C'est la seule donnée envoyée aux navigateurs. Tout ce qui n'est pas
// explicitement copié ici reste sur le serveur (solution, mains des autres,
// rôle des autres, versions originales des hypothèses des autres, journal d'audit…).

import { INDICES_PAR_ID } from '../shared/data/indices';
import { ARMES_FICHES, LIEUX_FICHES, PERSONNAGES } from '../shared/data/manoir';
import { ceQueLIndiceEcarte, combinaisonsPossibles } from '../shared/logique';
import type { HypotheseEnCoursVue, ResultatPartie, StatutReponse, VueJoueur } from '../shared/types';
import { nbInterroges } from './config';
import { tousLesIndicesDeLAffaire } from './generateur';
import { cartesCorrespondantes, joueurActif, peutFalsifier, peutMentir, repondantActuel, type EtatPartie } from './partie';

export function vuePour(etat: EtatPartie, joueurId: string): VueJoueur {
  const moi = etat.joueurs[joueurId];
  if (!moi) throw new Error('Joueur inconnu');
  const estComplice = moi.role === 'complice';

  // Historique public ; l'auteur d'une hypothèse y voit toujours SA version originale,
  // sans aucun indice qu'elle a pu être falsifiée pour les autres.
  const mesHypotheses = new Map(etat.hypotheses.filter((h) => h.auteur === joueurId).map((h) => [h.id, h]));
  const historique = etat.historique.map((ev) => {
    if (ev.type === 'hypothese' && mesHypotheses.has(ev.id)) return { ...ev, triplet: { ...mesHypotheses.get(ev.id)!.original } };
    return ev;
  });

  const vue: VueJoueur = {
    partieId: etat.id,
    moi: {
      id: moi.id,
      nom: moi.nom,
      role: moi.role,
      main: [...moi.main],
      peutAccuser: moi.peutAccuser,
      carnet: { marques: { ...moi.carnet.marques }, notes: moi.carnet.notes },
      journal: moi.journal.map((e) => ({ ...e })),
      indicesConsultes: moi.dossiersConsultes.map((dossier) => ({
        dossier,
        indice: etat.affaire.archives.find((a) => a.dossier === dossier)!.indice,
      })),
    },
    regles: {
      manchesMax: etat.config.manchesMax,
      pointsAction: etat.config.pointsAction,
      nbInterroges: nbInterroges(etat.ordre.length),
      hypothesesMaxParTour: etat.config.hypothesesMaxParTour,
      delaiFalsificationMs: etat.config.delaiFalsificationMs,
      dureeTourMs: etat.config.delaiTourMs,
    },
    manche: etat.manche,
    joueurActif: joueurActif(etat),
    pointsAction: etat.pointsAction,
    hypothesesCeTour: etat.hypothesesCeTour,
    etape: etat.etape,
    echeanceTour: etat.echeanceTour,
    joueurs: etat.ordre.map((id) => {
      const j = etat.joueurs[id];
      return { id, nom: j.nom, connecte: j.connecte, peutAccuser: j.peutAccuser, nbCartes: j.main.length, bot: j.bot };
    }),
    cartesPubliques: [...etat.cartesPubliques],
    indicesPublics: etat.indicesPublics.map((i) => ({ ...i })),
    archives: etat.affaire.archives.map((a) => ({
      dossier: a.dossier,
      categorie: INDICES_PAR_ID[a.indice].categorie,
      disponibleDesManche: a.disponibleDesManche,
      disponible: a.disponibleDesManche <= etat.manche,
      consulte: moi.dossiersConsultes.includes(a.dossier),
    })),
    historique,
  };

  if (estComplice) {
    vue.moi.meurtrier = etat.affaire.solution.suspect;
    vue.moi.mensongesRestants = moi.mensongesRestants;
    vue.moi.falsificationsRestantes = moi.falsificationsRestantes;
  }

  const h = etat.hypothese;
  if (h && etat.etape === 'hypothese') {
    const repondant = repondantActuel(etat);
    const statuts = h.interroges.map((joueur): { joueur: string; statut: StatutReponse } => {
      const r = h.reponses.find((x) => x.joueur === joueur);
      if (r) return { joueur, statut: r.resultat === 'carte_montree' ? 'carte_montree' : 'aucune_carte' };
      return { joueur, statut: 'attente' };
    });
    const enCours: HypotheseEnCoursVue = {
      id: h.id,
      auteur: h.auteur,
      interroges: [...h.interroges],
      etape: h.etape === 'falsification' ? 'falsification' : 'interrogation',
      echeance: h.echeance,
      reponses: statuts,
    };
    if (h.etape === 'interrogation') {
      enCours.triplet = h.auteur === joueurId ? { ...h.original } : { ...h.publique };
      enCours.repondantActuel = repondant ?? undefined;
    }
    if (h.auteur === joueurId) enCours.auteurPrive = { original: { ...h.original } };
    if (repondant === joueurId) {
      enCours.aRepondre = {
        cartesCorrespondantes: cartesCorrespondantes(etat, joueurId, h.original),
        peutMentir: peutMentir(etat, joueurId),
      };
    }
    if (peutFalsifier(etat, joueurId) || (estComplice && h.etape === 'falsification' && h.decisionFalsificationPrise && h.auteur !== joueurId)) {
      enCours.falsification = { original: { ...h.original }, decide: h.decisionFalsificationPrise };
    }
    vue.hypotheseEnCours = enCours;
  }

  if (etat.etape === 'terminee' && etat.resultat) vue.resultat = resultatPartie(etat);
  return vue;
}

/** Résumé de fin de partie : tout est révélé, car la partie est terminée. */
export function resultatPartie(etat: EtatPartie): ResultatPartie {
  const { solution } = etat.affaire;
  const r = etat.resultat!;
  const perso = PERSONNAGES[solution.suspect];
  const lieu = LIEUX_FICHES[solution.lieu];
  const arme = ARMES_FICHES[solution.arme];
  const complice = etat.joueurs[etat.complice];

  const explication = [
    `${perso.nom}, ${perso.titre}, a tué Armand de Valombre ${lieu.article}, ${arme.article}, entre 22 h 50 et 23 h 10.`,
    perso.aveu,
    `${lieu.recit} ${arme.recit}`,
    solution.lieu === 'bureau'
      ? "Le corps n'a pas été déplacé : Armand est mort là où on l'a trouvé."
      : "Le corps a ensuite été transporté jusqu'au bureau pour égarer les soupçons.",
    `Le complice était ${complice.nom} : il connaissait le nom du coupable depuis le début, mais ignorait le lieu et l'arme.`,
  ];

  // Indices décisifs : ceux qui éliminent le plus de fausses pistes.
  const indices = tousLesIndicesDeLAffaire(etat.affaire);
  const indicesDecisifs = indices
    .map((c) => ({ c, elimine: 216 - combinaisonsPossibles([c]).length }))
    .sort((a, b) => b.elimine - a.elimine)
    .slice(0, 4)
    .map(({ c }) => ({ indice: c.id, explication: ceQueLIndiceEcarte(c).join(' · ') }));

  const mains: Record<string, typeof etat.joueurs[string]['main']> = {};
  for (const id of etat.ordre) mains[id] = [...etat.joueurs[id].main];

  return {
    vainqueur: r.vainqueur,
    raison: r.raison,
    solution: { ...solution },
    complice: etat.complice,
    mains,
    explication,
    indicesDecisifs,
    usagesPouvoirs: {
      mensonges: etat.hypotheses
        .filter((h) => h.reponses.some((x) => x.resultat === 'mensonge'))
        .map((h) => ({ hypothese: h.id, manche: h.manche })),
      falsifications: etat.hypotheses
        .filter((h) => h.falsification)
        .map((h) => ({ hypothese: h.id, manche: h.manche, champ: h.falsification!.champ, de: h.falsification!.de, vers: h.falsification!.vers })),
    },
    accusations: etat.accusations.map((a) => ({ joueur: a.joueur, triplet: { ...a.triplet }, correcte: a.correcte })),
    manchesJouees: etat.manche,
    nbHypotheses: etat.hypotheses.length,
  };
}
