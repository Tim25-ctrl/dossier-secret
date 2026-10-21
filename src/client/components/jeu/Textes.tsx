import type { ReactNode } from 'react';
import { CONFIG_PAR_DEFAUT } from '../../../engine/config';
import { INDICES_PAR_ID, libelleCategorie } from '../../../shared/data/catalogue';
import { nomElement } from '../../../shared/data/catalogue';
import { AFFAIRE_PAR_DEFAUT, type AffaireId, type EntreePrivee, type EvenementPublic } from '../../../shared/types';
import { Carte, TripletVue } from '../Commun';
import { styleHistorique, texteRoman } from './Roman';

export type Noms = (id: string) => string;

const RAISONS_FIN = {
  accusation_correcte: 'une accusation juste a été formulée',
  manches_ecoulees: 'les 12 manches sont écoulées',
  plus_d_accusateur: "plus aucun enquêteur ne peut accuser",
} as const;

export function texteEvenement(
  ev: EvenementPublic,
  nom: Noms,
  moi: string,
  affaire: AffaireId = AFFAIRE_PAR_DEFAUT,
): { contenu: ReactNode; classe?: string } | null {
  // Historique façon roman (réglage par défaut) : les événements qui ont une version roman l'utilisent.
  if (styleHistorique() === 'roman') {
    const roman = texteRoman(ev, nom, moi, affaire);
    if (roman) return roman;
  }
  const qui = (id: string) => (id === moi ? 'Vous' : nom(id));
  switch (ev.type) {
    case 'debut_partie':
      return { contenu: "L'enquête commence. Les cartes sont distribuées et les rôles attribués en secret.", classe: 'important' };
    case 'debut_manche':
      return { contenu: ev.manche === CONFIG_PAR_DEFAUT.manchesMax ? `Manche ${ev.manche} — dernière manche !` : `Manche ${ev.manche}`, classe: 'manche' };
    case 'debut_tour':
      return { contenu: ev.joueur === moi ? "C'est votre tour." : `Au tour de ${nom(ev.joueur)}.` };
    case 'fin_tour':
      if (ev.raison === 'tour_perdu')
        return { contenu: `${qui(ev.joueur)} ${ev.joueur === moi ? 'perdez votre' : 'perd son'} tour (dénonciation fausse).` };
      return { contenu: `${qui(ev.joueur)} ${ev.joueur === moi ? 'terminez' : 'termine'} ${ev.joueur === moi ? 'votre' : 'son'} tour${ev.raison === 'temps_ecoule' ? ' (temps écoulé)' : ''}.` };
    case 'hypothese':
      return {
        classe: 'important',
        contenu: (
          <>
            {qui(ev.auteur)} {ev.auteur === moi ? 'formulez' : 'formule'} une hypothèse : <TripletVue t={ev.triplet} /> —{' '}
            {ev.auteur === moi ? 'vous interrogez' : 'interroge'} {ev.interroges.map(qui).join(', puis ')}.
          </>
        ),
      };
    case 'reponse':
      if (ev.resultat === 'carte_montree' && ev.carte)
        return {
          classe: 'prive-ligne',
          contenu: (
            <>
              🔒 {ev.joueur === moi ? 'Vous montrez en secret' : `${nom(ev.joueur)} vous montre en secret`} : <Carte id={ev.carte} taille="mini" />
              {ev.auto ? ' (réponse automatique)' : ''}
            </>
          ),
        };
      return {
        contenu:
          ev.resultat === 'carte_montree'
            ? `${qui(ev.joueur)} ${ev.joueur === moi ? 'montrez' : 'montre'} une carte en secret.${ev.auto ? ' (réponse automatique)' : ''}`
            : `${qui(ev.joueur)} : aucune carte.${ev.auto ? ' (réponse automatique)' : ''}`,
      };
    case 'fin_hypothese':
      return ev.montreePar === null ? { contenu: "Aucune carte n'a été montrée." } : null;
    case 'archive':
      return { contenu: `${qui(ev.joueur)} ${ev.joueur === moi ? 'consultez' : 'consulte'} le dossier d'archives n° ${ev.dossier} (${libelleCategorie(ev.categorie, affaire)}).` };
    case 'indice_public':
      return { classe: 'important', contenu: `Nouvel indice versé au dossier public : « ${INDICES_PAR_ID[ev.indice]?.titre} ».` };
    case 'accusation':
      return {
        classe: 'important',
        contenu: (
          <>
            {qui(ev.joueur)} {ev.joueur === moi ? 'accusez' : 'accuse'} : <TripletVue t={ev.triplet} />{' '}
            {ev.correcte ? <strong style={{ color: 'var(--vert)' }}>— accusation juste !</strong> : <strong style={{ color: 'var(--rouge)' }}>— accusation fausse.</strong>}
          </>
        ),
      };
    case 'empreinte':
      return {
        classe: 'important empreinte',
        contenu: (
          <>
            {ev.innocente ? (
              <>
                <span className="loupe-balaie" aria-hidden="true">🔍</span> <strong>Empreinte relevée</strong> sur les lieux d'une manigance : elle n'appartient pas à <strong>{ev.innocente === moi ? 'vous' : nom(ev.innocente)}</strong>.
              </>
            ) : (
              <>
                <span className="loupe-balaie" aria-hidden="true">🔍</span> <strong>Empreinte relevée</strong> : le complice a rusé pendant la <strong>manche {ev.mancheRuse}</strong>. Qui a répondu, falsifié ou consulté quoi à ce
                moment-là ?
              </>
            )}
          </>
        ),
      };
    case 'denonciation':
      return {
        classe: 'important',
        contenu: ev.correcte ? (
          <>
            {qui(ev.joueur)} {ev.joueur === moi ? 'dénoncez' : 'dénonce'} {ev.cible === moi ? 'vous' : nom(ev.cible)} : <strong style={{ color: 'var(--vert)' }}>c'est bien le complice !</strong> Ses
            ruses sont suspendues pendant quelques manches.
          </>
        ) : (
          <>
            {qui(ev.joueur)} {ev.joueur === moi ? 'dénoncez' : 'dénonce'} {ev.cible === moi ? 'vous' : nom(ev.cible)} comme complice :{' '}
            <strong style={{ color: 'var(--rouge)' }}>dénonciation fausse</strong>, {ev.joueur === moi ? 'vous perdrez votre' : 'il perdra son'} prochain tour.
          </>
        ),
      };
    case 'depart':
      return { classe: 'important', contenu: ev.joueur === moi ? 'Vous avez quitté la partie.' : `${nom(ev.joueur)} a quitté la partie.` };
    case 'remplacement':
      return { classe: 'important', contenu: `Un bot remplace ${nom(ev.joueur)} et joue désormais à sa place.` };
    case 'reprise_siege':
      return { classe: 'important', contenu: `${nom(ev.joueur)} est de retour et reprend sa place.` };
    case 'connexion':
      return { contenu: ev.connecte ? `${nom(ev.joueur)} est de retour.` : `${nom(ev.joueur)} a perdu la connexion.` };
    case 'fin_partie':
      return {
        classe: 'important',
        contenu: `Fin de l'enquête : ${ev.vainqueur === 'enqueteurs' ? 'les enquêteurs' : 'le complice'} ${ev.vainqueur === 'enqueteurs' ? 'gagnent' : 'gagne'} (${RAISONS_FIN[ev.raison]}).`,
      };
  }
}

export function texteEntreePrivee(e: EntreePrivee, nom: Noms, anonyme = false): ReactNode {
  // Mode difficile : les cartes montrées et reçues ne sont pas rappelées.
  if (anonyme && e.type === 'carte_vue') return `${nom(e.de)} vous a montré une carte.`;
  if (anonyme && e.type === 'carte_montree') return `Vous avez montré une carte à ${nom(e.a)}${e.auto ? ' (réponse automatique)' : ''}.`;
  if (anonyme && e.type === 'ruse' && e.ruse === 'emprunt') return 'Ruse « Carte empruntée » : vous avez montré une carte que vous n’avez pas.';
  switch (e.type) {
    case 'role':
      return e.role === 'complice' ? (
        <>
          Vous êtes <strong>le complice</strong>. Le meurtrier est <strong>{nomElement(e.meurtrier!)}</strong>.
        </>
      ) : (
        <>
          Vous êtes <strong>enquêteur</strong>.
        </>
      );
    case 'main':
      return `Vous avez reçu : ${e.cartes.map(nomElement).join(', ')}.`;
    case 'hypothese_originale':
      return (
        <>
          Votre hypothèse : <TripletVue t={e.triplet} />
        </>
      );
    case 'carte_vue':
      return (
        <>
          {nom(e.de)} vous a montré : <strong>{nomElement(e.carte)}</strong>.
        </>
      );
    case 'aucune_carte_vue':
      return 'Personne ne vous a montré de carte.';
    case 'carte_montree':
      return `Vous avez montré « ${nomElement(e.carte)} » à ${nom(e.a)}${e.auto ? ' (réponse automatique)' : ''}.`;
    case 'archive_lue':
      return `Vous avez lu le dossier n° ${e.dossier} : « ${INDICES_PAR_ID[e.indice]?.titre} ».`;
    case 'piece_lue':
      return (
        <>
          Pièce à conviction n° {e.dossier} : <strong>{nomElement(e.carte)}</strong> (hors de cause).
        </>
      );
    case 'mensonge':
      return `Vous avez menti : « aucune carte » (restant : ${e.restants}).`;
    case 'ruse':
      if (e.ruse === 'emprunt') return `Ruse « Carte empruntée » : vous avez montré « ${nomElement(e.carte!)} » sans l'avoir (ruses restantes : ${e.restants}).`;
      if (e.ruse === 'trafic')
        return `Ruse « Dossier trafiqué » : le dossier n° ${e.dossier} montrera désormais « ${INDICES_PAR_ID[e.indiceFaux!]?.titre} » (ruses restantes : ${e.restants}).`;
      if (e.ruse === 'falsification') return `Ruse « Hypothèse falsifiée » (ruses restantes : ${e.restants}).`;
      return null;
    case 'falsification':
      return `Vous avez falsifié une hypothèse : ${nomElement(e.de)} → ${nomElement(e.vers)}.`;
    case 'accusation':
      return (
        <>
          Votre accusation : <TripletVue t={e.triplet} /> — {e.correcte ? 'juste !' : 'fausse.'}
        </>
      );
  }
}
