import { useCallback, useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { INDICES_PAR_ID, libelleCategorie } from '../../shared/data/catalogue';
import { nomCourt, nomElement } from '../../shared/data/catalogue';
import type { EtatClient } from '../../shared/protocole';
import { SANS_LIMITE, categorieDe, type VueJoueur } from '../../shared/types';
import { Chat } from '../components/Chat';
import { Aide, Carte, CarteIndice, Chrono, EntetePublic, Prive, useNotification } from '../components/Commun';
import { Embleme, Icone, Sceau } from '../components/Emblemes';
import { ModaleAccusation, ModaleDenonciation, ModaleFalsification, ModaleHypothese, ModaleReponse, ResultatHypothese, SuiviHypothese } from '../components/jeu/Actions';
import { Carnet, sourcesConnues } from '../components/jeu/Carnet';
import { ModaleHistoire, histoireAPresenter, marquerHistoireLue } from '../components/jeu/Dossier';
import { GRACE_PAUSE_MS, ModalePause, useHeureServeur } from '../components/jeu/Pause';
import { texteEvenement, type Noms } from '../components/jeu/Textes';
import { connexion } from '../connexion';
import { useSonMessages, useSonsPartie, useTicTac } from '../components/jeu/useSons';
import type { Preferences } from '../preferences';
import { MenuPrincipal } from '../components/Menu';
import { ConseilsEnPartie } from '../components/jeu/Conseils';
import { Ambiance } from '../components/Ambiance';
import { heureDeManche, phaseNuit, useAmbianceSonore } from '../nuit';
import { ModaleDemandesPlace } from './Reprise';

type Onglet = 'enquete' | 'archives' | 'carnet' | 'discussion';

export function Jeu({
  etat,
  decalage,
  prefs,
  majPrefs,
}: {
  etat: EtatClient;
  decalage: number;
  prefs: Preferences;
  majPrefs: (p: Partial<Preferences>) => void;
}) {
  const vue = etat.partie!;
  const moi = vue.moi.id;
  const [onglet, setOnglet] = useState<Onglet>('enquete');
  const [historiqueComplet, setHistoriqueComplet] = useState(false);
  const [modale, setModale] = useState<'hypothese' | 'accusation' | 'denonciation' | null>(null);
  const { afficher, vue: notification } = useNotification();
  const noms = useMemo(() => new Map(vue.joueurs.map((j) => [j.id, j.nom])), [vue.joueurs]);
  const nom: Noms = useCallback((id: string) => noms.get(id) ?? '?', [noms]);
  const sources = useMemo(() => sourcesConnues(vue, nom), [vue, nom]);
  const monTour = vue.joueurActif === moi && vue.etape === 'tour' && !vue.pause;
  // Les boutons d'action n'apparaissent que pendant mon tour (y compris pendant l'interrogation de mon hypothèse).
  const actionsVisibles = vue.joueurActif === moi && vue.etape !== 'terminee';
  const h = vue.hypotheseEnCours;
  const doitRepondre = !!h?.aRepondre && h.repondantActuel === moi;
  const peutFalsifier = !!h?.falsification && h.etape === 'falsification';
  useSonsPartie(vue, doitRepondre);
  useSonMessages(etat.salon.messages, moi);
  useTicTac(vue.pause ? null : doitRepondre ? (h?.echeance ?? null) : monTour ? vue.echeanceTour : null, decalage);

  // Messages non lus (onglet Discussion sur petit écran).
  const [lus, setLus] = useState(etat.salon.messages.length);
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

  // La nuit qui avance : heure affichée, ciel qui s'assombrit puis s'éclaire, ambiance sonore.
  const nuit = phaseNuit(vue.manche, vue.regles.manchesMax);
  useAmbianceSonore(vue.affaire, vue.manche, vue.regles.manchesMax, vue.etape === 'terminee');

  // Au début de la partie (une fois par partie sur cet appareil) : l'histoire de l'affaire.
  const [histoire, setHistoire] = useState(() => !etat.salon.code.startsWith('GUIDE') && vue.etape !== 'terminee' && histoireAPresenter(vue.partieId));
  const fermerHistoire = () => {
    marquerHistoireLue(vue.partieId);
    setHistoire(false);
  };

  // Annonce de la dernière manche (une fois, quand elle commence).
  const derniereManche = vue.manche === vue.regles.manchesMax && vue.etape !== 'terminee';
  const mancheVue = useRef(vue.manche);
  useEffect(() => {
    if (derniereManche && mancheVue.current !== vue.manche) afficher('⏳ Dernière manche ! Chacun joue son dernier tour.');
    mancheVue.current = vue.manche;
  }, [vue.manche]); // eslint-disable-line react-hooks/exhaustive-deps

  // Partie en pause (joueur absent) : fenêtre « attendre ou remplacer par un bot », après une courte grâce.
  const maintenant = useHeureServeur(decalage, !!vue.pause);
  const clePause = vue.pause ? vue.pause.absents.map((a) => `${a.id}:${a.parti}`).join(',') : null;
  const [pauseMasquee, setPauseMasquee] = useState<string | null>(null);
  const fenetrePause = !!vue.pause && pauseMasquee !== clePause && maintenant - vue.pause.depuis >= GRACE_PAUSE_MS;
  // Messages lus : onglet Discussion ouvert, ou fenêtre de pause (qui contient la discussion).
  useEffect(() => {
    if (onglet === 'discussion' || fenetrePause) setLus(etat.salon.messages.length);
  }, [onglet, fenetrePause, etat.salon.messages.length]);
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

  // Sur téléphone, ces onglets forment une barre fixe en bas de l'écran.
  const onglets: { id: Onglet; libelle: string; icone: Parameters<typeof Icone>[0]['nom']; classe?: string; badge?: number }[] = [
    { id: 'enquete', libelle: 'Enquête', icone: 'loupe' },
    // Pastille seulement pendant mon tour : hors de mon tour, je ne peux rien consulter.
    { id: 'archives', libelle: 'Archives', icone: 'dossier', badge: monTour && vue.pointsAction >= 1 && dossiersDispo.length ? dossiersDispo.length : undefined },
    { id: 'carnet', libelle: 'Carnet', icone: 'plume' },
    { id: 'discussion', libelle: 'Discussion', icone: 'bulle', classe: 'onglet-chat', badge: onglet !== 'discussion' && nonLus ? nonLus : undefined },
  ];

  return (
    <div className="jeu">
      <div className="nuit" aria-hidden="true" style={{ '--obscurite': nuit.obscurite, '--aube': nuit.aube } as CSSProperties} />
      <Ambiance type={vue.affaire === 'train' ? 'neige' : 'pluie'} discret attenuation={nuit.aube * 0.6} />
      <header className="barre-jeu">
        <span className="logo-jeu" title="Dossier Secret">
          <Sceau taille={36} />
        </span>
        <div className="indicateurs">
        <div className="indicateur">
          <small>
            Manche <span className="heure-nuit">{heureDeManche(vue.affaire, vue.manche)}</span>
          </small>
          <strong>
            {vue.manche} / {vue.regles.manchesMax}
          </strong>
        </div>
        <div className="indicateur">
          <small>
            <span className="libelle-long">Tour de</span>
            <span className="libelle-court">Tour</span>
          </small>
          <strong className="nom-actif">{vue.joueurActif === moi ? 'vous' : nom(vue.joueurActif)}</strong>
        </div>
        <div className="indicateur">
          <small>
            <span className="libelle-long">Points d'action</span>
            <span className="libelle-court">PA</span>
          </small>
          <span className="points" aria-label={`${vue.pointsAction} point(s) d'action sur ${vue.regles.pointsAction}`}>
            {Array.from({ length: vue.regles.pointsAction }, (_, i) => (
              <span key={i} className={`point${i < vue.pointsAction ? ' plein' : ''}`} />
            ))}
          </span>
        </div>
        {vue.etape === 'tour' && (
          <div className="indicateur">
            <small>
              <span className="libelle-long">Fin du tour</span>
              <span className="libelle-court">Temps</span>
            </small>
            {vue.pause ? <strong>en pause</strong> : vue.echeanceTour >= SANS_LIMITE ? (
              <strong>
                <span className="libelle-long">sans limite</span>
                <span className="libelle-court" title="Sans limite">
                  ∞
                </span>
              </strong>
            ) : <Chrono echeance={vue.echeanceTour} decalage={decalage} />}
          </div>
        )}
        </div>
        <span className="espace" />
        <span className={`etiquette role-entete ${vue.moi.role === 'complice' ? 'etiquette-rouge' : 'etiquette-or'}`} title="Visible par vous seul">
          <Icone nom="cadenas" taille={12} /> {vue.moi.role === 'complice' ? 'Complice' : 'Enquêteur'}
        </span>
        <button
          className="btn btn-discret btn-petit"
          onClick={() => majPrefs({ son: !prefs.son })}
          aria-pressed={prefs.son}
          title={prefs.son ? 'Couper les sons' : 'Activer les sons'}
          aria-label={prefs.son ? 'Couper les sons' : 'Activer les sons'}
        >
          {prefs.son ? '🔊' : '🔇'}
        </button>
        <MenuPrincipal etat={etat} prefs={prefs} majPrefs={majPrefs} />
        <BandeMesCartes vue={vue} />
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
                <span className="icone-onglet">
                  <Icone nom={o.icone} />
                </span>
                <span className="libelle-onglet">{o.libelle}</span>
                {o.badge ? <span className="badge">{o.badge}</span> : null}
              </button>
            ))}
          </div>

          {onglet === 'enquete' && (
            <>
              {derniereManche && (
                <div className="info derniere-manche" role="status">
                  ⏳ <strong>Dernière manche</strong> : c'est le dernier tour de chacun.{' '}
                  {vue.moi.role === 'complice'
                    ? 'Tenez bon : si personne ne trouve la solution d’ici la fin, vous gagnez.'
                    : vue.moi.peutAccuser
                      ? 'Si personne ne trouve d’ici la fin, le complice gagne : pensez à votre accusation finale !'
                      : 'Si personne ne trouve d’ici la fin, le complice gagne.'}
                </div>
              )}
              {vue.pause && (
                <div className="info" role="status">
                  ⏸ <strong>Partie en pause</strong> : en attente de {vue.pause.absents.map((a) => nom(a.id)).join(', ')}.{' '}
                  {!fenetrePause && maintenant - vue.pause.depuis >= GRACE_PAUSE_MS && (
                    <button className="btn btn-petit" onClick={() => setPauseMasquee(null)}>
                      Ouvrir la fenêtre
                    </button>
                  )}
                </div>
              )}
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
                <div className="info bandeau-demasque" role="status">
                  <span className="tampon-demasque" aria-hidden="true">
                    Démasqué
                  </span>
                  🎭 <strong>{vue.compliceDemasque === moi ? 'Vous avez été démasqué' : `${nom(vue.compliceDemasque)} est le complice`}</strong> :{' '}
                  {vue.retourRuses !== null
                    ? `ses ruses sont suspendues jusqu'à la manche ${vue.retourRuses} ; d'ici là, ses réponses sont honnêtes.`
                    : 'ses ruses sont de nouveau actives : méfiez-vous de ses réponses.'}
                </div>
              )}

              {actionsVisibles && (
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
                      className="btn btn-denoncer"
                      disabled={!monTour || !vue.moi.peutDenoncer || vue.pointsAction < 1}
                      onClick={() => setModale('denonciation')}
                      title={vue.compliceDemasque ? 'Le complice est déjà démasqué.' : !vue.moi.peutDenoncer ? 'Vous avez déjà dénoncé quelqu’un.' : undefined}
                    >
                      🎭 Dénoncer le complice (1 PA)
                    </button>
                  )}
                  <button className="btn btn-fin-tour" disabled={!monTour} onClick={() => void agir({ type: 'finTour' })}>
                    Terminer mon tour
                  </button>
                </div>
              )}
              {monTour && (raisonHypothese || raisonArchive) && (
                <p className="raison">{[raisonHypothese && `Hypothèse : ${raisonHypothese}`, raisonArchive && `Archives : ${raisonArchive}`].filter(Boolean).join(' · ')}</p>
              )}
              {!actionsVisibles && vue.etape !== 'terminee' && (
                <p className="raison">Vos actions apparaîtront à votre tour. En attendant, le carnet et la discussion restent disponibles.</p>
              )}

              <SuiviHypothese vue={vue} nom={nom} decalage={decalage} delaiFalsification={vue.regles.delaiFalsificationMs} />
              <ResultatHypothese vue={vue} nom={nom} />

              {/* Plus d'indice public par défaut : le panneau ne reste que pour d'anciennes parties ou d'autres réglages. */}
              {(vue.cartesPubliques.length > 0 || vue.indicesPublics.length > 0) && (
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
                  {vue.indicesPublics.length > 0 && (
                    <>
                      <h4>Indices publics</h4>
                      <div className="indices">
                        {vue.indicesPublics.map((i) => (
                          <CarteIndice key={i.indice} id={i.indice} ouvert={false} />
                        ))}
                      </div>
                    </>
                  )}
                </section>
              )}

              <section className="panneau panneau-historique">
                <EntetePublic>{historiqueComplet ? 'Historique complet de la partie' : 'Derniers événements'}</EntetePublic>
                <Journal vue={vue} nom={nom} limite={historiqueComplet ? undefined : 8} />
                <button className="btn btn-discret btn-petit" aria-expanded={historiqueComplet} onClick={() => setHistoriqueComplet(!historiqueComplet)}>
                  {historiqueComplet ? 'Réduire l’historique' : 'Tout l’historique'}
                </button>
              </section>

              {/* Sur téléphone, la colonne de gauche est masquée : rôle et joueurs sont ici, repliables. */}
              <details className="panneau mobile-seulement">
                <summary>Mon rôle et les joueurs</summary>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginTop: 12 }}>
                  <PanneauRole vue={vue} />
                  <PanneauJoueurs vue={vue} nom={nom} />
                </div>
              </details>
            </>
          )}

          {onglet === 'archives' && <Archives vue={vue} monTour={monTour} onAgir={agir} />}

          {onglet === 'carnet' && <Carnet vue={vue} nom={nom} onErreur={erreur} />}

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

      {histoire && <ModaleHistoire affaire={vue.affaire} onFermer={fermerHistoire} />}
      {modale === 'hypothese' && <ModaleHypothese vue={vue} nom={nom} sources={sources} onFermer={() => setModale(null)} onErreur={erreur} />}
      {modale === 'accusation' && <ModaleAccusation affaire={vue.affaire} sources={sources} onFermer={() => setModale(null)} onErreur={erreur} />}
      {modale === 'denonciation' && <ModaleDenonciation vue={vue} nom={nom} onFermer={() => setModale(null)} onErreur={erreur} />}
      {doitRepondre && !vue.pause && <ModaleReponse key={h!.id} vue={vue} nom={nom} decalage={decalage} onErreur={erreur} />}
      {fenetrePause && (
        <ModalePause
          code={etat.salon.code}
          pause={vue.pause!}
          nom={nom}
          maintenant={maintenant}
          botsAutorises={etat.salon.botsAutorises}
          messages={etat.salon.messages}
          moi={moi}
          onAttendre={() => setPauseMasquee(clePause)}
          onErreur={erreur}
          onMessage={afficher}
        />
      )}
      {etat.salon.demandes.length > 0 && <ModaleDemandesPlace etat={etat} onErreur={erreur} />}
      {peutFalsifier && !doitRepondre && !vue.pause && <ModaleFalsification key={h!.id} vue={vue} nom={nom} decalage={decalage} delai={vue.regles.delaiFalsificationMs} onErreur={erreur} />}
      {!etat.salon.code.startsWith('GUIDE') && !histoire && (
        <ConseilsEnPartie vue={vue} monTour={monTour} doitRepondre={doitRepondre} prefs={prefs} majPrefs={majPrefs} />
      )}
      {notification}
    </div>
  );
}

/** Téléphone uniquement : vos cartes (et, pour le complice, le meurtrier) toujours visibles dans la barre du haut. */
function BandeMesCartes({ vue }: { vue: VueJoueur }) {
  return (
    <div className="bande-cartes" aria-label="Mon rôle et mes cartes, visibles par vous seul">
      <Icone nom="cadenas" taille={12} />
      <span className={`puce-carte puce-role${vue.moi.role === 'complice' ? ' puce-meurtrier' : ''}`}>{vue.moi.role === 'complice' ? 'Complice' : 'Enquêteur'}</span>
      {vue.moi.role === 'complice' && (
        <span className="puce-carte puce-meurtrier" title="Le meurtrier (vous seul le savez)">
          🎭 {nomCourt(vue.moi.meurtrier!)}
        </span>
      )}
      {vue.moi.main.map((c) => (
        <span key={c} className={`puce-carte puce-${categorieDe(c)}`} title={nomElement(c)}>
          <Embleme id={c} taille={16} />
          {nomCourt(c)}
        </span>
      ))}
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
                  Chaque ruse peut laisser une empreinte publique, deux ou trois manches plus tard (jamais avant la manche {vue.regles.premiereMancheEmpreinte}) : abusez-en et
                  vous serez démasqué. Démasqué, vos ruses sont suspendues {vue.regles.suspensionDemasque} manches, puis reviennent.
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
            <span className="nom-joueur">
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
  const peutTrafiquer = vue.regles.modeComplice === 'ruse' && vue.retourRuses === null && (vue.moi.rusesRestantes ?? 0) >= vue.regles.coutRuses.trafic;
  const pieces = new Map(vue.moi.piecesConsultees.map((p) => [p.dossier, p.carte]));
  // Dossiers déjà ouverts à l'affichage de l'onglet : seuls ceux ouverts ensuite voient leur sceau se briser.
  const dejaOuverts = useRef(new Set([...consultes.keys(), ...pieces.keys()]));
  const sceau = (dossier: number) => <SceauBrise anime={!dejaOuverts.current.has(dossier)} />;
  return (
    <div className="indices">
      <p className="muet petit" style={{ margin: 0 }}>
        Consulter un dossier coûte 1 point d'action pendant votre tour. Vous seul lisez son contenu ; les autres voient seulement que vous l'avez consulté.
        Les pièces à conviction sont des cartes que personne n'a reçues : elles sont donc hors de cause.
      </p>
      {vue.archives.map((a) =>
        pieces.has(a.dossier) ? (
          <Prive key={a.dossier} titre={`Pièce à conviction n° ${a.dossier} — vue par vous seul`}>
            {sceau(a.dossier)}
            <div className="ligne">
              <Carte id={pieces.get(a.dossier)!} />
              <p style={{ margin: 0, maxWidth: 360 }}>Cette carte n'a été distribuée à personne : elle ne fait pas partie de la solution.</p>
            </div>
          </Prive>
        ) : consultes.has(a.dossier) ? (
          <Prive key={a.dossier} titre={`Dossier n° ${a.dossier} — lu par vous seul`}>
            {sceau(a.dossier)}
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
                {libelleCategorie(a.categorie, vue.affaire)} · {a.disponible ? 'consultable' : `s'ouvre à la manche ${a.disponibleDesManche}`}
              </span>
            </div>
            <span className="espace" />
            {/* Boutons seulement pendant mon tour, sur un dossier ouvert. */}
            {monTour && a.disponible && (
              <>
                <button
                  className={`btn btn-or btn-petit btn-consulter${a.categorie === 'piece' ? ' piece' : ''}`}
                  disabled={vue.pointsAction < 1}
                  onClick={() => void onAgir({ type: 'consulterArchive', dossier: a.dossier })}
                >
                  Consulter (1 PA)
                </button>
                {peutTrafiquer && a.categorie !== 'piece' && (
                  <button
                    className="btn btn-danger btn-petit btn-trafiquer"
                    disabled={vue.pointsAction < 1}
                    onClick={() => void onAgir({ type: 'consulterArchive', dossier: a.dossier, trafiquer: true })}
                    title="Vous lisez le vrai indice ; les joueurs qui ouvriront ce dossier après vous liront un faux indice."
                  >
                    🎭 Consulter et trafiquer (1 PA + {vue.regles.coutRuses.trafic} ruse)
                  </button>
                )}
              </>
            )}
          </section>
        ),
      )}
    </div>
  );
}

/** Sceau de cire brisé sur un dossier ouvert ; il se brise sous vos yeux à l'ouverture. */
function SceauBrise({ anime }: { anime: boolean }) {
  return (
    <span className={`sceau-brise${anime ? ' anime' : ''}`} aria-hidden="true">
      <span />
      <span />
    </span>
  );
}

function Journal({ vue, nom, limite }: { vue: VueJoueur; nom: Noms; limite?: number }) {
  const lignes = vue.historique
    .map((ev, i) => ({ i, r: texteEvenement(ev, nom, vue.moi.id, vue.affaire) }))
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
