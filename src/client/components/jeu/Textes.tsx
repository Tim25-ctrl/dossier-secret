import type { ReactNode } from 'react';
import { INDICES_PAR_ID, LIBELLES_CATEGORIE_INDICE } from '../../../shared/data/indices';
import { nomElement } from '../../../shared/data/manoir';
import type { EntreePrivee, EvenementPublic, Triplet } from '../../../shared/types';
import { TripletVue } from '../Commun';

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
  falsifiees: Record<string, Triplet> = {},
): { contenu: ReactNode; classe?: string } | null {
  const qui = (id: string) => (id === moi ? 'Vous' : nom(id));
  switch (ev.type) {
    case 'debut_partie':
      return { contenu: "L'enquête commence. Les cartes sont distribuées et les rôles attribués en secret.", classe: 'important' };
    case 'debut_manche':
      return { contenu: `Manche ${ev.manche}`, classe: 'manche' };
    case 'debut_tour':
      return { contenu: ev.joueur === moi ? "C'est votre tour." : `Au tour de ${nom(ev.joueur)}.` };
    case 'fin_tour':
      return { contenu: `${qui(ev.joueur)} ${ev.joueur === moi ? 'terminez' : 'termine'} ${ev.joueur === moi ? 'votre' : 'son'} tour${ev.raison === 'temps_ecoule' ? ' (temps écoulé)' : ''}.` };
    case 'hypothese':
      return {
        classe: 'important',
        contenu: (
          <>
            {qui(ev.auteur)} {ev.auteur === moi ? 'formulez' : 'formule'} une hypothèse{ev.auteur === moi && falsifiees[ev.id] ? ' (votre version originale)' : ''} :{' '}
            <TripletVue t={ev.triplet} /> — {ev.auteur === moi ? 'vous interrogez' : 'interroge'} {ev.interroges.map(qui).join(', puis ')}.
            {ev.auteur === moi && falsifiees[ev.id] && (
              <div className="petit" style={{ color: 'var(--or-clair)', marginTop: 4 }}>
                ⚠ Les autres joueurs ont vu une version falsifiée : <TripletVue t={falsifiees[ev.id]} />
              </div>
            )}
          </>
        ),
      };
    case 'reponse':
      return {
        contenu:
          ev.resultat === 'carte_montree'
            ? `${qui(ev.joueur)} ${ev.joueur === moi ? 'montrez' : 'montre'} une carte en secret.${ev.auto ? ' (réponse automatique)' : ''}`
            : `${qui(ev.joueur)} : aucune carte.${ev.auto ? ' (réponse automatique)' : ''}`,
      };
    case 'fin_hypothese':
      return ev.montreePar === null ? { contenu: "Aucune carte n'a été montrée." } : null;
    case 'archive':
      return { contenu: `${qui(ev.joueur)} ${ev.joueur === moi ? 'consultez' : 'consulte'} le dossier d'archives n° ${ev.dossier} (${LIBELLES_CATEGORIE_INDICE[ev.categorie]}).` };
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
    case 'connexion':
      return { contenu: ev.connecte ? `${nom(ev.joueur)} est de retour.` : `${nom(ev.joueur)} a perdu la connexion.` };
    case 'fin_partie':
      return {
        classe: 'important',
        contenu: `Fin de l'enquête : ${ev.vainqueur === 'enqueteurs' ? 'les enquêteurs' : 'le complice'} ${ev.vainqueur === 'enqueteurs' ? 'gagnent' : 'gagne'} (${RAISONS_FIN[ev.raison]}).`,
      };
  }
}

export function texteEntreePrivee(e: EntreePrivee, nom: Noms): ReactNode {
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
    case 'hypothese_falsifiee':
      return (
        <>
          ⚠ Votre hypothèse a été <strong>falsifiée</strong> ! Les autres ont vu : <TripletVue t={e.publique} />
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
    case 'mensonge':
      return `Vous avez utilisé le pouvoir Mensonge (il en reste ${e.restants}).`;
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
