import { useState } from 'react';
import type { EtatClient } from '../../shared/protocole';
import { Chat } from '../components/Chat';
import { useNotification } from '../components/Commun';
import { Icone, Sceau } from '../components/Emblemes';
import { connexion } from '../connexion';
import { ModaleRegles } from './Regles';

export function Lobby({ etat }: { etat: EtatClient }) {
  const { salon, moi } = etat;
  const estHote = salon.hote === moi;
  const { afficher, vue: notification } = useNotification();
  const [regles, setRegles] = useState(false);
  const [lancement, setLancement] = useState(false);
  const lien = `${location.origin}/?salon=${salon.code}`;
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
        <button className="btn btn-discret" onClick={() => setRegles(true)}>
          <Icone nom="livre" /> Règles
        </button>
        <button className="btn btn-discret" onClick={() => void connexion.quitter()}>
          Quitter le salon
        </button>
      </div>

      <div className="deux-colonnes">
        <div>
          <section className="panneau" aria-labelledby="titre-code">
            <h3 id="titre-code">Code d'invitation</h3>
            <div className="code-salon" aria-label={`Code : ${salon.code.split('').join(' ')}`}>
              {salon.code}
            </div>
            <div className="ligne" style={{ marginTop: 10 }}>
              <button className="btn btn-petit" onClick={() => void copier(salon.code, 'Code')}>
                <Icone nom="copie" /> Copier le code
              </button>
              <button className="btn btn-petit" onClick={() => void copier(lien, 'Lien')}>
                <Icone nom="copie" /> Copier le lien d'invitation
              </button>
            </div>
            <p className="muet petit" style={{ marginTop: 10, marginBottom: 0 }}>
              Envoyez ce code ou ce lien aux autres joueurs. Ils choisiront leur pseudonyme en arrivant.
            </p>
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
            <ul style={{ paddingLeft: '1.1em', margin: 0 }}>
              <li>Trouvez le meurtrier, le lieu et l'arme.</li>
              <li>Un joueur secret est complice : il connaît le meurtrier.</li>
              <li>2 points d'action par tour, 12 manches maximum.</li>
              <li>Hypothèse : le premier joueur interrogé qui a une carte correspondante vous en montre une, en secret.</li>
              <li>Le complice peut mentir 2 fois et falsifier 1 hypothèse.</li>
              <li>Une seule accusation finale par joueur.</li>
            </ul>
          </section>
          <section className="panneau">
            <h3>Discussion</h3>
            <Chat messages={salon.messages} moi={moi} onErreur={(e) => afficher(e, true)} />
          </section>
        </div>
      </div>
      {regles && <ModaleRegles onFermer={() => setRegles(false)} />}
      {notification}
    </main>
  );
}
