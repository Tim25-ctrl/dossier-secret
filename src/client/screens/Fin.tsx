import { useCallback, useMemo } from 'react';
import { nomElement } from '../../shared/data/manoir';
import type { EtatClient } from '../../shared/protocole';
import { Carte, CarteIndice, TripletVue, useNotification } from '../components/Commun';
import { Sceau } from '../components/Emblemes';
import { texteEvenement } from '../components/jeu/Textes';
import { connexion } from '../connexion';
import { BoutonQuitter } from '../components/Quitter';

const RAISONS = {
  accusation_correcte: 'Une accusation juste a résolu l’affaire.',
  manches_ecoulees: 'Les 12 manches se sont écoulées sans accusation juste.',
  plus_d_accusateur: 'Tous les enquêteurs se sont trompés dans leur accusation.',
} as const;

export function Fin({ etat }: { etat: EtatClient }) {
  const vue = etat.partie!;
  const r = vue.resultat!;
  const moi = vue.moi.id;
  const noms = useMemo(() => new Map(vue.joueurs.map((j) => [j.id, j.nom])), [vue.joueurs]);
  const nom = useCallback((id: string) => noms.get(id) ?? '?', [noms]);
  const estHote = etat.salon.hote === moi;
  const { afficher, vue: notification } = useNotification();
  const gagne = (r.vainqueur === 'complice') === (vue.moi.role === 'complice');
  const gagnant = r.accusations.find((a) => a.correcte);

  return (
    <main className="page">
      <section className="verdict" aria-live="polite">
        <Sceau taille={70} />
        <h1>{r.vainqueur === 'enqueteurs' ? 'Affaire résolue !' : 'Le complice triomphe'}</h1>
        <p style={{ fontSize: '1.15em' }}>
          {RAISONS[r.raison]} {gagnant && `${nom(gagnant.joueur)} a démasqué le coupable.`}
        </p>
        <p>
          <strong>{gagne ? 'Vous avez gagné.' : 'Vous avez perdu.'}</strong> Le complice était <strong>{nom(r.complice)}</strong>
          {r.complice === moi ? ' (vous)' : ''}.
        </p>
        <div className="ligne" style={{ justifyContent: 'center', marginTop: 12 }}>
          {estHote ? (
            <button
              className="btn btn-or"
              onClick={async () => {
                const x = await connexion.rejouer();
                if (!x.ok) afficher(x.erreur, true);
              }}
            >
              Rejouer avec les mêmes joueurs
            </button>
          ) : (
            <span className="muet">L'hôte peut relancer une nouvelle enquête.</span>
          )}
          <BoutonQuitter etat={etat} libelle="Quitter" classe="btn" />
        </div>
      </section>

      <div className="deux-colonnes">
        <div>
          <section className="panneau">
            <h2>La solution</h2>
            <div className="cartes" style={{ marginBottom: 12 }}>
              <Carte id={r.solution.suspect} />
              <Carte id={r.solution.lieu} />
              <Carte id={r.solution.arme} />
            </div>
            {r.explication.map((p) => (
              <p key={p}>{p}</p>
            ))}
          </section>
          <section className="panneau">
            <h2>Les indices décisifs</h2>
            <div className="indices">
              {r.indicesDecisifs.map((i) => (
                <CarteIndice key={i.indice} id={i.indice} />
              ))}
            </div>
            <p className="muet petit" style={{ marginTop: 10 }}>
              Les cartes distribuées aux joueurs permettaient, elles aussi, d'éliminer les autres pistes.
            </p>
          </section>
        </div>
        <div>
          <section className="panneau">
            <h2>Le complice</h2>
            <p>
              <strong>{nom(r.complice)}</strong> savait depuis le début que le coupable était {nomElement(r.solution.suspect)}.
            </p>
            <ul>
              <li>
                Mensonges utilisés : {r.usagesPouvoirs.mensonges.length} / {vue.regles.mensonges}
                {r.usagesPouvoirs.mensonges.map((m) => (
                  <span key={m.hypothese} className="muet"> (manche {m.manche})</span>
                ))}
              </li>
              <li>
                Hypothèses falsifiées : {r.usagesPouvoirs.falsifications.length} / {vue.regles.falsifications}
                {r.usagesPouvoirs.falsifications.map((f) => (
                  <span key={f.hypothese} className="muet">
                    {' '}
                    (manche {f.manche} : {nomElement(f.de)} → {nomElement(f.vers)})
                  </span>
                ))}
              </li>
            </ul>
          </section>
          <section className="panneau">
            <h2>Accusations</h2>
            {r.accusations.length === 0 && <p className="muet">Aucune accusation.</p>}
            <ul className="journal">
              {r.accusations.map((a, i) => (
                <li key={i} className="important">
                  {nom(a.joueur)} : <TripletVue t={a.triplet} /> — {a.correcte ? 'juste' : 'fausse'}
                </li>
              ))}
            </ul>
          </section>
          <section className="panneau">
            <h2>Les cartes de chacun</h2>
            {vue.joueurs.map((j) => (
              <div key={j.id} style={{ marginBottom: 8 }}>
                <strong>
                  {j.nom}
                  {j.id === r.complice ? ' — complice' : ''}
                </strong>
                <div className="ligne">
                  {(r.mains[j.id] ?? []).map((c) => (
                    <Carte key={c} id={c} taille="mini" />
                  ))}
                </div>
              </div>
            ))}
            {r.cartesRestantes.length > 0 && (
              <div style={{ marginBottom: 8 }}>
                <strong>Pièces à conviction (non distribuées)</strong>
                <div className="ligne">
                  {r.cartesRestantes.map((c) => (
                    <Carte key={c} id={c} taille="mini" />
                  ))}
                </div>
              </div>
            )}
          </section>
          <section className="panneau">
            <h2>Résumé</h2>
            <p>
              {r.manchesJouees} manche(s) jouée(s) · {r.nbHypotheses} hypothèse(s) formulée(s)
            </p>
            <details>
              <summary>Historique complet</summary>
              <ul className="journal" style={{ marginTop: 8 }}>
                {vue.historique.map((ev, i) => {
                  const t = texteEvenement(ev, nom, moi);
                  return t ? (
                    <li key={i} className={t.classe}>
                      {t.contenu}
                    </li>
                  ) : null;
                })}
              </ul>
            </details>
          </section>
        </div>
      </div>
      {notification}
    </main>
  );
}
