import { useEffect, useRef } from 'react';
import type { MessageChat } from '../../../shared/protocole';
import { SANS_LIMITE, type VueJoueur } from '../../../shared/types';
import { jouer, type Son } from '../../sons';

/**
 * Déclenche les bruitages à partir des NOUVEAUX événements de la partie (jamais ceux déjà vus
 * au chargement). Un seul bruitage par mise à jour, le plus important.
 *
 * Sécurité : seuls des événements publics, ou vécus de la même façon par tous (être interrogé,
 * voir une carte, ouvrir un dossier), font du bruit. Rien de propre au complice (fenêtre de
 * falsification, choix de mentir, ruses) n'en fait : à une même table, tout le monde entend.
 */
export function useSonsPartie(vue: VueJoueur, doitRepondre: boolean) {
  // Mon tour commence quand je deviens le joueur actif (pas à chaque retour d'hypothèse).
  const monTour = vue.joueurActif === vue.moi.id && vue.etape !== 'terminee';
  const vus = useRef({ partie: vue.partieId, historique: vue.historique.length, journal: vue.moi.journal.length });

  useEffect(() => {
    const r = vus.current;
    if (r.partie !== vue.partieId) {
      vus.current = { partie: vue.partieId, historique: vue.historique.length, journal: vue.moi.journal.length };
      return;
    }
    const publics = vue.historique.slice(r.historique);
    const prives = vue.moi.journal.slice(r.journal);
    r.historique = vue.historique.length;
    r.journal = vue.moi.journal.length;

    let son: Son | null = null;
    if (publics.some((e) => e.type === 'denonciation' && e.correcte)) son = 'demasque';
    else if (publics.some((e) => e.type === 'empreinte')) son = 'empreinte';
    else if (prives.some((e) => e.type === 'carte_vue')) son = 'carte';
    else if (prives.some((e) => e.type === 'archive_lue' || e.type === 'piece_lue')) son = 'dossier';
    else if (publics.some((e) => e.type === 'hypothese')) son = 'hypothese';
    if (son) jouer(son);
  }, [vue.partieId, vue.historique.length, vue.moi.journal.length]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fronts montants : début de mon tour, début d'une interrogation qui me concerne.
  const avant = useRef({ monTour, doitRepondre });
  useEffect(() => {
    if (monTour && !avant.current.monTour) jouer('tour');
    if (doitRepondre && !avant.current.doitRepondre) jouer('interrogation');
    avant.current = { monTour, doitRepondre };
  }, [monTour, doitRepondre]);
}

/** « Pop » discret à chaque nouveau message d'un AUTRE joueur (jamais pour les anciens ni les miens). */
export function useSonMessages(messages: MessageChat[], moi: string) {
  const dernier = useRef(messages.at(-1)?.id ?? 0);
  useEffect(() => {
    const nouveaux = messages.filter((m) => m.id > dernier.current);
    dernier.current = messages.at(-1)?.id ?? dernier.current;
    if (nouveaux.some((m) => m.auteur !== moi)) jouer('message');
  }, [messages, moi]);
}

/**
 * Tic-tac pendant les 10 dernières secondes de MON délai : mon tour, ou ma réponse à une
 * interrogation (vécue de la même façon par tous les interrogés). Rien en pause ni sans limite.
 */
export function useTicTac(echeance: number | null, decalage: number) {
  useEffect(() => {
    if (echeance === null || echeance >= SANS_LIMITE) return;
    let derniere = -1;
    const t = setInterval(() => {
      const restant = Math.ceil((echeance - (Date.now() + decalage)) / 1000);
      if (restant >= 1 && restant <= 10 && restant !== derniere) {
        derniere = restant;
        jouer(restant % 2 === 0 ? 'tic' : 'tac');
      }
    }, 200);
    return () => clearInterval(t);
  }, [echeance, decalage]);
}
