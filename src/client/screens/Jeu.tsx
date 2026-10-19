import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { INDICES_PAR_ID, LIBELLES_CATEGORIE_DOSSIER } from '../../shared/data/indices';
import { nomElement } from '../../shared/data/manoir';
import type { EtatClient } from '../../shared/protocole';
import { SANS_LIMITE, type VueJoueur } from '../../shared/types';
import { Chat } from '../components/Chat';
import { Aide, Carte, CarteIndice, Chrono, EntetePublic, Prive, useNotification } from '../components/Commun';
import { Icone } from '../components/Emblemes';
import { ModaleAccusation, ModaleDenonciation, ModaleFalsification, ModaleHypothese, ModaleReponse, SuiviHypothese } from '../components/jeu/Actions';
import { Carnet, sourcesConnues } from '../components/jeu/Carnet';
import { texteEvenement, type Noms } from '../components/jeu/Textes';
import { connexion } from '../connexion';
import { ModaleRegles } from './Regles';
import { BoutonQuitter } from '../components/Quitter';

type Onglet = 'enquete' | 'cartes' | 'archives' | 'carnet' | 'historique' | 'discussion';

export function Jeu({ etat, decalage }: { etat: EtatClient; decalage: number }) {
  const vue = etat.partie!;
  const moi = vue.moi.id;
  const [onglet, setOnglet] = useState<Onglet>('enquete');
  const [modale, setModale] = useState<'hypothese' | 'accusation' | 'denonciation' | 'regles' | null>(null);
  const { afficher, vue: notification } = useNotification();
  const noms = useMemo(() => new Map(vue.joueurs.map((j) => [j.id, j.nom])), [vue.joueurs]);
  const nom: Noms = useCallback((id: string) => noms.get(id) ?? '?', [noms]);
  const sources = useMemo(() => sourcesConnues(vue, nom), [vue, nom]);
  const monTour = vue.joueurActif === moi && vue.etape === 'tour';
  const h = vue.hypotheseEnCours;
  const doitRepondre = !!h?.aRepondre && h.repondantActuel === moi;
  const peutFalsifier = !!h?.falsification && h.etape === 'falsification';

  // Messages non lus (onglet Discussion sur petit écran).
  const [lus, setLus] = useState(etat.salon.messages.length);
  useEffect(() => {
    if (onglet === 'discussion') setLus(etat.salon.messages.length);
  }, [onglet, etat.salon.messages.length]);
  const nonLus = Math.max(0, etat.salon.messages.length - lus);

  // Signal discret quand c'est mon tour (titre de l'onglet + notification).
  const tourPrecedent = useRef(false);
  useEffect(() => {
    if (monTour && !tourPrecedent.current) afficher("C'est votre tour !");
    tourPrecedent.current = monTour;
    document.title = monTour || doitRepondre ? '● À vous — Dossier Secret' : 'Dossier Secret';
    return () => {
      document.title = 'Dossier Secret';
    };
  }, [monTour, doitRepondre]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!monTour && (modale === 'hypothese' || modale === 'accusation' || modale === 'denonciation')) {
      setModale(null);
      if (vue.joueurActif !== moi) afficher("Votre tour est terminé.", true);
    }
  }, [monTour]); // eslint-disable-line react-hooks/exhaustive-deps

  const erreur = (e: string) => afficher(e, true);
  const agir = async (a: Parameters<typeof connexion.action>[0]) => {
    const r = await connexion.action(a);
    if (!r.ok) erreur(r.erreur);
  };

  const raisonHypothese = !monTour
    ? null
    : vue.pointsAction < vue.regles.coutHypothese
      ? `Il faut ${vue.regles.coutHypothese} points d’action (il vous en reste ${vue.pointsAction}).`
      : vue.hypothesesCeTour >= vue.regles.hypothesesMaxParTour
        ? 'Une seule hypothèse par tour.'
        : null;
  const dossiersDispo = vue.archives.filter((a) => a.disponible && !a.consulte);
  const raisonArchive = !monTour ? null : vue.pointsAction < 1 ? 'Plus de point d’action.' : dossiersDispo.length === 0 ? 'Aucun dossier disponible.' : null;

  const onglets: { id: Onglet; libelle: string; classe?: string; badge?: number }[] = [
    { id: 'enquete', libelle: 'Enquête' },
    { id: 'cartes', libelle: 'Mes cartes', classe: 'onglet-mobile-seulement' },
    { id: 'archives', libelle: 'Archives', badge: dossiersDispo.length || undefined },
    { id: 'carnet', libelle: 'Carnet' },
    { id: 'historique', libelle: 'Historique' },
    { id: 'discussion', libelle: 'Discussion', classe: 'onglet-chat', badge: onglet !== 'discussion' && nonLus ? nonLus : undefined },
  ];

  return (
    <div className="jeu">
      <header className="barre-jeu">
        <span className="titre-jeu">Dossier Secret</span>
        <div className="indicateur">
          <small>Manche</small>
          <strong>
            {vue.manche} / {vue.regles.manchesMax}
          </strong>
        </div>
        <div className="indicateur">
          <small>Tour de</small>
          <strong>{vue.joueurActif === moi ? 'vous' : nom(vue.joueurActif)}</strong>
        </div>
        <div className="indicateur">
          <small>Points d'action</small>
          <span className="points" aria-label={`${vue.pointsAction} point(s) d'action sur ${vue.regles.pointsAction}`}>
            {Array.from({ length: vue.regles.pointsAction }, (_, i) => (
              <span key={i} className={`point${i < vue.pointsAction ? ' plein' : ''}`} />
            ))}
          </span>
        </div>
        {vue.etape === 'tour' && (
          <div className="indicateur">
            <small>Fin du tour</small>
            {vue.echeanceTour >= SANS_LIMITE ? <strong>sans limite</strong> : <Chrono echeance={vue.echeanceTour} decalage={decalage} />}
          </div>
        )}
        <span className="espace" />
        <span className={`etiquette ${vue.moi.role === 'complice' ? 'etiquette-rouge' : 'etiquette-or'}`} title="Visible par vous seul">
          <Icone nom="cadenas" taille={12} /> {vue.moi.role === 'complice' ? 'Complice' : 'Enquêteur'}
        </span>
        <button className="btn btn-discret btn-petit" onClick={() => setModale('regles')}>
          <Icone nom="livre" /> Règles
        </button>
        <BoutonQuitter etat={etat} classe="btn btn-discret btn-petit" />
      </header>

      <div className="disposition">
        <aside className="colonne-gauche" aria-label="Joueurs et cartes">
          <PanneauRole vue={vue} />
          <PanneauJoueurs vue={vue} nom={nom} />
        </aside>

        <main>
          <div className="onglets" role="tablist" aria-label="Sections du jeu">
            {onglets.map((o) => (
              <button key={o.id} role="tab" aria-selected={onglet === o.id} className={`onglet ${o.classe ?? ''}`} onClick={() => setOnglet(o.id)}>
                {o.libelle}
                {o.badge ? <span className="badge">{o.badge}</span> : null}
              </button>
            ))}
          </div>

          {onglet === 'enquete' && (
            <>
              <div className={`bandeau-tour${monTour ? ' mon-tour' : ''}`} aria-live="polite">
                {monTour ? (
                  <strong>C'est votre tour : {vue.pointsAction} point(s) d'action.</strong>
                ) : vue.etape === 'hypothese' ? (
                  <span>Interrogation en cours…</span>
                ) : (
                  <span>
                    Au tour de <strong>{nom(vue.joueurActif)}</strong>.
                  </span>
                )}
                {!vue.moi.peutAccuser && <span className="etiquette etiquette-rouge">Vous ne pouvez plus accuser</span>}
              </div>
              {vue.compliceDemasque && (
                <div className="info" role="status">
                  🎭 <strong>{vue.compliceDemasque === moi ? 'Vous avez été démasqué' : `${nom(vue.compliceDemasque)} est le complice`}</strong> : ses ruses sont
                  épuisées. Il continue à jouer et doit répondre honnêtement.
                </div>
              )}

              <div className="actions">
                <button className="btn btn-or" disabled={!monTour || !!raisonHypothese} onClick={() => setModale('hypothese')}>
                  <Icone nom="loupe" /> Hypothèse ({vue.regles.coutHypothese} PA)
                </button>
                <button className="btn" disabled={!monTour || !!raisonArchive} onClick={() => setOnglet('archives')}>
                  <Icone nom="livre" /> Consulter les archives (1 PA)
                </button>
                {/* Le complice ne peut pas accuser : le bouton n'existe que sur l'écran des enquêteurs. */}
                {vue.moi.role !== 'complice' && (
                  <button className="btn btn-danger" disabled={!monTour || !vue.moi.peutAccuser} onClick={() => setModale('accusation')}>
                    Accusation finale
                  </button>
                )}
                {vue.regles.modeComplice === 'ruse' && (
                  <button
                    className="btn"
                    disabled={!monTour || !vue.moi.peutDenoncer || vue.pointsAction < 1}
                    onClick={() => setModale('denonciation')}
                    title={vue.compliceDemasque ? 'Le complice est déjà démasqué.' : !vue.moi.peutDenoncer ? 'Vous avez déjà dénoncé quelqu’un.' : undefined}
                  >
                    🎭 Dénoncer le complice (1 PA)
                  </button>
                )}
                <button className="btn" disabled={!monTour} onClick={() => void agir({ type: 'finTour' })}>
                  Terminer mon tour
                </button>
              </div>
              {monTour && (raisonHypothese || raisonArchive) && (
                <p className="raison">{[raisonHypothese && `Hypothèse : ${raisonHypothese}`, raisonArchive && `Archives : ${raisonArchive}`].filter(Boolean).join(' · ')}</p>
              )}
              {!monTour && vue.etape !== 'terminee' && <p className="raison">Les actions s'activeront pendant votre tour. Le carnet et la discussion restent disponibles.</p>}

              <SuiviHypothese vue={vue} nom={nom} decalage={decalage} delaiFalsification={vue.regles.delaiFalsificationMs} />

              <section className="panneau">
                <EntetePublic>Dossier public</EntetePublic>
                {vue.cartesPubliques.length > 0 && (
                  <>
                    <h4>
                      Cartes publiques <Aide>Ces cartes n'ont été distribuées à personne : elles ne font pas partie de la solution.</Aide>
                    </h4>
                    <div className="ligne" style={{ marginBottom: 12 }}>
                      {vue.cartesPubliques.map((c) => (
                        <Carte key={c} id={c} taille="mini" />
                      ))}
                    </div>
                  </>
                )}
                <h4>Indices publics</h4>
                <div className="indices">
                  {vue.indicesPublics.map((i) => (
                    <CarteIndice key={i.indice} id={i.indice} ouvert={false} />
                  ))}
                </div>
              </section>

              <section className="panneau">
                <EntetePublic>Derniers événements</EntetePublic>
                <Journal vue={vue} nom={nom} limite={8} />
                <button className="btn btn-discret btn-petit" onClick={() => setOnglet('historique')}>
                  Tout l'historique
                </button>
              </section>
            </>
          )}

          {onglet === 'cartes' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <PanneauRole vue={vue} />
              <PanneauJoueurs vue={vue} nom={nom} />
            </div>
          )}

          {onglet === 'archives' && <Archives vue={vue} monTour={monTour} onAgir={agir} />}

          {onglet === 'carnet' && <Carnet vue={vue} nom={nom} onErreur={erreur} />}

          {onglet === 'historique' && (
            <section className="panneau">
              <EntetePublic>Historique public de la partie</EntetePublic>
              <Journal vue={vue} nom={nom} />
            </section>
          )}

          {onglet === 'discussion' && (
            <section className="panneau">
              <EntetePublic>Discussion — tous les joueurs lisent ces messages</EntetePublic>
              <Chat messages={etat.salon.messages} moi={moi} onErreur={erreur} />
            </section>
          )}
        </main>

        <aside className="colonne-droite" aria-label="Discussion">
          <section className="panneau">
            <EntetePublic>Discussion</EntetePublic>
            <Chat messages={etat.salon.messages} moi={moi} onErreur={erreur} />
          </section>
        </aside>
      </div>

      {modale === 'hypothese' && <ModaleHypothese vue={vue} nom={nom} sources={sources} onFermer={() => setModale(null)} onErreur={erreur} />}
      {modale === 'accusation' && <ModaleAccusation sources={sources} onFermer={() => setModale(null)} onErreur={erreur} />}
      {modale === 'denonciation' && <ModaleDenonciation vue={vue} nom={nom} onFermer={() => setModale(null)} onErreur={erreur} />}
      {modale === 'regles' && <ModaleRegles vue={vue} onFermer={() => setModale(null)} />}
      {doitRepondre && <ModaleReponse key={h!.id} vue={vue} nom={nom} decalage={decalage} onErreur={erreur} />}
      {peutFalsifier && !doitRepondre && <ModaleFalsification key={h!.id} vue={vue} nom={nom} decalage={decalage} delai={vue.regles.delaiFalsificationMs} onErreur={erreur} />}
      {notification}
    </div>
  );
}

function PanneauRole({ vue }: { vue: VueJoueur }) {
  return (
    <Prive titre="Votre rôle et vos cartes — privé">
      {vue.moi.role === 'complice' ? (
        <>
          <h3 style={{ color: 'var(--rouge)', marginBottom: 4 }}>Vous êtes le complice</h3>
          <p className="petit" style={{ marginBottom: 6 }}>
            Le meurtrier est <strong>{nomElement(vue.moi.meurtrier!)}</strong>. Vous ignorez le lieu et l'arme. Empêchez les enquêteurs de trouver avant la fin de la 12ᵉ
            manche.
          </p>
          {vue.regles.modeComplice === 'ruse' ? (
            <div className="petit" style={{ marginBottom: 8 }}>
              <div className="ligne" style={{ marginBottom: 6 }}>
                <span className="etiquette etiquette-rouge">
                  Ruses : {vue.moi.rusesRestantes}/{vue.regles.ruses}
                </span>
                <Aide libelle="Aide sur les ruses">
                  Chaque ruse peut laisser, une ou deux manches plus tard, une empreinte publique qui innocente un autre joueur : abusez-en et vous serez démasqué.
                </Aide>
              </div>
              <ul style={{ margin: 0, paddingLeft: '1.1em' }}>
                <li>
                  <strong>Mensonge</strong> ({vue.regles.coutRuses.mensonge}) : interrogé, répondre « aucune carte » alors que vous en avez une.
                </li>
                <li>
                  <strong>Carte empruntée</strong> ({vue.regles.coutRuses.emprunt}) : interrogé, montrer une carte de l'hypothèse que vous n'avez pas.
                </li>
                <li>
                  <strong>Hypothèse falsifiée</strong> ({vue.regles.coutRuses.falsification}) : changer un élément de l'hypothèse d'un autre avant son annonce.
                </li>
                <li>
                  <strong>Dossier trafiqué</strong> ({vue.regles.coutRuses.trafic}) : en lisant un dossier d'archives, le remplacer par un faux indice pour les
                  lecteurs suivants.
                </li>
              </ul>
            </div>
          ) : (
            <div className="ligne petit" style={{ marginBottom: 8 }}>
              <span className="etiquette etiquette-rouge">Mensonge : {vue.moi.mensongesRestants}/{vue.regles.mensonges}</span>
              <Aide libelle="Aide sur Mensonge">
                Quand vous êtes interrogé et possédez une carte correspondante, vous pouvez prétendre n'en avoir aucune. L'interrogation passe au joueur suivant.
              </Aide>
              <span className="etiquette etiquette-rouge">Falsification : {vue.moi.falsificationsRestantes}/{vue.regles.falsifications}</span>
              <Aide libelle="Aide sur la falsification">
                Juste après l'hypothèse d'un autre joueur, modifiez un de ses trois éléments avant l'annonce publique. Son auteur continuera de voir l'original, sans être
                prévenu.
              </Aide>
            </div>
          )}
        </>
      ) : (
        <>
          <h3 style={{ marginBottom: 4 }}>Vous êtes enquêteur</h3>
          <p className="petit">Trouvez le meurtrier, le lieu et l'arme. Méfiez-vous : un complice se cache parmi les joueurs.</p>
        </>
      )}
      <h4>Mes cartes (innocentes)</h4>
      <div className="ligne">
        {vue.moi.main.map((c) => (
          <Carte key={c} id={c} taille="mini" titre={nomElement(c)} />
        ))}
      </div>
    </Prive>
  );
}

function PanneauJoueurs({ vue, nom }: { vue: VueJoueur; nom: Noms }) {
  return (
    <section className="panneau">
      <EntetePublic>Joueurs (ordre du tour)</EntetePublic>
      <ul className="liste-joueurs">
        {vue.joueurs.map((j) => (
          <li key={j.id} style={j.id === vue.joueurActif ? { borderColor: 'var(--or)' } : undefined}>
            <span className={`pastille ${j.connecte ? 'pastille-on' : 'pastille-off'}`} aria-hidden="true" />
            <span style={{ minWidth: 0 }}>
              <strong>{j.id === vue.moi.id ? `${nom(j.id)} (vous)` : nom(j.id)}</strong>
              <span className="petit muet" style={{ display: 'block' }}>
                {j.nbCartes} cartes{j.parti ? ' · a quitté la partie' : !j.connecte && ' · déconnecté'}
                {!j.peutAccuser && ' · ne peut plus accuser'}
                {j.bot && ' · bot'}
              </span>
            </span>
            <span className="espace" />
            {j.id === vue.compliceDemasque && <span className="etiquette etiquette-rouge">complice démasqué</span>}
            {j.id === vue.joueurActif && <span className="etiquette etiquette-or">son tour</span>}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Archives({ vue, monTour, onAgir }: { vue: VueJoueur; monTour: boolean; onAgir: (a: { type: 'consulterArchive'; dossier: number; trafiquer?: boolean }) => Promise<void> }) {
  const consultes = new Map(vue.moi.indicesConsultes.map((i) => [i.dossier, i]));
  const mesTrafics = new Map(vue.moi.journal.flatMap((e) => (e.type === 'ruse' && e.ruse === 'trafic' ? [[e.dossier!, e.indiceFaux!] as const] : [])));
  const peutTrafiquer = vue.regles.modeComplice === 'ruse' && (vue.moi.rusesRestantes ?? 0) >= vue.regles.coutRuses.trafic;
  const pieces = new Map(vue.moi.piecesConsultees.map((p) => [p.dossier, p.carte]));
  return (
    <div className="indices">
      <p className="muet petit" style={{ margin: 0 }}>
        Consulter un dossier coûte 1 point d'action pendant votre tour. Vous seul lisez son contenu ; les autres voient seulement que vous l'avez consulté.
        Les pièces à conviction sont des cartes que personne n'a reçues : elles sont donc hors de cause.
      </p>
      {vue.archives.map((a) =>
        pieces.has(a.dossier) ? (
          <Prive key={a.dossier} titre={`Pièce à conviction n° ${a.dossier} — vue par vous seul`}>
            <div className="ligne">
              <Carte id={pieces.get(a.dossier)!} />
              <p style={{ margin: 0, maxWidth: 360 }}>Cette carte n'a été distribuée à personne : elle ne fait pas partie de la solution.</p>
            </div>
          </Prive>
        ) : consultes.has(a.dossier) ? (
          <Prive key={a.dossier} titre={`Dossier n° ${a.dossier} — lu par vous seul`}>
            <CarteIndice id={consultes.get(a.dossier)!.indice} dossier={a.dossier} categorie={consultes.get(a.dossier)!.categorie} />
            {mesTrafics.has(a.dossier) && (
              <p className="petit" style={{ marginTop: 8, color: 'var(--rouge)' }}>
                🎭 Vous avez trafiqué ce dossier : les prochains lecteurs y liront « {INDICES_PAR_ID[mesTrafics.get(a.dossier)!]?.titre} ».
              </p>
            )}
          </Prive>
        ) : (
          <section key={a.dossier} className="panneau ligne">
            <div>
              <h4 style={{ margin: 0 }}>{a.categorie === 'piece' ? 'Pièce à conviction' : 'Dossier scellé'} n° {a.dossier}</h4>
              <span className="muet petit">
                {LIBELLES_CATEGORIE_DOSSIER[a.categorie]} · {a.disponible ? 'consultable' : `s'ouvre à la manche ${a.disponibleDesManche}`}
              </span>
            </div>
            <span className="espace" />
            <button className="btn btn-or btn-petit" disabled={!monTour || !a.disponible || vue.pointsAction < 1} onClick={() => void onAgir({ type: 'consulterArchive', dossier: a.dossier })}>
              Consulter (1 PA)
            </button>
            {peutTrafiquer && a.categorie !== 'piece' && (
              <button
                className="btn btn-danger btn-petit"
                disabled={!monTour || !a.disponible || vue.pointsAction < 1}
                onClick={() => void onAgir({ type: 'consulterArchive', dossier: a.dossier, trafiquer: true })}
                title="Vous lisez le vrai indice ; les joueurs qui ouvriront ce dossier après vous liront un faux indice."
              >
                🎭 Consulter et trafiquer (1 PA + {vue.regles.coutRuses.trafic} ruse)
              </button>
            )}
          </section>
        ),
      )}
    </div>
  );
}

function Journal({ vue, nom, limite }: { vue: VueJoueur; nom: Noms; limite?: number }) {
  const lignes = vue.historique
    .map((ev, i) => ({ i, r: texteEvenement(ev, nom, vue.moi.id) }))
    .filter((x) => x.r !== null)
    .reverse();
  const affichees = limite ? lignes.slice(0, limite) : lignes;
  return (
    <ul className="journal">
      {affichees.map(({ i, r }) => (
        <li key={i} className={r!.classe}>
          {r!.contenu}
        </li>
      ))}
    </ul>
  );
}
