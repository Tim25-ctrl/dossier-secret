import { useMemo, useState } from 'react';
import { nomElement } from '../../../shared/data/catalogue';
import {
  elementsDe,
  type AffaireId,
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
      <Selecteur titre="Le meurtrier présumé" ids={elementsDe(vue.affaire).suspects} valeur={t.suspect} choisir={t.setSuspect} sources={sources} />
      <Selecteur titre="Le lieu du crime" ids={elementsDe(vue.affaire).lieux} valeur={t.lieu} choisir={t.setLieu} sources={sources} />
      <Selecteur titre="L'arme" ids={elementsDe(vue.affaire).armes} valeur={t.arme} choisir={t.setArme} sources={sources} />
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

export function ModaleAccusation({ affaire, sources, onFermer, onErreur }: { affaire: AffaireId; sources: Sources; onFermer: () => void; onErreur: (e: string) => void }) {
  const { suspects: SUSPECTS, lieux: LIEUX, armes: ARMES } = elementsDe(affaire);
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
    <div className="resultat-hypothese">
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
    </div>
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
        <h4 className="titre-reponse">✅ Réponse honnête</h4>
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
                <button key={c} className="btn btn-or" disabled={envoi} onClick={() => void envoyer({ type: 'repondre', carte: c })}>
                  Montrer « {nomElement(c)} »
                </button>
              ))}
            </div>
          </>
        )}
        {(a.peutMentir || a.cartesEmpruntables.length > 0) && (
          <section className="ruses-reponse" aria-label="Vos ruses de complice">
            <h4 className="titre-reponse">
              🎭 Ou bien… une ruse de complice
              <span className="etiquette etiquette-rouge">
                {vue.regles.modeComplice === 'ruse' ? `${vue.moi.rusesRestantes} ruse${(vue.moi.rusesRestantes ?? 0) > 1 ? 's' : ''} en réserve` : 'pouvoir du complice'}
              </span>
            </h4>
            <p className="petit muet" style={{ marginTop: 0 }}>
              Personne ne voit que vous rusez.{vue.regles.modeComplice === 'ruse' ? ' Mais une ruse laisse parfois une empreinte, publiée plus tard, qui aide à vous démasquer.' : ''}
            </p>
            {a.peutMentir && (
              <div className="ruse-bloc">
                <div className="ruse-titre">
                  <strong>Mentir</strong>
                  <span className="petit muet">
                    {vue.regles.modeComplice === 'ruse'
                      ? `coûte ${vue.regles.coutRuses.mensonge} ruse`
                      : `${vue.moi.mensongesRestants} restant${(vue.moi.mensongesRestants ?? 0) > 1 ? 's' : ''}`}
                  </span>
                </div>
                <p className="ruse-explication">
                  Vous répondez « aucune carte » alors que vous avez {a.cartesCorrespondantes.map((c) => `« ${nomElement(c)} »`).join(' ou ')}. {nom(h.auteur)} croira que vous
                  n'avez rien, et l'interrogation passe au joueur suivant.
                </p>
                <button className="btn btn-danger btn-petit" disabled={envoi} onClick={() => void envoyer({ type: 'mentir' })}>
                  Mentir : répondre « aucune carte »
                </button>
              </div>
            )}
            {a.cartesEmpruntables.length > 0 && (
              <div className="ruse-bloc">
                <div className="ruse-titre">
                  <strong>Montrer une carte que vous n'avez pas</strong>
                  <span className="petit muet">coûte {vue.regles.coutRuses.emprunt} ruses</span>
                </div>
                <p className="ruse-explication">
                  {nom(h.auteur)} croira que cette carte est innocente. Idéal si c'est le vrai lieu ou la vraie arme : il l'écartera à tort. Sinon, c'est risqué :
                  son vrai détenteur peut la montrer aussi, et la supercherie se voir.
                </p>
                <div className="ligne">
                  {a.cartesEmpruntables.map((c) => (
                    <button key={c} className="btn btn-danger btn-petit" disabled={envoi} onClick={() => void envoyer({ type: 'emprunter', carte: c })}>
                      Montrer « {nomElement(c)} »
                    </button>
                  ))}
                </div>
              </div>
            )}
          </section>
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
  const options = useMemo(() => {
    const e = elementsDe(vue.affaire);
    return (champ === 'suspect' ? e.suspects : champ === 'lieu' ? e.lieux : e.armes).filter((x) => x !== f.original[champ]) as ElementId[];
  }, [champ, f.original, vue.affaire]);

  const envoyer = async (action: Parameters<typeof connexion.action>[0]) => {
    setEnvoi(true);
    const r = await connexion.action(action);
    setEnvoi(false);
    if (!r.ok) onErreur(r.erreur);
  };

  return (
    <Modale titre={`🎭 Ruse : falsifier l'hypothèse de ${nom(h.auteur)} ?`}>
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
            <p className="ruse-explication">
              Vous pouvez changer <strong>un seul</strong> élément avant que l'hypothèse soit annoncée. Les autres joueurs verront la version modifiée ;{' '}
              {nom(h.auteur)} verra toujours la sienne, sans être prévenu. Les cartes montrées restent calculées sur sa vraie hypothèse.
            </p>
            <p className="petit muet">
              {vue.regles.modeComplice === 'ruse'
                ? `Coûte ${vue.regles.coutRuses.falsification} ruse (il vous en reste ${vue.moi.rusesRestantes}). Une ruse laisse parfois une empreinte qui aide à vous démasquer.`
                : `Falsifications restantes : ${vue.moi.falsificationsRestantes}.`}
            </p>
            <h4 className="titre-reponse">1. L'élément à changer</h4>
            <div className="ligne" role="radiogroup" aria-label="Élément à modifier">
              {(['suspect', 'lieu', 'arme'] as const).map((c) => (
                <button key={c} className={`btn btn-petit ${champ === c ? 'btn-or' : ''}`} aria-pressed={champ === c} onClick={() => (setChamp(c), setValeur(null))}>
                  {c === 'suspect' ? 'Le suspect' : c === 'lieu' ? 'Le lieu' : "L'arme"}
                </button>
              ))}
            </div>
            <h4 className="titre-reponse">2. Ce que les autres verront à la place de « {nomElement(f.original[champ])} »</h4>
            <div className="cartes">
              {options.map((o) => (
                <Carte key={o} id={o} onClick={() => setValeur(o)} presse={valeur === o} />
              ))}
            </div>
            <div className="modale-pied">
              <button className="btn btn-discret" disabled={envoi} onClick={() => void envoyer({ type: 'passerFalsification' })}>
                Ne rien changer
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
