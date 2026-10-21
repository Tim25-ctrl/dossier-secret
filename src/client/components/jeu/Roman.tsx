// Historique « façon roman » : les mêmes événements, racontés comme dans un roman policier.
// Plusieurs tournures par action, choisies à partir du contenu de l'événement : un même événement
// s'écrit pareil chez tous les joueurs et à chaque affichage. Aucune information n'est perdue (les
// petites cartes de l'hypothèse restent affichées) et les joueurs ne sont jamais genrés.
// Les événements sans version roman gardent leur texte habituel (voir Textes.tsx).

import type { ReactNode } from 'react';
import { ARMES_FICHES, LIEUX_FICHES, libelleCategorie, nomCourt } from '../../../shared/data/catalogue';
import type { AffaireId, EvenementPublic } from '../../../shared/types';
import { TripletVue } from '../Commun';
import type { Noms } from './Textes';

let style: 'roman' | 'simple' = 'roman';
export function reglerStyleHistorique(s: 'roman' | 'simple') {
  style = s;
}
export const styleHistorique = () => style;

/** Empreinte stable d'un événement, pour choisir toujours la même tournure. */
function empreinte(ev: EvenementPublic): number {
  const s = JSON.stringify(ev);
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}
const choisir = <T,>(ev: EvenementPublic, options: T[]): T => options[empreinte(ev) % options.length];

export function texteRoman(ev: EvenementPublic, nom: Noms, moi: string, affaire: AffaireId): { contenu: ReactNode; classe?: string } | null {
  /** Sujet en début de phrase (« Vous », « Léa ») et complément (« vous », « Léa »). */
  const Qui = (id: string) => (id === moi ? 'Vous' : nom(id));
  const qui = (id: string) => (id === moi ? 'vous' : nom(id));
  /** Accord du verbe : 3ᵉ personne, ou « vous ». */
  const v = (id: string, il: string, vous: string) => (id === moi ? vous : il);
  const auto = (a: boolean) => (a ? ' (réponse automatique)' : '');

  switch (ev.type) {
    case 'debut_partie':
      return { classe: 'important', contenu: "L'enquête commence. Chacun reçoit ses cartes… et l'un de vous, un secret." };
    case 'debut_tour':
      return {
        contenu: choisir(ev, [
          `${Qui(ev.joueur)} ${v(ev.joueur, 'prend', 'prenez')} la parole.`,
          `Tous les regards se tournent vers ${qui(ev.joueur)}.`,
          `C'est à ${qui(ev.joueur)} de mener l'enquête.`,
        ]),
      };
    case 'fin_tour':
      if (ev.raison === 'tour_perdu')
        return { contenu: `${Qui(ev.joueur)} ${v(ev.joueur, 'perd', 'perdez')} ${v(ev.joueur, 'son', 'votre')} tour : la dénonciation était fausse.` };
      if (ev.raison === 'temps_ecoule') return { contenu: `Le temps file : ${qui(ev.joueur)} ${v(ev.joueur, 'doit', 'devez')} passer la main.` };
      return {
        contenu: choisir(ev, [
          `${Qui(ev.joueur)} ${v(ev.joueur, 'se tait et laisse la main', 'vous taisez et laissez la main')}.`,
          `${Qui(ev.joueur)} ${v(ev.joueur, 'referme son carnet', 'refermez votre carnet')}.`,
          `${Qui(ev.joueur)} ${v(ev.joueur, 'n’en dit pas plus pour le moment', 'n’en dites pas plus pour le moment')}.`,
        ]),
      };
    case 'hypothese': {
      const s = nomCourt(ev.triplet.suspect);
      const l = LIEUX_FICHES[ev.triplet.lieu]?.article ?? '';
      const a = ARMES_FICHES[ev.triplet.arme]?.article ?? '';
      const interroges = ev.interroges.map(qui).join(', puis ');
      const moiAuteur = ev.auteur === moi;
      const phrase = choisir(ev, [
        `« Et si c'était ${s}, ${l}, ${a} ? » ${moiAuteur ? 'demandez-vous' : `demande ${nom(ev.auteur)}`}, en interrogeant ${interroges}.`,
        `${Qui(ev.auteur)} ${v(ev.auteur, 'soupçonne', 'soupçonnez')} ${s}, ${l}, ${a}, et ${v(ev.auteur, 'interroge', 'interrogez')} ${interroges}.`,
        `${Qui(ev.auteur)} ${v(ev.auteur, 'avance', 'avancez')} une théorie : ${s}, ${l}, ${a}. ${interroges.charAt(0).toUpperCase() + interroges.slice(1)} ${ev.interroges.includes(moi) ? 'devez' : ev.interroges.length > 1 ? 'doivent' : 'doit'} répondre.`,
      ]);
      return {
        classe: 'important',
        contenu: (
          <>
            {phrase} <TripletVue t={ev.triplet} />
          </>
        ),
      };
    }
    case 'reponse':
      // La carte vue en secret garde son affichage habituel (plus lisible).
      if (ev.resultat === 'carte_montree' && ev.carte) return null;
      if (ev.resultat === 'carte_montree')
        return {
          contenu:
            choisir(ev, [
              `${Qui(ev.joueur)} ${v(ev.joueur, 'glisse', 'glissez')} discrètement une carte sous la table.`,
              `${Qui(ev.joueur)} ${v(ev.joueur, 'montre', 'montrez')} une carte, à l'abri des regards.`,
            ]) + auto(ev.auto),
        };
      return {
        contenu:
          choisir(ev, [
            `${Qui(ev.joueur)} ${v(ev.joueur, 'secoue la tête', 'secouez la tête')} : rien à montrer.`,
            `${Qui(ev.joueur)} ${v(ev.joueur, 'n’a', 'n’avez')} rien à montrer.`,
          ]) + auto(ev.auto),
      };
    case 'fin_hypothese':
      return ev.montreePar === null
        ? { contenu: choisir(ev, ['Un silence pesant : personne n’a rien à montrer.', 'Personne ne bronche : aucune carte n’est montrée.']) }
        : null;
    case 'archive': {
      const sorte = libelleCategorie(ev.categorie, affaire).toLowerCase();
      return {
        contenu: choisir(ev, [
          `${Qui(ev.joueur)} ${v(ev.joueur, 'brise', 'brisez')} le sceau du dossier n° ${ev.dossier} (${sorte}).`,
          `${Qui(ev.joueur)} ${v(ev.joueur, 'ouvre', 'ouvrez')} le dossier n° ${ev.dossier} (${sorte}) et le ${v(ev.joueur, 'parcourt', 'parcourez')} en silence.`,
        ]),
      };
    }
    default:
      return null;
  }
}
