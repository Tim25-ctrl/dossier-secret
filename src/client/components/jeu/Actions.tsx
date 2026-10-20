import { useMemo, useState } from 'react';
import { nomElement } from '../../../shared/data/manoir';
import {
  ARMES,
  LIEUX,
  SUSPECTS,
  type ArmeId,
  type ChampTriplet,
  type ElementId,
  type LieuId,
  type SuspectId,
  type Triplet,
  type VueJoueur,
} from '../../../shared/types';
import { connexion } from '../../connexion';
import { Aide, Carte, Chrono, EntetePublic, Modale, Prive, TripletVue } from '../Commun';
import type { Noms } from './Textes';

type Sources = Partial<Record<ElementId, string>>;

const COURT: Record<string, string> = {
  'dans votre main': 'main',
  'carte publique': 'publique',
  'pièce à conviction': 'pièce',
  'écarté par un indice': 'indice',
  'le meurtrier (secret)': 'meurtrier',
};
const marqueurSource = (s?: string) => (s ? (COURT[s] ?? 'vue') : undefined);

function Selecteur<T extends ElementId>({ titre, ids, valeur, choisir, sources }: { titre: string; ids: readonly T[]; valeur: T | null; choisir: (v: T) => void; sources: Sources }) {
  return (
    <fieldset style={{ border: 'none', padding: 0, margin: '0 0 12px' }}>
      <legend style={{ fontWeight: 600, marginBottom: 6 }}>
        {titre} {valeur && <span className="muet">: {nomElement(valeur)}</span>}
      </legend>
      <div className="cartes">
        {ids.map((id) => (
          <Carte key={id} id={id} onClick={() => choisir(id)} presse={valeur === id} marqueur={marqueurSource(sources[id])} titre={sources[id]} />
        ))}
      </div>
    </fieldset>
  );
}

function useTriplet() {
  const [suspect, setSuspect] = useState<SuspectId | null>(null);
  const [lieu, setLieu] = useState<LieuId | null>(null);
  const [arme, setArme] = useState<ArmeId | null>(null);
  const complet = suspect && lieu && arme ? ({ suspect, lieu, arme } as Triplet) : null;
  return { suspect, lieu, arme, setSuspect, setLieu, setArme, complet };
}

export function ModaleHypothese({ vue, nom, sources, onFermer, onErreur }: { vue: VueJoueur; nom: Noms; sources: Sources; onFermer: () => void; onErreur: (e: string) => void }) {
  const t = useTriplet();
  const [interroges, setInterroges] = useState<string[]>([]);
  const [envoi, setEnvoi] = useState(false);
  const k = vue.regles.nbInterroges;
  const autres = vue.joueurs.filter((j) => j.id !== vue.moi.id);

  const basculer = (id: string) => setInterroges((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length < k ? [...l, id] : l));
  const raison = !t.complet ? 'Choisissez un suspect, un lieu et une arme.' : interroges.length !== k ? `Choisissez ${k} joueur(s) à interroger (${interroges.length}/${k}).` : null;

  const envoyer = async () => {
    if (!t.complet) return;
    setEnvoi(true);
    const r = await connexion.action({ type: 'hypothese', ...t.complet, interroges });
    setEnvoi(false);
    if (r.ok) onFermer();
    else onErreur(r.erreur);
  };

  return (
    <Modale
      titre={`Formuler une hypothèse (${vue.regles.coutHypothese} PA)`}
      onFermer={onFermer}
      pied={
        <>
          {raison && <span className="raison" style={{ marginRight: 'auto', alignSelf: 'center', margin: 0 }}>{raison}</span>}
          <button className="btn btn-discret" onClick={onFermer}>
            Annuler
          </button>
          <button className="btn btn-or" disabled={!!raison || envoi} onClick={() => void envoyer()}>
            Interroger
          </button>
        </>
      }
    >
      <p className="muet petit">
        Une hypothèse n'est pas une accusation : elle sert à obtenir des informations. Les marqueurs rappellent ce que vous savez déjà (« main », « publique »,
        « pièce », « vue », « indice »). Vous pouvez inclure vos propres cartes pour brouiller les pistes.
      </p>
      <Selecteur titre="Le meurtrier présumé" ids={SUSPECTS} valeur={t.suspect} choisir={t.setSuspect} sources={sources} />
      <Selecteur titre="Le lieu du crime" ids={LIEUX} valeur={t.lieu} choisir={t.setLieu} sources={sources} />
      <Selecteur titre="L'arme" ids={ARMES} valeur={t.arme} choisir={t.setArme} sources={sources} />
      <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
        <legend style={{ fontWeight: 600, marginBottom: 6 }}>
          Joueurs à interroger, dans l'ordre ({interroges.length}/{k})
        </legend>
        <div className="ligne">
          {autres.map((j) => {
            const rang = interroges.indexOf(j.id);
            return (
              <button key={j.id} className={`btn ${rang >= 0 ? 'btn-or' : ''}`} aria-pressed={rang >= 0} onClick={() => basculer(j.id)} disabled={rang < 0 && interroges.length >= k}>
                {rang >= 0 && <strong>{rang + 1}.</strong>} {j.nom}
                {!j.connecte && <span className="petit"> (déconnecté)</span>}
              </button>
            );
          })}
        </div>
        <p className="muet petit" style={{ marginTop: 6 }}>
          Cliquez dans l'ordre souhaité : le premier interrogé qui possède une carte correspondante vous en montrera une, en secret.
        </p>
      </fieldset>
    </Modale>
  );
}

export function ModaleAccusation({ sources, onFermer, onErreur }: { sources: Sources; onFermer: () => void; onErreur: (e: string) => void }) {
  const t = useTriplet();
  const [confirmation, setConfirmation] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const envoyer = async () => {
    if (!t.complet) return;
    setEnvoi(true);
    const r = await connexion.action({ type: 'accuser', ...t.complet });
    setEnvoi(false);
    if (r.ok) onFermer();
    else onErreur(r.erreur);
  };
  if (confirmation && t.complet)
    return (
      <Modale
        titre="Confirmer l'accusation finale ?"
        onFermer={onFermer}
        pied={
          <>
            <button className="btn btn-discret" onClick={() => setConfirmation(false)}>
              Revenir
            </button>
            <button className="btn btn-danger" disabled={envoi} onClick={() => void envoyer()}>
              Je confirme mon accusation
            </button>
          </>
        }
      >
        <p>Vous accusez :</p>
        <TripletVue t={t.complet} />
        <div className="erreur" style={{ marginTop: 14 }}>
          <strong>Attention :</strong> si un seul des trois éléments est faux, vous ne pourrez plus jamais accuser pendant cette partie. Vous ne saurez pas lequel était
          faux. Votre accusation sera annoncée à tous.
        </div>
      </Modale>
    );
  return (
    <Modale
      titre="Accusation finale"
      onFermer={onFermer}
      pied={
        <>
          <button className="btn btn-discret" onClick={onFermer}>
            Annuler
          </button>
          <button className="btn btn-danger" disabled={!t.complet} onClick={() => setConfirmation(true)}>
            Accuser…
          </button>
        </>
      }
    >
      <p className="muet petit">Gratuite, mais une seule par joueur et par partie. Les trois éléments doivent être justes.</p>
      <Selecteur titre="Le meurtrier" ids={SUSPECTS} valeur={t.suspect} choisir={t.setSuspect} sources={sources} />
      <Selecteur titre="Le lieu du crime" ids={LIEUX} valeur={t.lieu} choisir={t.setLieu} sources={sources} />
      <Selecteur titre="L'arme" ids={ARMES} valeur={t.arme} choisir={t.setArme} sources={sources} />
    </Modale>
  );
}

/** Suivi de l'hypothèse en cours, visible par tous (avec les parties privées de chacun). */
export function SuiviHypothese({ vue, nom, decalage, delaiFalsification }: { vue: VueJoueur; nom: Noms; decalage: number; delaiFalsification: number }) {
  const h = vue.hypotheseEnCours;
  if (!h) return null;
  const qui = (id: string) => (id === vue.moi.id ? 'vous' : nom(id));
  const carteVue = vue.moi.journal.find((e) => e.type === 'carte_vue' && e.hypothese === h.id);
  return (
    <section className="panneau suivi-hypothese" aria-live="polite">
      <EntetePublic>Hypothèse en cours — {h.auteur === vue.moi.id ? 'la vôtre' : `celle de ${nom(h.auteur)}`}</EntetePublic>
      {/* Coup de tampon du greffier à l'annonce (clé = hypothèse : l'animation ne joue qu'une fois). */}
      {h.etape !== 'falsification' && (
        <span key={h.id} className="tampon-hypothese" aria-hidden="true">
          Hypothèse
        </span>
      )}
      {h.etape === 'falsification' ? (
        <div>
          <p style={{ marginBottom: 4 }}>Le greffier enregistre l'hypothèse… elle sera annoncée dans un instant.</p>
          <Chrono echeance={h.echeance} decalage={decalage} total={delaiFalsification} />
        </div>
      ) : (
        <>
          <TripletVue t={h.triplet!} />
          <ol className="etapes">
            {h.reponses.map((r) => (
              <li key={r.joueur} className={h.repondantActuel === r.joueur ? 'actuel' : ''}>
                <strong>{qui(r.joueur)}</strong>
                <span className="espace" />
                {r.statut === 'attente' && h.repondantActuel === r.joueur && (
                  <>
                    réfléchit… <Chrono echeance={h.echeance} decalage={decalage} />
                  </>
                )}
                {r.statut === 'attente' && h.repondantActuel !== r.joueur && <span className="muet">en attente</span>}
                {r.statut === 'aucune_carte' && <span className="etiquette">aucune carte</span>}
                {r.statut === 'carte_montree' && <span className="etiquette etiquette-or">carte montrée</span>}
              </li>
            ))}
          </ol>
        </>
      )}
      {h.auteurPrive && (
        <div style={{ marginTop: 12 }}>
          <Prive>
            <p style={{ marginBottom: 6 }}>Votre version originale :</p>
            <TripletVue t={h.auteurPrive.original} />
            {carteVue && carteVue.type === 'carte_vue' && (
              <p style={{ marginTop: 8 }}>
                {nom(carteVue.de)} vous montre :{' '}
                <span className="anim-retournement">
                  <Carte id={carteVue.carte} taille="mini" />
                </span>
              </p>
            )}
          </Prive>
        </div>
      )}
    </section>
  );
}

/**
 * Résultat privé de MA dernière hypothèse, affiché jusqu'à la fin de mon tour : l'hypothèse se
 * termine dès qu'une carte est montrée, il faut donc garder la réponse visible ici.
 */
export function ResultatHypothese({ vue, nom }: { vue: VueJoueur; nom: Noms }) {
  if (vue.hypotheseEnCours || vue.joueurActif !== vue.moi.id || vue.hypothesesCeTour === 0) return null;
  const journal = [...vue.moi.journal].reverse();
  const origine = journal.find((e) => e.type === 'hypothese_originale');
  const reponse = journal.find((e) => e.type === 'carte_vue' || e.type === 'aucune_carte_vue');
  if (!origine || !reponse || origine.type !== 'hypothese_originale' || !('hypothese' in reponse) || reponse.hypothese !== origine.hypothese) return null;
  return (
    <Prive titre="Résultat de votre hypothèse — vu par vous seul">
      <TripletVue t={origine.triplet} />
      {reponse.type === 'carte_vue' ? (
        <p style={{ marginTop: 10, marginBottom: 0 }}>
          {nom(reponse.de)} vous montre :{' '}
          <span key={reponse.hypothese} className="anim-retournement">
            <Carte id={reponse.carte} taille="mini" />
          </span>
        </p>
      ) : (
        <p style={{ marginTop: 10, marginBottom: 0 }}>Personne ne vous a montré de carte. Attention : cela ne prouve pas que l'hypothèse est juste.</p>
      )}
    </Prive>
  );
}

/** Interface privée de la personne interrogée (réponse obligatoire, sans coût en PA). */
export function ModaleReponse({ vue, nom, decalage, onErreur }: { vue: VueJoueur; nom: Noms; decalage: number; onErreur: (e: string) => void }) {
  const h = vue.hypotheseEnCours!;
  const a = h.aRepondre!;
  const [envoi, setEnvoi] = useState(false);
  const envoyer = async (action: Parameters<typeof connexion.action>[0]) => {
    setEnvoi(true);
    const r = await connexion.action(action);
    setEnvoi(false);
    if (!r.ok) onErreur(r.erreur);
  };
  return (
    <Modale titre={`${nom(h.auteur)} vous interroge`}>
      <Prive titre="Réponse privée — seul l'enquêteur verra la carte">
        <p style={{ marginBottom: 6 }}>Hypothèse annoncée :</p>
        <TripletVue t={h.triplet!} />
        <p style={{ marginTop: 10 }}>
          Temps restant : <Chrono echeance={h.echeance} decalage={decalage} /> <span className="muet petit">(passé ce délai, une réponse honnête est donnée automatiquement)</span>
        </p>
        {a.cartesCorrespondantes.length === 0 ? (
          <>
            <p>Vous n'avez aucune carte correspondante.</p>
            <button className="btn btn-or" disabled={envoi} onClick={() => void envoyer({ type: 'repondre', carte: null })}>
              Répondre : « aucune carte »
            </button>
          </>
        ) : (
          <>
            <p>Vous devez montrer une de ces cartes (au choix) :</p>
            <div className="ligne">
              {a.cartesCorrespondantes.map((c) => (
                <button key={c} className="btn" disabled={envoi} onClick={() => void envoyer({ type: 'repondre', carte: c })}>
                  Montrer « {nomElement(c)} »
                </button>
              ))}
            </div>
            {a.peutMentir && (
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--or-sombre)' }}>
                <div className="ligne">
                  <button className="btn btn-danger" disabled={envoi} onClick={() => void envoyer({ type: 'mentir' })}>
                    {vue.regles.modeComplice === 'ruse'
                      ? `Ruse « Mensonge » (${vue.regles.coutRuses.mensonge} ruse — reste ${vue.moi.rusesRestantes})`
                      : `Utiliser « Mensonge » (${vue.moi.mensongesRestants} restant${(vue.moi.mensongesRestants ?? 0) > 1 ? 's' : ''})`}
                  </button>
                  <Aide libelle="Aide sur le pouvoir Mensonge">
                    Pouvoir du complice : vous ne montrez aucune carte et tout le monde croit que vous n'en avez pas. L'interrogation continue avec le joueur suivant.
                    Vos cartes ne changent pas.
                  </Aide>
                </div>
              </div>
            )}
          </>
        )}
        {a.cartesEmpruntables.length > 0 && (
          <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px dashed var(--or-sombre)' }}>
            <div className="ligne" style={{ marginBottom: 6 }}>
              <strong>Ruse « Carte empruntée »</strong> <span className="petit">({vue.regles.coutRuses.emprunt} ruses — reste {vue.moi.rusesRestantes})</span>
              <Aide libelle="Aide sur la carte empruntée">
                Montrez une carte de l'hypothèse que vous n'avez PAS : l'enquêteur la croira innocente. Attention : vous ignorez le lieu et l'arme du crime, la carte
                montrée peut donc être innocente… ou faire partie de la solution. Si son vrai détenteur la montre aussi, la supercherie peut être découverte.
              </Aide>
            </div>
            <div className="ligne">
              {a.cartesEmpruntables.map((c) => (
                <button key={c} className="btn btn-danger btn-petit" disabled={envoi} onClick={() => void envoyer({ type: 'emprunter', carte: c })}>
                  Montrer « {nomElement(c)} » sans l'avoir
                </button>
              ))}
            </div>
          </div>
        )}
      </Prive>
    </Modale>
  );
}

/** Dénoncer le complice (mode « rusé ») : 1 PA, une fois par partie. */
export function ModaleDenonciation({ vue, nom, onFermer, onErreur }: { vue: VueJoueur; nom: Noms; onFermer: () => void; onErreur: (e: string) => void }) {
  const [cible, setCible] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const envoyer = async () => {
    if (!cible) return;
    setEnvoi(true);
    const r = await connexion.action({ type: 'denoncer', joueur: cible });
    setEnvoi(false);
    if (r.ok) onFermer();
    else onErreur(r.erreur);
  };
  return (
    <Modale
      titre="Dénoncer le complice (1 PA)"
      onFermer={onFermer}
      pied={
        <>
          <button className="btn btn-discret" onClick={onFermer}>
            Annuler
          </button>
          <button className="btn btn-danger" disabled={!cible || envoi} onClick={() => void envoyer()}>
            Dénoncer {cible ? nom(cible) : '…'}
          </button>
        </>
      }
    >
      <p>Qui est le complice ? Une seule dénonciation par joueur et par partie.</p>
      <ul className="petit" style={{ paddingLeft: '1.1em' }}>
        <li>
          <strong>Si vous avez raison</strong>, le complice est démasqué devant tous et perd toutes ses ruses.
        </li>
        <li>
          <strong>Si vous vous trompez</strong>, vous perdez votre prochain tour.
        </li>
      </ul>
      <div className="ligne">
        {vue.joueurs
          .filter((j) => j.id !== vue.moi.id)
          .map((j) => (
            <button key={j.id} className={`btn ${cible === j.id ? 'btn-danger' : ''}`} aria-pressed={cible === j.id} onClick={() => setCible(j.id)}>
              {nom(j.id)}
            </button>
          ))}
      </div>
    </Modale>
  );
}

/** Interface privée du complice : falsifier l'hypothèse d'un autre joueur. */
export function ModaleFalsification({ vue, nom, decalage, delai, onErreur }: { vue: VueJoueur; nom: Noms; decalage: number; delai: number; onErreur: (e: string) => void }) {
  const h = vue.hypotheseEnCours!;
  const f = h.falsification!;
  const [champ, setChamp] = useState<ChampTriplet>('suspect');
  const [valeur, setValeur] = useState<ElementId | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const options = useMemo(() => (champ === 'suspect' ? SUSPECTS : champ === 'lieu' ? LIEUX : ARMES).filter((x) => x !== f.original[champ]) as ElementId[], [champ, f.original]);

  const envoyer = async (action: Parameters<typeof connexion.action>[0]) => {
    setEnvoi(true);
    const r = await connexion.action(action);
    setEnvoi(false);
    if (!r.ok) onErreur(r.erreur);
  };

  return (
    <Modale titre="Pouvoir : hypothèse falsifiée">
      <Prive titre="Complice — décision secrète">
        <p style={{ marginBottom: 6 }}>{nom(h.auteur)} vient de formuler :</p>
        <TripletVue t={f.original} />
        <p style={{ marginTop: 8 }}>
          Temps pour décider : <Chrono echeance={h.echeance} decalage={decalage} total={delai} />
        </p>
        {f.decide ? (
          <p>Décision enregistrée. L'hypothèse sera annoncée à la fin du délai.</p>
        ) : (
          <>
            <p className="petit">
              Vous pouvez modifier <strong>un seul</strong> élément avant l'annonce publique (
              {vue.regles.modeComplice === 'ruse' ? `${vue.regles.coutRuses.falsification} ruse — il vous en reste ${vue.moi.rusesRestantes}` : `reste : ${vue.moi.falsificationsRestantes}`}
              ). L'auteur continuera de voir sa version originale, sans être prévenu ; les réponses seront calculées sur l'original.
            </p>
            <div className="ligne" role="radiogroup" aria-label="Élément à modifier">
              {(['suspect', 'lieu', 'arme'] as const).map((c) => (
                <button key={c} className={`btn btn-petit ${champ === c ? 'btn-or' : ''}`} aria-pressed={champ === c} onClick={() => (setChamp(c), setValeur(null))}>
                  {c === 'suspect' ? 'Le suspect' : c === 'lieu' ? 'Le lieu' : "L'arme"}
                </button>
              ))}
            </div>
            <div className="cartes" style={{ marginTop: 10 }}>
              {options.map((o) => (
                <Carte key={o} id={o} onClick={() => setValeur(o)} presse={valeur === o} />
              ))}
            </div>
            <div className="modale-pied">
              <button className="btn btn-discret" disabled={envoi} onClick={() => void envoyer({ type: 'passerFalsification' })}>
                Laisser passer
              </button>
              <button className="btn btn-danger" disabled={!valeur || envoi} onClick={() => valeur && void envoyer({ type: 'falsifier', champ, valeur })}>
                Falsifier ({nomElement(f.original[champ])} → {valeur ? nomElement(valeur) : '…'})
              </button>
            </div>
          </>
        )}
      </Prive>
    </Modale>
  );
}
