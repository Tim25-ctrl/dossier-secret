import { useEffect, useRef } from 'react';
import type { VueJoueur } from '../../../shared/types';
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
