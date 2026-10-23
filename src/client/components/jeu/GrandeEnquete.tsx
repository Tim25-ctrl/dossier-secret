// Écrans propres à la « Grande enquête » : rôle secret et pouvoirs, tableau d'enquête, dernière chance du complice.

import { useState, type ReactNode } from 'react';
import { nomElement } from '../../../shared/data/catalogue';
import { elementsDe, type ActionJeu, type Categorie, type CibleEpingle, type ElementId, type EtiquetteEpingle, type VueJoueur } from '../../../shared/types';
import { connexion } from '../../connexion';
import { LIBELLES_ETIQUETTES, NOMS_OBJECTIFS, NOMS_ROLES, POUVOIRS_ROLES, roleAvecArticle, texteObjectif } from '../../grande';
import { Aide, Chrono, EntetePublic, Modale } from '../Commun';
import { Embleme } from '../Emblemes';
import type { Noms } from './Textes';

const CATEGORIES: { c: Categorie; libelle: string }[] = [
  { c: 'suspect', libelle: 'Les suspects' },
  { c: 'lieu', libelle: 'Les lieux' },
  { c: 'arme', libelle: 'Les armes' },
  { c: 'mobile', libelle: 'Les mobiles' },
];

function elementsDeCategorie(vue: VueJoueur, c: Categorie): readonly ElementId[] {
  const e = elementsDe(vue.affaire);
  return c === 'suspect' ? e.suspects : c === 'lieu' ? e.lieux : c === 'arme' ? e.armes : e.mobiles;
}

// ---------------------------------------------------------------------------
// Rôle secret : ce que le joueur sait, son pouvoir, ce qu'il a appris
// ---------------------------------------------------------------------------

/** Partie « Grande enquête » du panneau privé : rôle, connaissance, objectif, découvertes. */
export function InfosRoleGrande({ vue, nom }: { vue: VueJoueur; nom: Noms }) {
  const m = vue.moi;
  const decouvertes = m.journal.flatMap((e) => {
    if (e.type === 'verification') return [`Hypothèse ${e.hypothese} : ${e.honnete ? 'toutes les réponses étaient honnêtes.' : 'une réponse était une ruse du complice !'}`];
    if (e.type === 'expertise') return [`Innocents : ${e.innocents.map(nomElement).join(' et ')}.`];
    if (e.type === 'dossier_verifie') return [`Dossier n° ${e.dossier} : ${e.trafique ? 'il a été trafiqué !' : "il n'a pas été trafiqué."}`];
    if (e.type === 'profilage') return [`${e.joueurs.map(nom).join(' ou ')} : ${e.complicePresent ? "le complice est l'un des deux." : "le complice n'est aucun des deux."}`];
    return [];
  });
  return (
    <div className="role-grande">
      {m.role === 'maitre_chanteur' && (
        <>
          <h3 style={{ color: 'var(--violet, #6b3fa0)', marginBottom: 4 }}>Vous êtes le Maître chanteur</h3>
          <p className="petit" style={{ marginBottom: 6 }}>
            Vous savez pourquoi la victime a été tuée : le mobile est <strong>{nomElement(m.mobileConnu!)}</strong>. Vous gagnez <strong>seul</strong> si vous faites
            vous-même l'accusation juste ; si un autre trouve avant vous, vous perdez. Vous répondez honnêtement aux interrogations.
          </p>
        </>
      )}
      {m.roleEnquete && (
        <>
          <h3 style={{ marginBottom: 4 }}>
            Vous êtes {roleAvecArticle(m.roleEnquete)}{' '}
            <Aide libelle={`Aide sur le rôle ${NOMS_ROLES[m.roleEnquete]}`}>{POUVOIRS_ROLES[m.roleEnquete]}</Aide>
          </h3>
          {m.roleEnquete === 'temoin' && m.lieuConnu && (
            <p className="petit" style={{ marginBottom: 6 }}>
              Le crime a eu lieu : <strong>{nomElement(m.lieuConnu)}</strong>. Restez discret : si le complice vous démasque à la fin, il peut voler la victoire.
            </p>
          )}
          {m.roleEnquete !== 'temoin' && <p className="petit" style={{ marginBottom: 6 }}>{POUVOIRS_ROLES[m.roleEnquete]}</p>}
          <PouvoirsRestants vue={vue} />
        </>
      )}
      {m.objectif && (
        <p className="petit objectif-complice" style={{ marginBottom: 6 }}>
          🎯 <strong>Objectif secret — {NOMS_OBJECTIFS[m.objectif.type]}</strong> : {texteObjectif(m.objectif)}
        </p>
      )}
      {decouvertes.length > 0 && (
        <>
          <h4>Ce que votre rôle vous a appris</h4>
          <ul className="petit" style={{ margin: '0 0 8px', paddingLeft: '1.1em' }}>
            {decouvertes.map((d, i) => (
              <li key={i}>{d}</li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}

function PouvoirsRestants({ vue }: { vue: VueJoueur }) {
  const p = vue.moi.pouvoirsRole ?? {};
  const etiquettes: string[] = [];
  if (p.verifications !== undefined) etiquettes.push(`Vérifications : ${p.verifications}`);
  if (p.expertises !== undefined) etiquettes.push(`Expertise : ${p.expertises}`);
  if (p.archivesGratuites !== undefined) etiquettes.push(`Consultations gratuites : ${p.archivesGratuites}`);
  if (p.verificationsDossier !== undefined) etiquettes.push(`Vérification de dossier : ${p.verificationsDossier}`);
  if (p.profilages !== undefined) etiquettes.push(`Profilage : ${p.profilages}`);
  if (p.rumeurs !== undefined) etiquettes.push(`Épingles en plus : ${p.rumeurs}`);
  if (!etiquettes.length) return null;
  return (
    <div className="ligne petit" style={{ marginBottom: 8 }}>
      {etiquettes.map((e) => (
        <span key={e} className="etiquette etiquette-or">
          {e}
        </span>
      ))}
    </div>
  );
}

/** Boutons des pouvoirs de rôle, pendant son tour. */
export function BoutonsPouvoirs({ vue, nom, monTour, onErreur }: { vue: VueJoueur; nom: Noms; monTour: boolean; onErreur: (e: string) => void }) {
  const [fenetre, setFenetre] = useState<'expertise' | 'profilage' | 'dossier' | null>(null);
  const r = vue.regles.roles;
  const p = vue.moi.pouvoirsRole;
  if (!r || !p || !vue.moi.roleEnquete) return null;
  const agir = async (a: ActionJeu) => {
    const res = await connexion.action(a);
    if (!res.ok) onErreur(res.erreur);
    else setFenetre(null);
    return res.ok;
  };
  const boutons: ReactNode[] = [];
  switch (vue.moi.roleEnquete) {
    case 'inspecteur':
      if ((p.verifications ?? 0) > 0)
        boutons.push(
          <button
            key="i"
            className="btn"
            disabled={!monTour || vue.hypothesesCeTour === 0}
            title={vue.hypothesesCeTour === 0 ? 'Juste après votre hypothèse, pendant le même tour.' : undefined}
            onClick={() => void agir({ type: 'verifierReponses' })}
          >
            🔍 Vérifier les réponses ({p.verifications})
          </button>,
        );
      break;
    case 'legiste':
      if ((p.expertises ?? 0) > 0)
        boutons.push(
          <button
            key="l"
            className="btn"
            disabled={!monTour || vue.manche < r.mancheExpertise}
            title={vue.manche < r.mancheExpertise ? `À partir de la manche ${r.mancheExpertise}.` : undefined}
            onClick={() => setFenetre('expertise')}
          >
            🧪 Expertise{vue.manche < r.mancheExpertise ? ` (manche ${r.mancheExpertise})` : ''}
          </button>,
        );
      break;
    case 'archiviste':
      if ((p.verificationsDossier ?? 0) > 0)
        boutons.push(
          <button key="a" className="btn" disabled={!monTour} onClick={() => setFenetre('dossier')}>
            🗂 Vérifier un dossier
          </button>,
        );
      break;
    case 'profileur':
      if ((p.profilages ?? 0) > 0)
        boutons.push(
          <button
            key="p"
            className="btn"
            disabled={!monTour || vue.manche < r.mancheProfilage}
            title={vue.manche < r.mancheProfilage ? `À partir de la manche ${r.mancheProfilage}.` : undefined}
            onClick={() => setFenetre('profilage')}
          >
            🧠 Profilage{vue.manche < r.mancheProfilage ? ` (manche ${r.mancheProfilage})` : ''}
          </button>,
        );
      break;
  }
  if (!boutons.length) return null;
  return (
    <>
      <div className="actions pouvoirs-role" aria-label="Pouvoir de votre rôle (secret)">
        <span className="petit muet">Votre pouvoir (secret, sans point d'action) :</span>
        {boutons}
      </div>
      {fenetre === 'expertise' && <ModaleExpertise vue={vue} onFermer={() => setFenetre(null)} onAgir={agir} />}
      {fenetre === 'profilage' && <ModaleProfilage vue={vue} nom={nom} onFermer={() => setFenetre(null)} onAgir={agir} />}
      {fenetre === 'dossier' && <ModaleVerifDossier vue={vue} onFermer={() => setFenetre(null)} onAgir={agir} />}
    </>
  );
}

type Agir = (a: ActionJeu) => Promise<boolean>;

function ModaleExpertise({ vue, onFermer, onAgir }: { vue: VueJoueur; onFermer: () => void; onAgir: Agir }) {
  return (
    <Modale titre="🧪 Expertise du Légiste" onFermer={onFermer}>
      <p>Choisissez une catégorie : vous apprendrez, en secret, deux éléments innocents. Vous n'avez qu'une expertise.</p>
      <div className="ligne">
        {CATEGORIES.map(({ c, libelle }) => (
          <button key={c} className="btn" onClick={() => void onAgir({ type: 'expertiser', categorie: c })}>
            {libelle}
          </button>
        ))}
      </div>
    </Modale>
  );
}

function ModaleProfilage({ vue, nom, onFermer, onAgir }: { vue: VueJoueur; nom: Noms; onFermer: () => void; onAgir: Agir }) {
  const [choix, setChoix] = useState<string[]>([]);
  const autres = vue.joueurs.filter((j) => j.id !== vue.moi.id);
  const basculer = (id: string) => setChoix((l) => (l.includes(id) ? l.filter((x) => x !== id) : l.length < 2 ? [...l, id] : l));
  return (
    <Modale
      titre="🧠 Profilage"
      onFermer={onFermer}
      pied={
        <>
          <button className="btn btn-discret" onClick={onFermer}>
            Annuler
          </button>
          <button className="btn btn-or" disabled={choix.length !== 2} onClick={() => void onAgir({ type: 'profiler', joueurs: choix })}>
            Profiler ces deux joueurs
          </button>
        </>
      }
    >
      <p>Désignez deux joueurs : vous apprendrez si le complice est l'un des deux (sans savoir lequel). Vous n'avez qu'un profilage.</p>
      <div className="ligne">
        {autres.map((j) => (
          <button key={j.id} className={`btn ${choix.includes(j.id) ? 'btn-or' : ''}`} aria-pressed={choix.includes(j.id)} onClick={() => basculer(j.id)}>
            {nom(j.id)}
          </button>
        ))}
      </div>
    </Modale>
  );
}

function ModaleVerifDossier({ vue, onFermer, onAgir }: { vue: VueJoueur; onFermer: () => void; onAgir: Agir }) {
  const dossiers = vue.archives.filter((a) => a.categorie !== 'piece' && a.disponible);
  return (
    <Modale titre="🗂 Vérifier un dossier" onFermer={onFermer}>
      <p>Choisissez un dossier d'indice ouvert : vous apprendrez s'il a été trafiqué par le complice (jusqu'à maintenant). Vous n'avez qu'une vérification.</p>
      <div className="ligne">
        {dossiers.map((d) => (
          <button key={d.dossier} className="btn" onClick={() => void onAgir({ type: 'verifierDossier', dossier: d.dossier })}>
            Dossier n° {d.dossier}
            {d.consulte ? ' (lu)' : ''}
          </button>
        ))}
        {dossiers.length === 0 && <p className="muet">Aucun dossier d'indice n'est encore ouvert.</p>}
      </div>
    </Modale>
  );
}

// ---------------------------------------------------------------------------
// Tableau d'enquête
// ---------------------------------------------------------------------------

export function TableauEnquete({ vue, nom, onErreur }: { vue: VueJoueur; nom: Noms; onErreur: (e: string) => void }) {
  const tableau = vue.tableau ?? [];
  const moi = vue.moi.id;
  const dejaCetteManche = tableau.some((e) => e.auteur === moi && !e.rumeur && e.manche === vue.manche);
  const rumeursRestantes = vue.moi.roleEnquete === 'journaliste' ? (vue.moi.pouvoirsRole?.rumeurs ?? 0) : 0;
  const rumeurCetteManche = tableau.some((e) => e.auteur === moi && e.rumeur && e.manche === vue.manche);
  const enCours = vue.etape === 'tour' || vue.etape === 'hypothese';
  const agir = async (a: ActionJeu) => {
    const r = await connexion.action(a);
    if (!r.ok) onErreur(r.erreur);
    return r.ok;
  };
  return (
    <section className="panneau tableau-enquete">
      <EntetePublic>Tableau d'enquête — visible par tous</EntetePublic>
      <p className="muet petit" style={{ marginTop: 0 }}>
        Épinglez un soupçon : gratuit, à tout moment. Chacun n'a <strong>qu'une épingle</strong> au tableau : en poser une nouvelle (une par manche) remplace
        l'ancienne. Toutes les épingles sont <strong>anonymes</strong> et rien n'est vérifié : le complice et le Maître chanteur épinglent comme tout le monde. À
        la fin de la partie, le tableau est montré avec le vrai auteur de chaque épingle.
      </p>
      {enCours && (
        <FormulaireEpingle vue={vue} nom={nom} peutSigner={!dejaCetteManche} peutRumeur={rumeursRestantes > 0 && !rumeurCetteManche} rumeurs={rumeursRestantes} onAgir={agir} />
      )}
      {tableau.length === 0 ? (
        <p className="muet">Le tableau est encore vide.</p>
      ) : (
        <div className="tableau-liege">
          {[...tableau].reverse().map((e) => (
            <article key={e.id} className={`epingle epingle-${e.etiquette}${e.rumeur ? ' epingle-rumeur' : ''}`}>
              <span className="punaise" aria-hidden="true" />
              <div className="epingle-cible">
                {e.cible.type === 'element' ? <Embleme id={e.cible.id} taille={34} /> : <span className="epingle-joueur" aria-hidden="true">👤</span>}
                <div>
                  <strong>{e.cible.type === 'element' ? nomElement(e.cible.id) : nom(e.cible.id)}</strong>
                  <span className={`etiquette etiquette-${e.etiquette === 'innocent' ? 'or' : 'rouge'}`}>{LIBELLES_ETIQUETTES[e.etiquette]}</span>
                </div>
              </div>
              <p className="petit muet epingle-auteur">
                {e.auteur === moi ? (e.rumeur ? 'Votre épingle en plus (Journaliste)' : 'Votre épingle') : 'Anonyme'} · manche {e.manche}
              </p>
              <div className="ligne epingle-reactions">
                <button
                  className={`btn btn-petit ${e.maReaction === 'pour' ? 'btn-or' : 'btn-discret'}`}
                  aria-pressed={e.maReaction === 'pour'}
                  disabled={!enCours}
                  onClick={() => void agir({ type: 'reagir', epingle: e.id, reaction: e.maReaction === 'pour' ? null : 'pour' })}
                  aria-label={`D'accord (${e.pour})`}
                >
                  👍 {e.pour}
                </button>
                <button
                  className={`btn btn-petit ${e.maReaction === 'contre' ? 'btn-or' : 'btn-discret'}`}
                  aria-pressed={e.maReaction === 'contre'}
                  disabled={!enCours}
                  onClick={() => void agir({ type: 'reagir', epingle: e.id, reaction: e.maReaction === 'contre' ? null : 'contre' })}
                  aria-label={`Pas d'accord (${e.contre})`}
                >
                  👎 {e.contre}
                </button>
                {e.auteur === moi && enCours && (
                  <button className="btn btn-petit btn-discret" onClick={() => void agir({ type: 'retirerEpingle', epingle: e.id })}>
                    Retirer
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function FormulaireEpingle({
  vue,
  nom,
  peutSigner,
  peutRumeur,
  rumeurs,
  onAgir,
}: {
  vue: VueJoueur;
  nom: Noms;
  peutSigner: boolean;
  peutRumeur: boolean;
  rumeurs: number;
  onAgir: (a: ActionJeu) => Promise<boolean>;
}) {
  const [cible, setCible] = useState('');
  const [etiquette, setEtiquette] = useState<EtiquetteEpingle>('coupable');
  const [rumeur, setRumeur] = useState(false);
  const estJoueur = cible.startsWith('joueur:');
  const etiquettes: EtiquetteEpingle[] = estJoueur ? ['complice', 'innocent'] : ['coupable', 'innocent', 'fausse_piste'];
  const etiquetteValide = etiquettes.includes(etiquette) ? etiquette : etiquettes[0];
  const tableau = vue.tableau ?? [];
  const possible = rumeur ? peutRumeur : peutSigner;
  const epingler = async () => {
    if (!cible) return;
    const c: CibleEpingle = estJoueur ? { type: 'joueur', id: cible.slice(7) } : { type: 'element', id: cible as ElementId };
    const ok = await onAgir({ type: 'epingler', cible: c, etiquette: etiquetteValide, ...(rumeur ? { rumeur: true } : {}) });
    if (ok) {
      setCible('');
      setRumeur(false);
    }
  };
  if (!peutSigner && !peutRumeur)
    return <p className="petit muet">Vous avez déjà posé votre épingle cette manche : à la manche suivante, une nouvelle remplacera celle-ci.</p>;
  return (
    <div className="formulaire-epingle">
      <div className="ligne">
        <label className="petit" htmlFor="epingle-cible">
          Épingler
        </label>
        <select id="epingle-cible" value={cible} onChange={(e) => setCible(e.target.value)}>
          <option value="">— choisir —</option>
          {CATEGORIES.filter((c) => c.c !== 'mobile' || vue.regles.mode === 'grande').map(({ c, libelle }) => (
            <optgroup key={c} label={libelle}>
              {elementsDeCategorie(vue, c).map((id) => (
                <option key={id} value={id}>
                  {nomElement(id)}
                </option>
              ))}
            </optgroup>
          ))}
          <optgroup label="Les joueurs">
            {vue.joueurs
              .filter((j) => j.id !== vue.moi.id)
              .map((j) => (
                <option key={j.id} value={`joueur:${j.id}`}>
                  {nom(j.id)}
                </option>
              ))}
          </optgroup>
        </select>
        <select aria-label="Étiquette" value={etiquetteValide} onChange={(e) => setEtiquette(e.target.value as EtiquetteEpingle)}>
          {etiquettes.map((x) => (
            <option key={x} value={x}>
              {LIBELLES_ETIQUETTES[x]}
            </option>
          ))}
        </select>
      </div>
      <div className="ligne">
        {rumeurs > 0 && (
          <label className="petit">
            <input type="checkbox" checked={rumeur} disabled={!peutRumeur} onChange={(e) => setRumeur(e.target.checked)} /> Épingle en plus (Journaliste : {rumeurs})
          </label>
        )}
        <button className="btn btn-or" disabled={!cible || !possible} onClick={() => void epingler()}>
          📌 Épingler
        </button>
      </div>
      {!peutSigner && !rumeur && <p className="petit muet">Épingle déjà posée cette manche{peutRumeur ? ' — il vous reste une épingle en plus.' : '.'}</p>}
      {peutSigner && !rumeur && tableau.some((e) => e.auteur === vue.moi.id && !e.rumeur) && (
        <p className="petit muet">Votre nouvelle épingle remplacera celle qui est au tableau.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Dernière chance du complice (objectif « Le témoin gênant »)
// ---------------------------------------------------------------------------

export function ModaleDerniereChance({ vue, nom, decalage, onErreur }: { vue: VueJoueur; nom: Noms; decalage: number; onErreur: (e: string) => void }) {
  const [envoi, setEnvoi] = useState(false);
  const complice = vue.moi.role === 'complice';
  const echeance = vue.echeanceDesignation ?? Date.now();
  const designer = async (id: string) => {
    setEnvoi(true);
    const r = await connexion.action({ type: 'designerTemoin', joueur: id });
    setEnvoi(false);
    if (!r.ok) onErreur(r.erreur);
  };
  return (
    <Modale titre="⚖️ Dernière chance">
      <p>
        <strong>L'enquête a abouti…</strong> mais le complice a un objectif secret : <strong>trouver le Témoin</strong>, celui qui connaissait le lieu du crime depuis le
        début. S'il le désigne, il vole la victoire.
      </p>
      <p>
        Temps restant : <Chrono echeance={echeance} decalage={decalage} total={30_000} />
      </p>
      {complice ? (
        <>
          <p>Qui est le Témoin ? Repensez aux hypothèses de chacun : qui semblait savoir où le crime a eu lieu ?</p>
          <div className="ligne">
            {vue.joueurs
              .filter((j) => j.id !== vue.moi.id)
              .map((j) => (
                <button key={j.id} className="btn btn-danger" disabled={envoi} onClick={() => void designer(j.id)}>
                  {nom(j.id)}
                </button>
              ))}
          </div>
        </>
      ) : vue.moi.roleEnquete === 'temoin' ? (
        <p>Vous êtes le Témoin : retenez votre souffle…</p>
      ) : (
        <p className="muet">Le complice réfléchit…</p>
      )}
    </Modale>
  );
}

