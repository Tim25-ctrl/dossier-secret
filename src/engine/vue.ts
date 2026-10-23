// Filtrage des informations : construit la vue d'UN joueur à partir de l'état
// complet. C'est la seule donnée envoyée aux navigateurs. Tout ce qui n'est pas
// explicitement copié ici reste sur le serveur (solution, mains des autres,
// rôle des autres, versions originales des hypothèses des autres, journal d'audit…).

import { AFFAIRES, ARMES_FICHES, INDICES_PAR_ID, LIEUX_FICHES, MOBILES_FICHES, PERSONNAGES } from '../shared/data/catalogue';
import { ceQueLIndiceEcarte, combinaisonsPossibles, tripletsDe } from '../shared/logique';
import type { HypotheseEnCoursVue, ResultatPartie, StatutReponse, VueJoueur } from '../shared/types';
import { avecMobile, coutRuse, nbInterroges, pouvoirsPour, rusesPour } from './config';
import { tousLesIndicesDeLAffaire } from './generateur';
import { joueursPasPrets, objectifVu, tableauVu, absentsBloquants, cartesCorrespondantes, rusesSuspendues, cartesEmpruntables, joueurActif, peutFalsifier, peutMentir, repondantActuel, type EtatPartie } from './partie';

export function vuePour(etat: EtatPartie, joueurId: string): VueJoueur {
  const moi = etat.joueurs[joueurId];
  if (!moi) throw new Error('Joueur inconnu');
  const estComplice = moi.role === 'complice';

  // Historique public ; l'auteur d'une hypothèse y voit toujours SA version originale,
  // sans aucun indice qu'elle a pu être falsifiée pour les autres.
  const mesHypotheses = new Map(etat.hypotheses.filter((h) => h.auteur === joueurId).map((h) => [h.id, h]));
  // La carte montrée reste lisible dans l'historique, mais seulement pour les deux joueurs concernés.
  const cartesVues = new Map(moi.journal.flatMap((e) => (e.type === 'carte_vue' ? [[`${e.hypothese}|${e.de}`, e.carte] as const] : [])));
  const cartesMontrees = new Map(
    moi.journal.flatMap((e) =>
      e.type === 'carte_montree' ? [[e.hypothese, e.carte] as const] : e.type === 'ruse' && e.ruse === 'emprunt' && e.hypothese && e.carte ? [[e.hypothese, e.carte] as const] : [],
    ),
  );
  const historique = etat.historique.map((ev) => {
    if (ev.type === 'hypothese' && mesHypotheses.has(ev.id)) return { ...ev, triplet: { ...mesHypotheses.get(ev.id)!.original } };
    if (ev.type === 'reponse' && ev.resultat === 'carte_montree' && etat.config.historiqueCartes !== 'anonymes') {
      const carte = ev.joueur === joueurId ? cartesMontrees.get(ev.hypothese) : cartesVues.get(`${ev.hypothese}|${ev.joueur}`);
      if (carte) return { ...ev, carte };
    }
    return ev;
  });

  const vue: VueJoueur = {
    partieId: etat.id,
    affaire: etat.config.affaire,
    moi: {
      id: moi.id,
      nom: moi.nom,
      role: moi.role,
      main: [...moi.main],
      peutAccuser: moi.peutAccuser,
      carnet: { marques: { ...moi.carnet.marques }, notes: moi.carnet.notes },
      journal: moi.journal.map((e) => ({ ...e })),
      // Ce que le joueur a RÉELLEMENT lu (un dossier trafiqué montre le faux indice).
      indicesConsultes: moi.journal.flatMap((e) =>
        e.type === 'archive_lue' ? [{ dossier: e.dossier, indice: e.indice, ...(e.categorie ? { categorie: e.categorie } : {}) }] : [],
      ),
      piecesConsultees: moi.dossiersConsultes.flatMap((dossier) => {
        const p = (etat.pieces ?? []).find((x) => x.dossier === dossier);
        return p ? [{ dossier, carte: p.carte }] : [];
      }),
      peutDenoncer: !!moi.peutDenoncer && !etat.compliceDemasque,
      ...(etat.attenteDepart ? { pret: moi.bot || etat.attenteDepart.prets.includes(joueurId) } : {}),
    },
    regles: {
      mode: etat.config.mode ?? 'classique',
      manchesMax: etat.config.manchesMax,
      pointsAction: etat.config.pointsAction,
      nbInterroges: nbInterroges(etat.ordre.length),
      hypothesesMaxParTour: etat.config.hypothesesMaxParTour,
      delaiFalsificationMs: etat.config.delaiFalsificationMs,
      dureeTourMs: etat.config.delaiTourMs,
      coutHypothese: etat.config.coutHypothese,
      mensonges: pouvoirsPour(etat.config, etat.ordre.length).mensonges,
      falsifications: pouvoirsPour(etat.config, etat.ordre.length).falsifications,
      modeComplice: etat.config.modeComplice ?? 'classique',
      ruses: rusesPour(etat.config, etat.ordre.length),
      coutRuses: { mensonge: coutRuse(etat.config, 'mensonge'), falsification: coutRuse(etat.config, 'falsification'), emprunt: coutRuse(etat.config, 'emprunt'), trafic: coutRuse(etat.config, 'trafic') },
      historiqueCartes: etat.config.historiqueCartes ?? 'visibles',
      premiereMancheEmpreinte: etat.config.premiereMancheEmpreinte ?? 1,
      suspensionDemasque: etat.config.suspensionDemasque ?? 3,
      ...(etat.config.roles
        ? {
            roles: {
              possibles: ['temoin', ...etat.config.roles.tirables],
              maitreChanteur: etat.ordre.length >= etat.config.roles.maitreChanteurDes,
              mancheExpertise: etat.config.roles.mancheExpertise,
              mancheProfilage: etat.config.roles.mancheProfilage,
            },
          }
        : {}),
      ...(etat.config.tableau ? { tableau: { ...etat.config.tableau } } : {}),
    },
    manche: etat.manche,
    joueurActif: joueurActif(etat),
    pointsAction: etat.pointsAction,
    hypothesesCeTour: etat.hypothesesCeTour,
    etape: etat.etape,
    echeanceTour: etat.echeanceTour,
    joueurs: etat.ordre.map((id) => {
      const j = etat.joueurs[id];
      return { id, nom: j.nom, connecte: j.connecte, peutAccuser: j.peutAccuser, nbCartes: j.main.length, bot: j.bot, parti: !!j.parti };
    }),
    cartesPubliques: [...etat.cartesPubliques],
    indicesPublics: etat.indicesPublics.map((i) => ({ ...i })),
    archives: [
      ...etat.affaire.archives.map((a) => ({ dossier: a.dossier, categorie: INDICES_PAR_ID[a.indice].categorie, disponibleDesManche: a.disponibleDesManche })),
      ...(etat.pieces ?? []).map((p) => ({ dossier: p.dossier, categorie: 'piece' as const, disponibleDesManche: p.disponibleDesManche })),
    ]
      // Dans l'ordre d'ouverture (les parties créées avant la renumérotation restent bien rangées).
      .sort((a, b) => a.disponibleDesManche - b.disponibleDesManche || a.dossier - b.dossier)
      .map((a) => ({ ...a, disponible: a.disponibleDesManche <= etat.manche, consulte: moi.dossiersConsultes.includes(a.dossier) })),
    historique,
    ...(etat.etape === 'designation' && etat.designation ? { echeanceDesignation: etat.designation.echeance } : {}),
    ...(etat.config.tableau ? { tableau: tableauVu(etat, joueurId) } : {}),
    ...(etat.attenteDepart ? { attenteDepart: { enAttente: joueursPasPrets(etat), limite: etat.attenteDepart.limite } } : {}),
    compliceDemasque: etat.compliceDemasque ? etat.complice : null,
    retourRuses: rusesSuspendues(etat) ? (etat.retourRuses ?? null) : null,
    pause: etat.pause ? { depuis: etat.pause.depuis, absents: absentsBloquants(etat).map((id) => ({ id, parti: !!etat.joueurs[id].parti })) } : null,
  };

  // « Grande enquête » : chacun ne voit que son propre rôle et ce qu'il lui apprend.
  if (moi.roleEnquete) {
    vue.moi.roleEnquete = moi.roleEnquete;
    vue.moi.pouvoirsRole = { ...moi.pouvoirs };
    if (moi.roleEnquete === 'temoin') vue.moi.lieuConnu = etat.affaire.solution.lieu;
  }
  if (moi.role === 'maitre_chanteur') vue.moi.mobileConnu = etat.affaire.solution.mobile;

  if (estComplice) {
    const objectif = objectifVu(etat);
    if (objectif) vue.moi.objectif = objectif;
    vue.moi.meurtrier = etat.affaire.solution.suspect;
    vue.moi.mensongesRestants = moi.mensongesRestants;
    vue.moi.falsificationsRestantes = moi.falsificationsRestantes;
    if (etat.config.modeComplice === 'ruse') vue.moi.rusesRestantes = moi.rusesRestantes ?? 0;
  }

  const h = etat.hypothese;
  if (h && etat.etape === 'hypothese') {
    const repondant = repondantActuel(etat);
    const statuts = h.interroges.map((joueur): { joueur: string; statut: StatutReponse } => {
      const r = h.reponses.find((x) => x.joueur === joueur);
      if (r) return { joueur, statut: r.resultat === 'carte_montree' || r.resultat === 'emprunt' ? 'carte_montree' : 'aucune_carte' };
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
        cartesEmpruntables: cartesEmpruntables(etat, joueurId),
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

  const infos = AFFAIRES[etat.config.affaire];
  // « Grande enquête » : le pourquoi du crime s'ajoute au récit.
  const mobile = solution.mobile ? MOBILES_FICHES[solution.mobile] : undefined;
  const explication = [
    `${perso.nom}, ${perso.titre}, a tué ${infos.victime} ${lieu.article}, ${arme.article}, ${infos.heureCrime}${mobile ? `, ${mobile.article}` : ''}.`,
    // L'aveu de la fiche raconte un mobile précis : en « Grande enquête », le récit du mobile tiré le remplace.
    mobile ? mobile.recit.replace('{coupable}', perso.nom) : perso.aveu,
    `${lieu.recit} ${arme.recit}`,
    solution.lieu === infos.lieuDecouverte ? infos.corpsNonDeplace : infos.corpsDeplace,
    mobile
      ? `Le complice était ${complice.nom} : il connaissait le nom du coupable depuis le début, mais ignorait le lieu, l'arme et le mobile.`
      : `Le complice était ${complice.nom} : il connaissait le nom du coupable depuis le début, mais ignorait le lieu et l'arme.`,
  ];

  // Indices décisifs : ceux qui éliminent le plus de fausses pistes.
  const indices = tousLesIndicesDeLAffaire(etat.affaire);
  const indicesDecisifs = indices
    .map((c) => ({
      c,
      elimine: tripletsDe(etat.config.affaire, avecMobile(etat.config)).length - combinaisonsPossibles([c], [], etat.config.affaire, avecMobile(etat.config)).length,
    }))
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
    cartesRestantes: [...etat.cartesPubliques, ...(etat.pieces ?? []).map((p) => p.carte)],
    explication,
    indicesDecisifs,
    usagesPouvoirs: {
      mensonges: etat.hypotheses
        .filter((h) => h.reponses.some((x) => x.resultat === 'mensonge'))
        .map((h) => ({ hypothese: h.id, manche: h.manche })),
      falsifications: etat.hypotheses
        .filter((h) => h.falsification)
        .map((h) => ({ hypothese: h.id, manche: h.manche, champ: h.falsification!.champ, de: h.falsification!.de, vers: h.falsification!.vers })),
      emprunts: etat.hypotheses.flatMap((h) =>
        h.reponses.filter((x) => x.resultat === 'emprunt').map((x) => ({ hypothese: h.id, manche: h.manche, carte: x.carte! })),
      ),
      trafics: (etat.trafics ?? []).map((t) => ({ dossier: t.dossier, indiceFaux: t.indiceFaux, manche: t.manche })),
    },
    denonciations: (etat.denonciations ?? []).map((d) => ({ joueur: d.joueur, cible: d.cible, correcte: d.correcte })),
    accusations: etat.accusations.map((a) => ({ joueur: a.joueur, triplet: { ...a.triplet }, correcte: a.correcte })),
    ...(etat.config.tableau ? { tableau: tableauVu(etat, null) } : {}),
    ...(etat.objectif
      ? { objectifComplice: { ...objectifVu(etat)!, reussi: !!etat.objectifReussi, ...(etat.designation ? { designe: etat.designation.designe ?? null } : {}) } }
      : {}),
    ...(etat.config.roles
      ? {
          roles: Object.fromEntries(
            etat.ordre.map((id) => {
              const j = etat.joueurs[id];
              return [id, { role: j.role, ...(j.roleEnquete ? { roleEnquete: j.roleEnquete } : {}) }];
            }),
          ),
        }
      : {}),
    manchesJouees: etat.manche,
    nbHypotheses: etat.hypotheses.length,
  };
}
