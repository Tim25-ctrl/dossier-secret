import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { INDICES_PAR_ID } from '../../../shared/data/catalogue';
import { nomElement } from '../../../shared/data/catalogue';
import { combinaisonsPossibles } from '../../../shared/logique';
import { elementsDe, type ElementId, type Marque, type VueJoueur } from '../../../shared/types';
import { connexion } from '../../connexion';
import { Aide } from '../Commun';
import { Embleme, Icone } from '../Emblemes';
import { CarteDeJeu } from './Dossier';
import { texteEntreePrivee, type Noms } from './Textes';

const MARQUES: { m: Marque; court: string; long: string }[] = [
  { m: 'inconnu', court: '?', long: 'Inconnu' },
  { m: 'ecarte', court: '✗', long: 'Écarté' },
  { m: 'probable', court: '~', long: 'Probable' },
  { m: 'certain', court: '✓', long: 'Certain' },
];

/** Ce que le joueur sait déjà de chaque élément, à partir de SES informations uniquement. */
export function sourcesConnues(v: VueJoueur, nom: Noms): Partial<Record<ElementId, string>> {
  const s: Partial<Record<ElementId, string>> = {};
  const indices = [...v.indicesPublics.map((i) => INDICES_PAR_ID[i.indice]), ...v.moi.indicesConsultes.map((i) => INDICES_PAR_ID[i.indice])];
  const grande = v.regles.mode === 'grande';
  const possibles = combinaisonsPossibles(indices, [], v.affaire, grande);
  for (const e of elementsDe(v.affaire, grande).tous) {
    if (!possibles.some((t) => t.suspect === e || t.lieu === e || t.arme === e || t.mobile === e)) s[e] = 'écarté par un indice';
  }
  // « Grande enquête » : éléments innocents appris par le Légiste.
  for (const j of v.moi.journal) if (j.type === 'expertise') for (const e of j.innocents) s[e] = 'innocent (Légiste)';
  for (const e of v.cartesPubliques) s[e] = 'carte publique';
  for (const p of v.moi.piecesConsultees) s[p.carte] = 'pièce à conviction';
  // Mode difficile : les cartes reçues ne sont pas rappelées (à retenir de mémoire).
  if (v.regles.historiqueCartes !== 'anonymes') for (const j of v.moi.journal) if (j.type === 'carte_vue') s[j.carte] = `montrée par ${nom(j.de)}`;
  for (const e of v.moi.main) s[e] = 'dans votre main';
  if (v.moi.meurtrier) s[v.moi.meurtrier] = 'le meurtrier (secret)';
  return s;
}

/**
 * Carte affichée en grand, seule sur un voile sombre, quand on touche son icône dans le carnet.
 * Fermeture : la croix sur la carte, Échap, ou un clic à côté de la carte.
 */
function ModaleCarte({ id, grande, onFermer }: { id: ElementId; grande: boolean; onFermer: () => void }) {
  const croix = useRef<HTMLButtonElement>(null);
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    croix.current?.focus();
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer.current();
    };
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('keydown', echap);
      precedent?.focus?.();
    };
  }, []);
  return createPortal(
    <div className="voile voile-carte" onMouseDown={(e) => e.target === e.currentTarget && onFermer()}>
      <div role="dialog" aria-modal="true" aria-label={`Carte : ${nomElement(id)}`} className="carte-seule">
        <CarteDeJeu id={id} grande={grande} />
        <button ref={croix} type="button" className="carte-jeu-fermer" onClick={onFermer} aria-label="Fermer la carte">
          ✕
        </button>
      </div>
    </div>,
    document.body,
  );
}

export function Carnet({ vue, nom, onErreur }: { vue: VueJoueur; nom: Noms; onErreur: (e: string) => void }) {
  const [enGrand, setEnGrand] = useState<ElementId | null>(null);
  const [marques, setMarques] = useState(vue.moi.carnet.marques);
  const [notes, setNotes] = useState(vue.moi.carnet.notes);
  const [enregistre, setEnregistre] = useState(true);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Synchronisation avec le serveur (autre appareil, reconnexion) quand on n'est pas en train d'écrire.
  useEffect(() => setMarques(vue.moi.carnet.marques), [vue.moi.carnet.marques]);
  useEffect(() => {
    if (enregistre) setNotes(vue.moi.carnet.notes);
  }, [vue.moi.carnet.notes, enregistre]);

  const marquer = async (e: ElementId, m: Marque) => {
    setMarques((avant) => {
      const n = { ...avant };
      if (m === 'inconnu') delete n[e];
      else n[e] = m;
      return n;
    });
    const r = await connexion.action({ type: 'carnet', marques: { [e]: m } });
    if (!r.ok) onErreur(r.erreur);
  };

  const ecrire = (texte: string) => {
    setNotes(texte);
    setEnregistre(false);
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(async () => {
      const r = await connexion.action({ type: 'carnet', notes: texte });
      if (!r.ok) onErreur(r.erreur);
      setEnregistre(true);
    }, 700);
  };

  const colonne = (titre: string, ids: readonly ElementId[]) => (
    <div>
      <h4>{titre}</h4>
      {ids.map((e) => {
        const m = marques[e] ?? 'inconnu';
        return (
          <div key={e} className={`carnet-ligne${m === 'ecarte' ? ' ecarte' : ''}`} data-element={e}>
            <div className="nom">
              <button type="button" className="icone-carte" onClick={() => setEnGrand(e)} aria-label={`Voir la carte « ${nomElement(e)} » en grand`} title="Voir en grand">
                <Embleme id={e} taille={26} />
              </button>
              <span>
                <span className="libelle">{nomElement(e)}</span>
              </span>
            </div>
            <div className="marques" role="group" aria-label={`Statut de ${nomElement(e)}`}>
              {MARQUES.map((x) => (
                <button
                  key={x.m}
                  type="button"
                  className={`marque-${x.m}`}
                  aria-pressed={m === x.m}
                  title={x.long}
                  aria-label={x.long}
                  onClick={() => void marquer(e, x.m)}
                >
                  {x.court}
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    // Un vrai carnet : couverture de cuir, anneaux, page lignée avec marge rouge.
    <section className="carnet-livre" aria-label="Carnet de déduction">
      <div className="carnet-titre">
        <Icone nom="cadenas" taille={14} /> Carnet de déduction — privé, jamais partagé
      </div>
      <div className="carnet-page">
      <div className="ligne carnet-legende">
        <span className="petit">? inconnu · ✗ écarté · ~ probable · ✓ certain</span>
        <span className="espace" />
        <Aide libelle="Aide sur le carnet">
          Notez ce que vous savez de chaque suspect, lieu et arme. Touchez une icône pour voir la carte en grand. Personne d'autre ne voit votre carnet.
        </Aide>
      </div>
      <div className="carnet-grille">
        {colonne('Suspects', elementsDe(vue.affaire).suspects)}
        {colonne('Lieux', elementsDe(vue.affaire).lieux)}
        {colonne('Armes', elementsDe(vue.affaire).armes)}
        {vue.regles.mode === 'grande' && colonne('Mobiles', elementsDe(vue.affaire).mobiles)}
      </div>
      <div className="champ" style={{ marginTop: 14 }}>
        <label htmlFor="notes">
          Notes personnelles <span className="muet petit">({enregistre ? 'enregistrées' : 'enregistrement…'})</span>
        </label>
        <textarea id="notes" rows={5} value={notes} maxLength={4000} onChange={(e) => ecrire(e.target.value)} placeholder="Qui ment ? Qui a montré quoi à qui ?" />
      </div>
      <h4>Mes observations</h4>
      <ul className="journal">
        {[...vue.moi.journal].reverse().map((e, i) => (
          <li key={i}>{texteEntreePrivee(e, nom, vue.regles.historiqueCartes === 'anonymes')}</li>
        ))}
      </ul>
      </div>
      {enGrand && <ModaleCarte id={enGrand} grande={vue.regles.mode === 'grande'} onFermer={() => setEnGrand(null)} />}
    </section>
  );
}
