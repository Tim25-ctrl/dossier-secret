import { useEffect, useMemo, useRef, useState } from 'react';
import { INDICES_PAR_ID } from '../../../shared/data/indices';
import { nomElement } from '../../../shared/data/manoir';
import { combinaisonsPossibles } from '../../../shared/logique';
import { ARMES, LIEUX, SUSPECTS, type ElementId, type Marque, type VueJoueur } from '../../../shared/types';
import { connexion } from '../../connexion';
import { Aide, Prive } from '../Commun';
import { Embleme } from '../Emblemes';
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
  const possibles = combinaisonsPossibles(indices);
  for (const e of [...SUSPECTS, ...LIEUX, ...ARMES] as ElementId[]) {
    if (!possibles.some((t) => t.suspect === e || t.lieu === e || t.arme === e)) s[e] = 'écarté par un indice';
  }
  for (const e of v.cartesPubliques) s[e] = 'carte publique';
  for (const j of v.moi.journal) if (j.type === 'carte_vue') s[j.carte] = `montrée par ${nom(j.de)}`;
  for (const e of v.moi.main) s[e] = 'dans votre main';
  if (v.moi.meurtrier) s[v.moi.meurtrier] = 'le meurtrier (secret)';
  return s;
}

export function Carnet({ vue, nom, onErreur }: { vue: VueJoueur; nom: Noms; onErreur: (e: string) => void }) {
  const [marques, setMarques] = useState(vue.moi.carnet.marques);
  const [notes, setNotes] = useState(vue.moi.carnet.notes);
  const [enregistre, setEnregistre] = useState(true);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const sources = useMemo(() => sourcesConnues(vue, nom), [vue, nom]);

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

  const remplirAutomatiquement = async () => {
    const auto: Partial<Record<ElementId, Marque>> = {};
    for (const [e, src] of Object.entries(sources)) if (src && !src.startsWith('le meurtrier') && !marques[e as ElementId]) auto[e as ElementId] = 'ecarte';
    if (Object.keys(auto).length === 0) return;
    setMarques({ ...marques, ...auto });
    const r = await connexion.action({ type: 'carnet', marques: auto });
    if (!r.ok) onErreur(r.erreur);
  };

  const colonne = (titre: string, ids: readonly ElementId[]) => (
    <div>
      <h4>{titre}</h4>
      {ids.map((e) => {
        const m = marques[e] ?? 'inconnu';
        return (
          <div key={e} className={`carnet-ligne${m === 'ecarte' ? ' ecarte' : ''}`}>
            <div className="nom">
              <Embleme id={e} taille={26} />
              <span>
                <span className="libelle">{nomElement(e)}</span>
                {sources[e] && <span className="source">{sources[e]}</span>}
              </span>
            </div>
            <div className="marques" role="group" aria-label={`Statut de ${nomElement(e)}`}>
              {MARQUES.map((x) => (
                <button key={x.m} type="button" aria-pressed={m === x.m} title={x.long} aria-label={x.long} onClick={() => void marquer(e, x.m)}>
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
    <Prive titre="Carnet de déduction — privé, jamais partagé">
      <div className="ligne" style={{ marginBottom: 10 }}>
        <span className="petit muet">? inconnu · ✗ écarté · ~ probable · ✓ certain</span>
        <span className="espace" />
        <button className="btn btn-petit" onClick={() => void remplirAutomatiquement()}>
          Cocher ce que je sais déjà
        </button>
        <Aide libelle="Aide sur le carnet">
          Coche « écarté » les éléments que vous savez innocents : vos cartes, les cartes publiques, les cartes qu'on vous a montrées et ce que les indices lus
          excluent. Les déductions plus fines restent à votre charge !
        </Aide>
      </div>
      <div className="carnet-grille">
        {colonne('Suspects', SUSPECTS)}
        {colonne('Lieux', LIEUX)}
        {colonne('Armes', ARMES)}
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
          <li key={i}>{texteEntreePrivee(e, nom)}</li>
        ))}
      </ul>
    </Prive>
  );
}
