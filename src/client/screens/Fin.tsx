import { useCallback, useEffect, useMemo, type ReactNode } from 'react';
import { jouer } from '../sons';
import { AFFAIRES, INDICES_PAR_ID, indicesDe } from '../../shared/data/catalogue';
import { jourDuJournal } from '../../shared/data/indices';
import { indiceValide } from '../../shared/logique';
import { nomElement } from '../../shared/data/catalogue';
import type { EtatClient } from '../../shared/protocole';
import type { VueJoueur } from '../../shared/types';
import { Carte, CarteIndice, TripletVue, useNotification } from '../components/Commun';
import { Sceau } from '../components/Emblemes';
import { texteEvenement } from '../components/jeu/Textes';
import { connexion } from '../connexion';
import { BoutonQuitter } from '../components/Quitter';
import { Grade } from '../components/Profil';
import { bilanPartie } from '../profil';

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
  // Profil : la partie est comptée une fois (pas les parties guidées).
  const bilan = etat.salon.code.startsWith('GUIDE') ? null : bilanPartie(vue);
  useEffect(() => {
    jouer(gagne ? 'victoire' : 'defaite');
  }, [vue.partieId]); // eslint-disable-line react-hooks/exhaustive-deps
  // Pages du carnet de la victime vraies pour la solution : elles racontent sa dernière semaine sans contradiction.
  const infos = AFFAIRES[vue.affaire];
  const pagesJournal = indicesDe(vue.affaire).filter((c) => c.categorie === 'journal' && indiceValide(c, r.solution)).sort((a, b) => jourDuJournal(a) - jourDuJournal(b));
  const pagesLues = new Set([...vue.moi.indicesConsultes.map((i) => i.indice), ...vue.indicesPublics.map((i) => i.indice)]);

  return (
    <main className="page">
      <section className="verdict" aria-live="polite">
        <span className="sceau-appose">
          <Sceau taille={70} />
        </span>
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

      {bilan && (
        <section className="panneau bilan-profil" aria-label="Votre progression">
          <Grade profil={bilan.profil} />
          {bilan.nouveaux.length > 0 && (
            <ul className="liste-succes nouveaux">
              {bilan.nouveaux.map((s) => (
                <li key={s.id} className="obtenu">
                  <span className="icone-succes" aria-hidden="true">
                    {s.icone}
                  </span>
                  <span>
                    <strong>Nouveau succès : {s.titre}</strong>
                    <span className="petit muet">{s.description}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

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
            <h2>{infos.journal.libelle.replace(/^(Journal|Carnet)/, (m) => `Le ${m.toLowerCase()}`)}</h2>
            <p className="muet petit">{infos.journal.fin}</p>
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
            <h4>Ses ruses, manche par manche</h4>
            <FriseComplice vue={vue} nom={nom} />
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
                  const t = texteEvenement(ev, nom, moi, vue.affaire);
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

interface MomentFrise {
  /** Position dans l'historique : ordre chronologique exact. */
  rang: number;
  manche: number;
  icone: string;
  texte: ReactNode;
  classe?: string;
}

/**
 * Révélation de fin de partie : chaque ruse du complice, à la manche où elle a eu lieu et avec sa
 * victime, mêlée aux empreintes et aux dénonciations qu'elle a provoquées.
 */
/** « de Bob », « d’Eva ». */
export const deNom = (n: string) => (/^[aeiouyhàâéèêëîïôöûüœ]/i.test(n) ? `d’${n}` : `de ${n}`);

export function FriseComplice({ vue, nom }: { vue: VueJoueur; nom: (id: string) => string }) {
  const r = vue.resultat!;
  const c = <strong>{nom(r.complice)}</strong>;
  const moments: MomentFrise[] = [];

  // Manche de chaque événement de l'historique, et position des hypothèses / consultations.
  let manche = 1;
  const mancheDe: number[] = [];
  const hypotheses = new Map<string, { rang: number; auteur: string }>();
  vue.historique.forEach((ev, i) => {
    if (ev.type === 'debut_manche') manche = ev.manche;
    mancheDe[i] = manche;
    if (ev.type === 'hypothese') hypotheses.set(ev.id, { rang: i, auteur: ev.auteur });
    if (ev.type === 'empreinte')
      moments.push({
        rang: i,
        manche,
        icone: '👣',
        classe: 'frise-indice',
        texte: ev.innocente ? (
          <>Une empreinte est publiée : elle innocente {nom(ev.innocente)}.</>
        ) : (
          <>Une empreinte est publiée : elle trahit une ruse jouée à la manche {ev.mancheRuse}.</>
        ),
      });
    if (ev.type === 'denonciation')
      moments.push({
        rang: i,
        manche,
        icone: '🎭',
        classe: 'frise-indice',
        texte: (
          <>
            {nom(ev.joueur)} dénonce {nom(ev.cible)} : {ev.correcte ? <strong>juste !</strong> : 'à tort.'}
          </>
        ),
      });
  });
  const hyp = (id: string) => hypotheses.get(id) ?? { rang: -1, auteur: '' };

  for (const m of r.usagesPouvoirs.mensonges) {
    const h = hyp(m.hypothese);
    moments.push({
      rang: h.rang + 0.5,
      manche: m.manche,
      icone: '🤥',
      texte: (
        <>
          {c} ment à {nom(h.auteur)} : réponse « aucune carte », alors qu'une de ses cartes correspondait.
        </>
      ),
    });
  }
  for (const f of r.usagesPouvoirs.falsifications) {
    const h = hyp(f.hypothese);
    moments.push({
      rang: h.rang - 0.5,
      manche: f.manche,
      icone: '✏️',
      texte: (
        <>
          {c} falsifie l'hypothèse {deNom(nom(h.auteur))} : les autres lisent « {nomElement(f.vers)} » au lieu de « {nomElement(f.de)} ».
        </>
      ),
    });
  }
  for (const e of r.usagesPouvoirs.emprunts) {
    const h = hyp(e.hypothese);
    const bonne = e.carte === r.solution.lieu || e.carte === r.solution.arme;
    moments.push({
      rang: h.rang + 0.5,
      manche: e.manche,
      icone: '🃏',
      texte: (
        <>
          {c} montre à {nom(h.auteur)} « {nomElement(e.carte)} », une carte absente de son jeu{bonne ? <> : c'était justement la bonne !</> : '.'}
        </>
      ),
    });
  }
  for (const t of r.usagesPouvoirs.trafics) {
    // Sa propre consultation du dossier, puis ceux qui ont lu le faux indice ensuite.
    const rang = vue.historique.findIndex((ev) => ev.type === 'archive' && ev.dossier === t.dossier && ev.joueur === r.complice);
    const lecteurs = [
      ...new Set(vue.historique.flatMap((ev, i) => (ev.type === 'archive' && ev.dossier === t.dossier && i > rang && ev.joueur !== r.complice ? [ev.joueur] : []))),
    ];
    moments.push({
      rang,
      manche: t.manche,
      icone: '📁',
      texte: (
        <>
          {c} trafique le dossier n° {t.dossier} : ses lecteurs suivants y trouvent un faux indice, « {INDICES_PAR_ID[t.indiceFaux]?.titre} ».
          {lecteurs.length > 0 && <> Tombé{lecteurs.length > 1 ? 's' : ''} dans le piège : {lecteurs.map(nom).join(', ')}.</>}
        </>
      ),
    });
  }

  if (!moments.some((m) => m.icone !== '👣' && m.icone !== '🎭'))
    return <p className="muet">{nom(r.complice)} n'a utilisé aucune ruse : une partie jouée honnêtement… ou très prudemment.</p>;

  moments.sort((a, b) => a.manche - b.manche || a.rang - b.rang);
  const parManche = [...new Set(moments.map((m) => m.manche))];
  return (
    <ol className="frise">
      {parManche.map((n) => (
        <li key={n} className="frise-manche">
          <span className="frise-numero">Manche {n}</span>
          <ul>
            {moments
              .filter((m) => m.manche === n)
              .map((m, i) => (
                <li key={i} className={m.classe}>
                  <span className="frise-icone" aria-hidden="true">
                    {m.icone}
                  </span>
                  <span>{m.texte}</span>
                </li>
              ))}
          </ul>
        </li>
      ))}
    </ol>
  );
}
