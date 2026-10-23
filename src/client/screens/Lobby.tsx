import { useEffect, useState } from 'react';
import { arreterAmbiance, demarrerAmbiance } from '../ambianceSonore';
import { useSonMessages } from '../components/jeu/useSons';
import { DUREES_TOUR, type EtatClient } from '../../shared/protocole';
import { Chat } from '../components/Chat';
import { Aide, useNotification } from '../components/Commun';
import { Icone, Sceau } from '../components/Emblemes';
import { ModaleQr, partageDisponible, partagerInvitation } from '../components/Invitation';
import { connexion } from '../connexion';
import { AFFAIRES, nomChoixAffaire } from '../../shared/data/catalogue';
import { CHOIX_AFFAIRES, type ChoixAffaire, type ModeJeu } from '../../shared/types';
import { MenuPrincipal } from '../components/Menu';
import type { Preferences } from '../preferences';

export function libelleDuree(s: number | null): string {
  if (s === null) return 'Sans limite';
  if (s < 60) return `${s} secondes`;
  const m = s / 60;
  return Number.isInteger(m) ? `${m} minute${m > 1 ? 's' : ''}` : `${Math.floor(m)} min ${s % 60} s`;
}

export function Lobby({ etat, prefs, majPrefs }: { etat: EtatClient; prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void }) {
  // Thème de Nuit Blanche à l'accueil et dans le salon d'attente (il démarre au premier geste).
  useEffect(() => {
    demarrerAmbiance('menu');
    return () => arreterAmbiance('menu');
  }, []);
  const { salon, moi } = etat;
  const estHote = salon.hote === moi;
  const { afficher, vue: notification } = useNotification();
  const [lancement, setLancement] = useState(false);
  const [qr, setQr] = useState(false);
  const lien = `${location.origin}/?salon=${salon.code}`;
  useSonMessages(salon.messages, moi);
  const n = salon.joueurs.length;
  const absents = salon.joueurs.filter((j) => !j.connecte);
  const raisonBlocage =
    n < salon.min
      ? `Il faut au moins ${salon.min} joueurs (encore ${salon.min - n}).`
      : absents.length
        ? `En attente de reconnexion : ${absents.map((j) => j.nom).join(', ')}.`
        : null;

  const copier = async (texte: string, quoi: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      afficher(`${quoi} copié.`);
    } catch {
      afficher(`Copie impossible : sélectionnez le ${quoi.toLowerCase()} à la main.`, true);
    }
  };

  const agir = async (f: () => Promise<{ ok: boolean; erreur?: string }>) => {
    const r = await f();
    if (!r.ok) afficher(r.erreur ?? 'Erreur', true);
  };

  return (
    <main className="page">
      <div className="ligne" style={{ marginBottom: 16 }}>
        <Sceau taille={46} />
        <h1 style={{ margin: 0, fontSize: '1.9rem' }}>Salon d'attente</h1>
        <span className="espace" />
        <MenuPrincipal etat={etat} prefs={prefs} majPrefs={majPrefs} />
      </div>

      <div className="deux-colonnes">
        <div>
          <section className="panneau" aria-labelledby="titre-code">
            <h3 id="titre-code">Code d'invitation</h3>
            <div className="code-salon" aria-label={`Code : ${salon.code.split('').join(' ')}`}>
              {salon.code}
            </div>
            <div className="ligne" style={{ marginTop: 10 }}>
              {partageDisponible() && (
                <button
                  className="btn btn-or btn-petit"
                  onClick={() =>
                    void partagerInvitation(lien, salon.code).then((r) => r === 'impossible' && afficher('Partage impossible : copiez le lien.', true))
                  }
                >
                  📤 Partager l'invitation
                </button>
              )}
              <button className="btn btn-petit" onClick={() => setQr(true)}>
                ▦ QR code
              </button>
              <button className="btn btn-petit" onClick={() => void copier(salon.code, 'Code')}>
                <Icone nom="copie" /> Copier le code
              </button>
              <button className="btn btn-petit" onClick={() => void copier(lien, 'Lien')}>
                <Icone nom="copie" /> Copier le lien d'invitation
              </button>
            </div>
            <p className="muet petit" style={{ marginTop: 10, marginBottom: 0 }}>
              Envoyez ce code ou ce lien aux autres joueurs, ou faites-leur scanner le QR code. Ils choisiront leur pseudonyme en arrivant.
            </p>
            {qr && <ModaleQr lien={lien} code={salon.code} onFermer={() => setQr(false)} />}
          </section>

          <section className="panneau" aria-labelledby="titre-joueurs">
            <div className="titre-section">
              <h3 id="titre-joueurs">
                Joueurs ({n}/{salon.max})
              </h3>
              {estHote && salon.botsAutorises && (
                <button className="btn btn-petit" onClick={() => void agir(connexion.ajouterBot)} disabled={n >= salon.max}>
                  <Icone nom="robot" /> Ajouter un bot
                </button>
              )}
            </div>
            <ul className="liste-joueurs">
              {salon.joueurs.map((j) => (
                <li key={j.id}>
                  <span className={`pastille ${j.connecte ? 'pastille-on' : 'pastille-off'}`} aria-hidden="true" />
                  <span style={{ fontWeight: 600 }}>{j.nom}</span>
                  {j.id === moi && <span className="etiquette">vous</span>}
                  {j.hote && (
                    <span className="etiquette etiquette-or">
                      <Icone nom="couronne" taille={12} /> hôte
                    </span>
                  )}
                  {j.bot && (
                    <span className="etiquette">
                      <Icone nom="robot" taille={12} /> bot
                    </span>
                  )}
                  <span className="sr-only">{j.connecte ? 'connecté' : 'déconnecté'}</span>
                  {!j.connecte && <span className="petit muet">déconnecté</span>}
                  <span className="espace" />
                  {estHote && j.id !== moi && (
                    <button className="btn btn-discret btn-petit" onClick={() => void agir(() => connexion.retirer(j.id))} aria-label={`Retirer ${j.nom}`}>
                      Retirer
                    </button>
                  )}
                </li>
              ))}
            </ul>
            <div className="reglages-partie">
              <h4>Réglages de la partie</h4>
              <div className="reglage">
                <label htmlFor="mode-jeu">Mode de jeu</label>
                {estHote ? (
                  <select id="mode-jeu" value={salon.reglages.mode ?? 'classique'} onChange={(e) => void agir(() => connexion.reglerMode(e.target.value as ModeJeu))}>
                    <option value="classique">Partie classique</option>
                    <option value="grande">Grande enquête (4 à 6 joueurs)</option>
                  </select>
                ) : (
                  <strong id="mode-jeu">{salon.reglages.mode === 'grande' ? 'Grande enquête' : 'Partie classique'}</strong>
                )}
                <Aide libelle="Aide sur le mode de jeu">La Grande enquête dure plus longtemps (14 manches, 4 joueurs au moins) : on cherche aussi le mobile, chacun reçoit un rôle secret avec un pouvoir, le complice a un objectif secret, un tableau d'enquête est partagé, et on a 3 points d'action par tour. À 5 et 6 joueurs, un Maître chanteur joue pour lui seul.</Aide>
              </div>
              <div className="reglage">
                <label htmlFor="affaire">Affaire</label>
                {estHote ? (
                  <select id="affaire" value={salon.reglages.affaire} onChange={(e) => void agir(() => connexion.reglerAffaire(e.target.value as ChoixAffaire))}>
                    {CHOIX_AFFAIRES.map((a) => (
                      <option key={a} value={a}>
                        {a === 'aleatoire' ? 'Au hasard (surprise au lancement)' : AFFAIRES[a].court}
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong id="affaire">{nomChoixAffaire(salon.reglages.affaire)}</strong>
                )}
                <Aide libelle="Aide sur l'affaire">
                  {salon.reglages.affaire === 'aleatoire'
                    ? "L'une des histoires est tirée au sort au lancement de la partie : personne ne sait laquelle avant."
                    : AFFAIRES[salon.reglages.affaire].accroche}{' '}
                  Les règles sont les mêmes ; seuls les suspects, les lieux, les armes et les indices changent.
                </Aide>
              </div>
              <div className="reglage">
                <label htmlFor="duree-tour">Durée d'un tour</label>
                {estHote ? (
                  <select
                    id="duree-tour"
                    value={salon.reglages.dureeTourS === null ? 'aucune' : String(salon.reglages.dureeTourS)}
                    onChange={(e) => void agir(() => connexion.reglerDureeTour(e.target.value === 'aucune' ? null : Number(e.target.value)))}
                  >
                    {(DUREES_TOUR.includes(salon.reglages.dureeTourS) ? DUREES_TOUR : [salon.reglages.dureeTourS, ...DUREES_TOUR]).map((d) => (
                      <option key={String(d)} value={d === null ? 'aucune' : String(d)}>
                        {libelleDuree(d)}
                        {d === 180 ? ' (conseillé)' : ''}
                      </option>
                    ))}
                  </select>
                ) : (
                  <strong id="duree-tour">{libelleDuree(salon.reglages.dureeTourS)}</strong>
                )}
                <Aide libelle="Aide sur la durée d'un tour">
                  À la fin du temps, le tour passe automatiquement au joueur suivant. Sans limite, personne n'est pressé ; un joueur absent met la partie
                  en pause.
                </Aide>
              </div>
              <div className="reglage">
                <label htmlFor="mode-complice">Complice</label>
                {estHote ? (
                  <select
                    id="mode-complice"
                    value={salon.reglages.modeComplice}
                    onChange={(e) => void agir(() => connexion.reglerModeComplice(e.target.value as 'classique' | 'ruse'))}
                  >
                    <option value="ruse">Rusé (conseillé)</option>
                    <option value="classique">Classique</option>
                  </select>
                ) : (
                  <strong id="mode-complice">{salon.reglages.modeComplice === 'ruse' ? 'Rusé' : 'Classique'}</strong>
                )}
                <Aide libelle="Aide sur les pouvoirs du complice">
                  {salon.reglages.modeComplice === 'ruse'
                    ? 'Rusé : mensonge, carte empruntée, hypothèse falsifiée, dossier trafiqué. Chaque ruse peut laisser une empreinte, et chacun peut tenter de le dénoncer une fois.'
                    : 'Classique : le complice peut mentir et falsifier des hypothèses un nombre limité de fois. Pas d’empreintes ni de dénonciation.'}
                </Aide>
              </div>
              <div className="reglage">
                <label htmlFor="historique-cartes">Cartes vues pendant la partie</label>
                {estHote ? (
                  <select
                    id="historique-cartes"
                    value={salon.reglages.historiqueCartes ?? 'visibles'}
                    onChange={(e) => void agir(() => connexion.reglerHistoriqueCartes(e.target.value as 'visibles' | 'anonymes'))}
                  >
                    <option value="visibles">Notées dans l'historique (conseillé)</option>
                    <option value="anonymes">À retenir de mémoire (difficile)</option>
                  </select>
                ) : (
                  <strong id="historique-cartes">{salon.reglages.historiqueCartes === 'anonymes' ? 'À retenir de mémoire (difficile)' : "Notées dans l'historique"}</strong>
                )}
                <Aide libelle="Aide sur les cartes vues">
                  {salon.reglages.historiqueCartes === 'anonymes'
                    ? "À retenir de mémoire : vous voyez la carte sur le moment, puis elle n'est plus rappelée nulle part. N'oubliez pas de la noter dans votre carnet !"
                    : "Notées dans l'historique : les cartes qu'on vous montre et que vous montrez restent écrites dans l'historique."}
                </Aide>
              </div>
            </div>
            <div style={{ marginTop: 14 }}>
              {estHote ? (
                <>
                  <button
                    className="btn btn-or btn-bloc"
                    disabled={!!raisonBlocage || lancement}
                    onClick={async () => {
                      setLancement(true);
                      await agir(connexion.demarrer);
                      setLancement(false);
                    }}
                  >
                    Lancer l'enquête
                  </button>
                  {raisonBlocage && <p className="raison" style={{ marginTop: 6 }}>{raisonBlocage}</p>}
                </>
              ) : (
                <p className="muet" style={{ margin: 0 }}>
                  En attente du lancement par l'hôte ({salon.joueurs.find((j) => j.hote)?.nom})…
                </p>
              )}
            </div>
          </section>
        </div>

        <div>
          <section className="panneau">
            <h3>En bref</h3>
            {salon.reglages.mode === 'grande' ? (
              <ul style={{ paddingLeft: '1.1em', margin: 0 }}>
                <li>Trouvez le meurtrier, le lieu, l'arme et le mobile.</li>
                <li>Chacun a un rôle secret avec un pouvoir ; un complice connaît le meurtrier et a un objectif secret.</li>
                <li>À 5 et 6 joueurs, un Maître chanteur connaît le mobile et joue pour lui seul.</li>
                <li>3 points d'action par tour (hypothèse : 2 PA, archive : 1 PA), 14 manches maximum.</li>
                <li>Un tableau d'enquête commun pour épingler vos soupçons… qui peut mentir.</li>
                <li>Une seule accusation finale par joueur (le complice ne peut pas accuser).</li>
              </ul>
            ) : (
              <ul style={{ paddingLeft: '1.1em', margin: 0 }}>
                <li>Trouvez le meurtrier, le lieu et l'arme.</li>
                <li>Un joueur secret est complice : il connaît le meurtrier.</li>
                <li>2 points d'action par tour (hypothèse : 2 PA, archive : 1 PA), 12 manches maximum.</li>
                <li>Hypothèse : le premier joueur interrogé qui a une carte correspondante vous en montre une, en secret.</li>
                <li>Le complice utilise des ruses discrètes… qui laissent parfois des empreintes. Démasquez-le !</li>
                <li>Une seule accusation finale par enquêteur (le complice ne peut pas accuser).</li>
              </ul>
            )}
          </section>
          <section className="panneau">
            <h3>Discussion</h3>
            <Chat messages={salon.messages} moi={moi} onErreur={(e) => afficher(e, true)} />
          </section>
        </div>
      </div>
      {notification}
    </main>
  );
}
