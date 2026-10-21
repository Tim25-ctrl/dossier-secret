// Retour des joueurs dans une partie en cours :
// - salle d'attente affichée quand la partie vient d'être rechargée depuis une sauvegarde ;
// - écran du joueur qui a demandé à reprendre sa place depuis un autre appareil ;
// - fenêtre où les joueurs présents acceptent ou refusent ces demandes.

import { useState } from 'react';
import type { AttentePlace, EtatClient } from '../../shared/protocole';
import { Chat } from '../components/Chat';
import { Modale, useNotification } from '../components/Commun';
import { Icone, Sceau } from '../components/Emblemes';
import { ModaleQr, partageDisponible, partagerInvitation } from '../components/Invitation';
import { MenuPrincipal } from '../components/Menu';
import { useSonMessages } from '../components/jeu/useSons';
import { connexion } from '../connexion';
import type { Preferences } from '../preferences';
import { deNom } from './Fin';

/** Code du salon en grand, avec partage, QR code et copie. */
export function BlocCode({ code, onMessage }: { code: string; onMessage: (texte: string, erreur?: boolean) => void }) {
  const [qr, setQr] = useState(false);
  const lien = `${location.origin}/?salon=${code}`;
  const copier = async (texte: string, quoi: string) => {
    try {
      await navigator.clipboard.writeText(texte);
      onMessage(`${quoi} copié.`);
    } catch {
      onMessage(`Copie impossible : recopiez le ${quoi.toLowerCase()} à la main.`, true);
    }
  };
  return (
    <>
      <div className="code-salon" aria-label={`Code : ${code.split('').join(' ')}`}>
        {code}
      </div>
      <div className="ligne" style={{ marginTop: 10 }}>
        {partageDisponible() && (
          <button
            className="btn btn-or btn-petit"
            onClick={() => void partagerInvitation(lien, code).then((r) => r === 'impossible' && onMessage('Partage impossible : copiez le lien.', true))}
          >
            📤 Partager
          </button>
        )}
        <button className="btn btn-petit" onClick={() => setQr(true)}>
          ▦ QR code
        </button>
        <button className="btn btn-petit" onClick={() => void copier(code, 'Code')}>
          <Icone nom="copie" /> Copier le code
        </button>
        <button className="btn btn-petit" onClick={() => void copier(lien, 'Lien')}>
          <Icone nom="copie" /> Copier le lien
        </button>
      </div>
      {qr && (
        <ModaleQr
          lien={lien}
          code={code}
          texte="la page du salon s'ouvre : il faut entrer le même pseudonyme qu'avant pour retrouver sa place."
          onFermer={() => setQr(false)}
        />
      )}
    </>
  );
}

/** Comment un joueur absent retrouve sa place. */
export function CommentRevenir() {
  return (
    <ul className="petit muet comment-revenir">
      <li>
        Sur l'appareil où il jouait : ouvrir le jeu et toucher <strong>« Reprendre ma partie »</strong>.
      </li>
      <li>
        Sur un autre appareil : <strong>« Rejoindre une partie »</strong> avec ce code et <strong>le même pseudonyme</strong> ; un joueur présent devra
        accepter son retour.
      </li>
    </ul>
  );
}

/** Salle d'attente : la partie vient d'être rechargée depuis une sauvegarde, elle reprend quand tout le monde est revenu. */
export function SalleReprise({ etat, prefs, majPrefs }: { etat: EtatClient; prefs: Preferences; majPrefs: (p: Partial<Preferences>) => void }) {
  const { salon, moi } = etat;
  const vue = etat.partie!;
  const { afficher, vue: notification } = useNotification();
  const [envoi, setEnvoi] = useState(false);
  useSonMessages(salon.messages, moi);
  const absents = new Set(vue.pause?.absents.map((a) => a.id) ?? []);
  const presents = salon.joueurs.filter((j) => !j.bot && j.connecte).length;
  const humains = salon.joueurs.filter((j) => !j.bot).length;

  const agir = async (f: () => Promise<{ ok: boolean; erreur?: string }>) => {
    setEnvoi(true);
    const r = await f();
    setEnvoi(false);
    if (!r.ok) afficher(r.erreur ?? 'Action refusée.', true);
  };

  return (
    <main className="page">
      <div className="ligne" style={{ marginBottom: 16 }}>
        <Sceau taille={46} />
        <h1 style={{ margin: 0, fontSize: '1.9rem' }}>Reprise de la partie</h1>
        <span className="espace" />
        <MenuPrincipal etat={etat} prefs={prefs} majPrefs={majPrefs} />
      </div>
      <p className="info" role="status">
        📂 La partie a été rechargée depuis une sauvegarde (manche {vue.manche} / {vue.regles.manchesMax}). Elle reprendra exactement là où elle s'était
        arrêtée dès que tout le monde sera revenu (joueurs présents : {presents} sur {humains}).
      </p>

      <div className="deux-colonnes">
        <div>
          <DemandesPlace etat={etat} onErreur={(e) => afficher(e, true)} />
          <section className="panneau" aria-labelledby="titre-code-reprise">
            <h3 id="titre-code-reprise">Code du salon</h3>
            <BlocCode code={salon.code} onMessage={afficher} />
            <p className="petit" style={{ marginTop: 12, marginBottom: 4 }}>
              Pour revenir dans la partie :
            </p>
            <CommentRevenir />
          </section>

          <section className="panneau" aria-labelledby="titre-joueurs-reprise">
            <h3 id="titre-joueurs-reprise">Joueurs</h3>
            <ul className="liste-joueurs">
              {salon.joueurs.map((j) => {
                const absent = absents.has(j.id);
                return (
                  <li key={j.id} className="joueur-reprise">
                    <span className={`pastille ${j.connecte ? 'pastille-on' : 'pastille-off'}`} aria-hidden="true" />
                    <span style={{ fontWeight: 600 }}>{j.nom}</span>
                    {j.id === moi && <span className="etiquette">vous</span>}
                    {j.bot && (
                      <span className="etiquette">
                        <Icone nom="robot" taille={12} /> bot
                      </span>
                    )}
                    <span className="petit muet">{j.bot || j.connecte ? 'présent' : absent ? 'en attente…' : 'la partie continue sans lui'}</span>
                    <span className="espace" />
                    {absent && j.id !== moi && (
                      <button
                        className="btn btn-discret btn-petit"
                        disabled={envoi}
                        onClick={() => void agir(() => (salon.botsAutorises ? connexion.remplacerParBot(j.id) : connexion.continuerSans(j.id)))}
                      >
                        {salon.botsAutorises ? 'Remplacer par un bot' : 'Continuer sans lui'}
                      </button>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="petit muet" style={{ marginBottom: 0 }}>
              Un joueur qui ne peut pas revenir peut être remplacé par un bot, qui joue avec ses cartes sans rien révéler. S'il revient plus tard, il
              reprend sa place.
            </p>
          </section>
        </div>
        <div>
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

/** Demandes de place en attente, à accepter ou refuser (affichées aux joueurs présents). */
export function DemandesPlace({ etat, onErreur }: { etat: EtatClient; onErreur: (e: string) => void }) {
  const [envoi, setEnvoi] = useState(false);
  if (etat.salon.demandes.length === 0) return null;
  const nom = (id: string) => etat.salon.joueurs.find((j) => j.id === id)?.nom ?? '?';
  const repondre = async (id: string, accepter: boolean) => {
    setEnvoi(true);
    const r = await connexion.repondrePlace(id, accepter);
    setEnvoi(false);
    if (!r.ok) onErreur(r.erreur);
  };
  return (
    <section className="panneau demandes-place" role="alert" aria-label="Demandes de retour">
      {etat.salon.demandes.map((d) => (
        <div key={d.id} className="demande-place">
          <p style={{ margin: '0 0 8px' }}>
            📲 <strong>{nom(d.joueurId)}</strong> veut reprendre sa place depuis un autre appareil.
          </p>
          <p className="petit muet" style={{ margin: '0 0 10px' }}>
            Acceptez seulement si c'est bien {nom(d.joueurId)} (demandez-lui de vive voix ou par message) : la personne verra ses cartes et son rôle.
          </p>
          <div className="ligne">
            <button className="btn btn-or btn-petit" disabled={envoi} onClick={() => void repondre(d.id, true)}>
              Accepter
            </button>
            <button className="btn btn-petit" disabled={envoi} onClick={() => void repondre(d.id, false)}>
              Refuser
            </button>
          </div>
        </div>
      ))}
    </section>
  );
}

/** Même chose en fenêtre, par-dessus le plateau de jeu. */
export function ModaleDemandesPlace({ etat, onErreur }: { etat: EtatClient; onErreur: (e: string) => void }) {
  return (
    <Modale titre="Retour d'un joueur">
      <DemandesPlace etat={etat} onErreur={onErreur} />
    </Modale>
  );
}

/** Écran du joueur qui attend qu'on accepte son retour (ou qui vient d'être refusé). */
export function EcranDemandePlace({ demande }: { demande: AttentePlace & { refus?: string } }) {
  return (
    <main className="accueil">
      <Sceau taille={80} />
      {demande.refus ? (
        <>
          <h2>Retour impossible</h2>
          <p style={{ maxWidth: 480 }}>{demande.refus}</p>
          <div className="accueil-actions">
            <button className="btn btn-or" onClick={() => connexion.annulerDemande()}>
              Retour à l'accueil
            </button>
          </div>
        </>
      ) : (
        <>
          <h2>Demande envoyée</h2>
          <p style={{ maxWidth: 480 }}>
            Salon <strong>{demande.code}</strong> : vous demandez à reprendre la place {deNom(demande.nom)}. Un joueur de la partie doit
            accepter ; gardez cette page ouverte.
          </p>
          <p className="muet petit">⏳ En attente de réponse…</p>
          <div className="accueil-actions">
            <button className="btn btn-discret" onClick={() => connexion.annulerDemande()}>
              Annuler
            </button>
          </div>
        </>
      )}
    </main>
  );
}
