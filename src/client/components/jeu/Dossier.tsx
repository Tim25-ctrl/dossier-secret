import { useState } from 'react';
import { INDICES_PAR_ID } from '../../../shared/data/indices';
import { ARMES_FICHES, LIEUX_FICHES, PERSONNAGES } from '../../../shared/data/manoir';
import { ARMES, LIEUX, SUSPECTS, type ElementId, type VueJoueur } from '../../../shared/types';
import { Embleme } from '../Emblemes';

/** Pistes connues du joueur (indices publics ou consultés) qui concernent un élément. */
function pistes(vue: VueJoueur, e: ElementId) {
  const ids = [...vue.indicesPublics.map((i) => i.indice), ...vue.moi.indicesConsultes.map((i) => i.indice)];
  return ids.map((id) => INDICES_PAR_ID[id]).filter((c) => c.concerne.includes(e));
}

export function Dossier({ vue }: { vue: VueJoueur }) {
  const [section, setSection] = useState<'suspects' | 'lieux' | 'armes'>('suspects');
  return (
    <div>
      <div className="ligne" role="tablist" aria-label="Sections du dossier" style={{ marginBottom: 12 }}>
        {(['suspects', 'lieux', 'armes'] as const).map((s) => (
          <button key={s} role="tab" aria-selected={section === s} className={`btn btn-petit ${section === s ? 'btn-or' : ''}`} onClick={() => setSection(s)}>
            {s === 'suspects' ? 'Les six suspects' : s === 'lieux' ? 'Les six lieux' : 'Les six armes'}
          </button>
        ))}
      </div>
      <div className="indices">
        {section === 'suspects' &&
          SUSPECTS.map((id) => {
            const p = PERSONNAGES[id];
            return (
              <article key={id} className="panneau fiche">
                <Embleme id={id} taille={96} />
                <div>
                  <h3 style={{ marginBottom: 2 }}>{p.nom}</h3>
                  <p className="muet" style={{ fontStyle: 'italic' }}>
                    {p.titre} — {p.description}
                  </p>
                  <dl>
                    <dt>Histoire</dt>
                    <dd>{p.histoire}</dd>
                    <dt>Relation</dt>
                    <dd>{p.relation}</dd>
                    <dt>Mobile possible</dt>
                    <dd>{p.mobile}</dd>
                    <dt>Secret</dt>
                    <dd>{p.secret}</dd>
                    <dt>Alibi déclaré</dt>
                    <dd>{p.alibi}</dd>
                    <dt>Ce qu'il sait</dt>
                    <dd>{p.connaissances}</dd>
                    <dt>Pistes connues</dt>
                    <dd>{listePistes(vue, id)}</dd>
                  </dl>
                </div>
              </article>
            );
          })}
        {section === 'lieux' &&
          LIEUX.map((id) => {
            const l = LIEUX_FICHES[id];
            return (
              <article key={id} className="panneau fiche">
                <Embleme id={id} taille={96} />
                <div>
                  <h3>{l.nom}</h3>
                  <p>{l.description}</p>
                  <dl>
                    <dt>À observer</dt>
                    <dd>{l.details.join(' · ')}</dd>
                    <dt>Pistes connues</dt>
                    <dd>{listePistes(vue, id)}</dd>
                  </dl>
                </div>
              </article>
            );
          })}
        {section === 'armes' &&
          ARMES.map((id) => {
            const a = ARMES_FICHES[id];
            return (
              <article key={id} className="panneau fiche">
                <Embleme id={id} taille={96} />
                <div>
                  <h3>{a.nom}</h3>
                  <p>{a.description}</p>
                  <dl>
                    <dt>Caractéristiques</dt>
                    <dd>{a.caracteristiques.join(' · ')}</dd>
                    <dt>Pistes connues</dt>
                    <dd>{listePistes(vue, id)}</dd>
                  </dl>
                </div>
              </article>
            );
          })}
      </div>
    </div>
  );
}

function listePistes(vue: VueJoueur, e: ElementId) {
  const p = pistes(vue, e);
  if (p.length === 0) return <span className="muet">Aucune pour l'instant.</span>;
  return p.map((c) => `« ${c.titre} »`).join(', ');
}
