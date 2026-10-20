import { useCallback, useMemo } from 'react';
import { INDICES, INDICES_PAR_ID, jourDuJournal } from '../../shared/data/indices';
import { indiceValide } from '../../shared/logique';
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
  // Pages du journal vraies pour la solution : elles racontent la dernière semaine d'Armand sans contradiction.
  const pagesJournal = INDICES.filter((c) => c.categorie === 'journal' && indiceValide(c, r.solution)).sort((a, b) => jourDuJournal(a) - jourDuJournal(b));
  const pagesLues = new Set([...vue.moi.indicesConsultes.map((i) => i.indice), ...vue.indicesPublics.map((i) => i.indice)]);

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
          <section className="panneau">
            <h2>Le journal d'Armand</h2>
            <p className="muet petit">
              La dernière semaine de la victime, telle qu'on peut la reconstituer maintenant que l'affaire est close. Les pages lues pendant la partie sont signalées.
            </p>
            <div className="indices">
              {pagesJournal.map((c) => (
                <div key={c.id}>
                  {pagesLues.has(c.id) && <p className="petit muet" style={{ margin: '0 0 4px' }}>✓ Lue pendant la partie</p>}
                  <CarteIndice id={c.id} ouvert={false} />
                </div>
              ))}
            </div>
          </section>
        </div>
        <div>
          <section className="panneau">
            <h2>Le complice</h2>
            <p>
              <strong>{nom(r.complice)}</strong> savait depuis le début que le coupable était {nomElement(r.solution.suspect)}.
            </p>
            {vue.regles.modeComplice === 'ruse' && (
              <p className="petit muet">
                Mode « complice rusé » : {vue.regles.ruses} ruses au départ.
                {r.denonciations.some((d) => d.correcte) ? ' Il a été démasqué en cours de partie.' : " Il n'a pas été démasqué."}
              </p>
            )}
            <ul>
              <li>
                Mensonges : {r.usagesPouvoirs.mensonges.length}
                {vue.regles.modeComplice !== 'ruse' && ` / ${vue.regles.mensonges}`}
                {r.usagesPouvoirs.mensonges.map((m) => (
                  <span key={m.hypothese} className="muet"> (manche {m.manche})</span>
                ))}
              </li>
              <li>
                Hypothèses falsifiées : {r.usagesPouvoirs.falsifications.length}
                {vue.regles.modeComplice !== 'ruse' && ` / ${vue.regles.falsifications}`}
                {r.usagesPouvoirs.falsifications.map((f) => (
                  <span key={f.hypothese} className="muet">
                    {' '}
                    (manche {f.manche} : {nomElement(f.de)} → {nomElement(f.vers)})
                  </span>
                ))}
              </li>
              {vue.regles.modeComplice === 'ruse' && (
                <>
                  <li>
                    Cartes empruntées : {r.usagesPouvoirs.emprunts.length}
                    {r.usagesPouvoirs.emprunts.map((e) => (
                      <span key={e.hypothese} className="muet">
                        {' '}
                        (manche {e.manche} : « {nomElement(e.carte)} »)
                      </span>
                    ))}
                  </li>
                  <li>
                    Dossiers trafiqués : {r.usagesPouvoirs.trafics.length}
                    {r.usagesPouvoirs.trafics.map((t) => (
                      <span key={t.dossier} className="muet">
                        {' '}
                        (dossier n° {t.dossier}, manche {t.manche} : faux indice « {INDICES_PAR_ID[t.indiceFaux]?.titre} »)
                      </span>
                    ))}
                  </li>
                </>
              )}
            </ul>
            {r.denonciations.length > 0 && (
              <>
                <h4>Dénonciations</h4>
                <ul className="journal">
                  {r.denonciations.map((d, i) => (
                    <li key={i}>
                      {nom(d.joueur)} a dénoncé {nom(d.cible)} — {d.correcte ? 'juste' : 'fausse'}
                    </li>
                  ))}
                </ul>
              </>
            )}
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
