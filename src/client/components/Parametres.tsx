// Fenêtre « Paramètres » : trois sections lisibles (Affichage, Sons, Pendant la partie), chaque
// réglage sur une ligne (nom à gauche, commande à droite). Les sons ont un volume général et des
// réglages avancés : chaque sorte de son s'active, se coupe et se règle séparément.

import { useState, type ReactNode } from 'react';
import type { Preferences } from '../preferences';
import { jouer, vibrationsPossibles, type CanalSon, type Son } from '../sons';
import { Modale } from './Commun';

/** Interrupteur marche / arrêt. */
function Interrupteur({ actif, onChange, libelle, desactive }: { actif: boolean; onChange: (v: boolean) => void; libelle: string; desactive?: boolean }) {
  return (
    <button type="button" role="switch" aria-checked={actif} aria-label={libelle} className="interrupteur" disabled={desactive} onClick={() => onChange(!actif)}>
      <span className="interrupteur-bille" />
    </button>
  );
}

/** Choix entre quelques options (boutons côte à côte). */
function Segments<T extends string>({ valeur, options, onChange, libelle }: { valeur: T; options: { v: T; l: string }[]; onChange: (v: T) => void; libelle: string }) {
  return (
    <div className="segments" role="radiogroup" aria-label={libelle}>
      {options.map((o) => (
        <button key={o.v} type="button" role="radio" aria-checked={valeur === o.v} className={valeur === o.v ? 'actif' : ''} onClick={() => onChange(o.v)}>
          {o.l}
        </button>
      ))}
    </div>
  );
}

/** Curseur de volume (0 à 100 %), avec un son d'essai en relâchant si `essai` est donné. */
function Curseur({ valeur, onChange, libelle, desactive, essai }: { valeur: number; onChange: (v: number) => void; libelle: string; desactive?: boolean; essai?: Son }) {
  return (
    <span className="curseur">
      <input
        type="range"
        min={0}
        max={1}
        step={0.05}
        value={valeur}
        aria-label={libelle}
        disabled={desactive}
        onChange={(e) => onChange(Number(e.target.value))}
        onPointerUp={() => essai && jouer(essai)}
        onKeyUp={() => essai && jouer(essai)}
      />
      <span className="curseur-valeur">{Math.round(valeur * 100)} %</span>
    </span>
  );
}

/** Une ligne de réglage : nom (et explication) à gauche, commande à droite. */
function Ligne({ libelle, aide, children, colonne }: { libelle: string; aide?: ReactNode; children: ReactNode; colonne?: boolean }) {
  return (
    <div className={`param-ligne${colonne ? ' colonne' : ''}`}>
      <span className="param-libelle">
        <strong>{libelle}</strong>
        {aide && <small>{aide}</small>}
      </span>
      <span className="param-commande">
        {children}
      </span>
    </div>
  );
}

const CANAUX: { id: CanalSon; titre: string; aide: string; essai?: Son }[] = [
  { id: 'bruitages', titre: 'Bruitages du jeu', aide: 'Votre tour, interrogations, cartes, dossiers, accusations…', essai: 'tour' },
  { id: 'tictac', titre: 'Tic-tac', aide: 'Les 10 dernières secondes de votre tour.', essai: 'tic' },
  { id: 'messages', titre: 'Messages', aide: 'Nouveau message dans la discussion.', essai: 'message' },
  { id: 'ambiance', titre: 'Ambiance', aide: 'Pluie, vent et tonnerre au manoir ; vent, vapeur et métal dans le train.' },
  { id: 'horloge', titre: 'Horloge et cloche', aide: 'Elles sonnent à chaque nouvelle manche.' },
  { id: 'musique', titre: 'Musique', aide: 'Piano et violoncelle pendant la partie.' },
];

export function ModaleParametres({
  prefs,
  majPrefs,
  onFermer,
  onGuide,
}: {
  prefs: Preferences;
  majPrefs: (p: Partial<Preferences>) => void;
  onFermer: () => void;
  /** Depuis l'accueil : relancer une partie guidée. */
  onGuide?: () => void;
}) {
  const [avance, setAvance] = useState(false);
  const majCanal = (id: CanalSon, partiel: Partial<Preferences['canaux'][CanalSon]>) =>
    majPrefs({ canaux: { ...prefs.canaux, [id]: { ...prefs.canaux[id], ...partiel } } });

  return (
    <Modale
      titre="Paramètres"
      onFermer={onFermer}
      pied={
        <button className="btn btn-or" onClick={onFermer}>
          Fermer
        </button>
      }
    >
      <section className="param-section">
        <h3>Affichage</h3>
        <Ligne libelle="Taille du texte">
          <Segments
            libelle="Taille du texte"
            valeur={prefs.taille}
            options={[
              { v: 'normal', l: 'Normale' },
              { v: 'grand', l: 'Grande' },
            ]}
            onChange={(v) => majPrefs({ taille: v })}
          />
        </Ligne>
        <Ligne libelle="Animations" aide="« Réduites » : moins de mouvements à l'écran.">
          <Segments
            libelle="Animations"
            valeur={prefs.animations}
            options={[
              { v: 'normales', l: 'Normales' },
              { v: 'reduites', l: 'Réduites' },
            ]}
            onChange={(v) => majPrefs({ animations: v })}
          />
        </Ligne>
      </section>

      <section className="param-section">
        <h3>Sons</h3>
        <Ligne libelle="Sons" aide={prefs.son ? undefined : 'Tous les sons sont coupés.'}>
          <Interrupteur libelle="Sons" actif={prefs.son} onChange={(v) => majPrefs({ son: v })} />
        </Ligne>
        {prefs.son && (
          <>
            <Ligne libelle="Volume général">
              <Curseur libelle="Volume général" valeur={prefs.volumeGeneral} onChange={(v) => majPrefs({ volumeGeneral: v })} essai="tour" />
            </Ligne>
            <button type="button" className="param-avance" aria-expanded={avance} onClick={() => setAvance(!avance)}>
              <span>Réglages avancés : chaque son séparément</span>
              <span aria-hidden="true" className="param-chevron">
                ▾
              </span>
            </button>
            {avance && (
              <ul className="param-canaux">
                {CANAUX.map((c) => {
                  const r = prefs.canaux[c.id];
                  return (
                    <li key={c.id} className={r.actif ? '' : 'coupe'}>
                      <Ligne libelle={c.titre} aide={c.aide}>
                        <Interrupteur
                          libelle={c.titre}
                          actif={r.actif}
                          onChange={(v) => {
                            majCanal(c.id, { actif: v });
                            if (v && c.essai) setTimeout(() => jouer(c.essai!), 50);
                          }}
                        />
                      </Ligne>
                      <Curseur libelle={`Volume : ${c.titre}`} valeur={r.volume} desactive={!r.actif} onChange={(v) => majCanal(c.id, { volume: v })} essai={c.essai} />
                    </li>
                  );
                })}
                <li className="petit muet param-note">L'ambiance, l'horloge et la musique s'entendent pendant une partie.</li>
              </ul>
            )}
          </>
        )}
      </section>

      <section className="param-section">
        <h3>Pendant la partie</h3>
        <Ligne
          libelle="Vibrations"
          aide={vibrationsPossibles() ? 'Quand c’est votre tour et quand on vous interroge.' : 'Cet appareil ne permet pas aux sites de vibrer (c’est le cas des iPhone).'}
        >
          <Interrupteur libelle="Vibrations" actif={prefs.vibrations && vibrationsPossibles()} desactive={!vibrationsPossibles()} onChange={(v) => majPrefs({ vibrations: v })} />
        </Ligne>
        <Ligne libelle="Historique">
          <Segments
            libelle="Historique"
            valeur={prefs.historique}
            options={[
              { v: 'roman', l: 'Façon roman' },
              { v: 'simple', l: 'Simple' },
            ]}
            onChange={(v) => majPrefs({ historique: v })}
          />
        </Ligne>
        <Ligne
          libelle="Conseils"
          aide={
            prefs.conseils && prefs.conseilsVus.length > 0 ? (
              <button type="button" className="lien-discret" onClick={() => majPrefs({ conseilsVus: [] })}>
                Réafficher les conseils déjà lus
              </button>
            ) : (
              'Petites aides pendant vos premières parties.'
            )
          }
        >
          <Interrupteur libelle="Conseils" actif={prefs.conseils} onChange={(v) => majPrefs({ conseils: v })} />
        </Ligne>
      </section>

      {onGuide && (
        <section className="param-section">
          <h3>Aide</h3>
          <button className="btn btn-petit" onClick={onGuide}>
            🎓 Refaire une partie guidée
          </button>
        </section>
      )}
    </Modale>
  );
}
