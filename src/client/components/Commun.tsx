import { useEffect, useId, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { INDICES_PAR_ID, affaireDeCarte, libelleCategorie } from '../../shared/data/catalogue';
import { nomCourt, nomElement } from '../../shared/data/catalogue';
import { ceQueLIndiceEcarte, precision } from '../../shared/logique';
import { categorieDe, type CarteIndice as CarteIndiceType, type ElementId, type Triplet } from '../../shared/types';
import { Embleme, Icone } from './Emblemes';

export const LIBELLE_CATEGORIE = { suspect: 'Suspect', lieu: 'Lieu', arme: 'Arme' } as const;

export function Carte({
  id,
  taille = 'normale',
  onClick,
  presse,
  desactive,
  marqueur,
  titre,
}: {
  id: ElementId;
  taille?: 'normale' | 'mini';
  onClick?: () => void;
  presse?: boolean;
  desactive?: boolean;
  marqueur?: string;
  titre?: string;
}) {
  const cat = categorieDe(id)!;
  const contenu = (
    <>
      <Embleme id={id} taille={taille === 'mini' ? 26 : 54} />
      {taille === 'mini' ? (
        <span className="nom-carte">{nomCourt(id)}</span>
      ) : (
        <>
          <span className="nom-carte">{nomElement(id)}</span>
          <span className="type-carte">{LIBELLE_CATEGORIE[cat]}</span>
        </>
      )}
      {marqueur && <span className="marqueur">{marqueur}</span>}
    </>
  );
  const classe = `carte${taille === 'mini' ? ' carte-mini' : ''}`;
  if (onClick)
    return (
      <button type="button" className={classe} onClick={onClick} aria-pressed={presse} disabled={desactive} title={titre}>
        {contenu}
      </button>
    );
  return (
    <span className={classe} title={titre ?? nomElement(id)}>
      {contenu}
    </span>
  );
}

export function TripletVue({ t }: { t: Triplet }) {
  return (
    <span className="triplet">
      <Carte id={t.suspect} taille="mini" />
      <Carte id={t.lieu} taille="mini" />
      <Carte id={t.arme} taille="mini" />
    </span>
  );
}

export function texteTriplet(t: Triplet) {
  return `${nomElement(t.suspect)} · ${nomElement(t.lieu)} · ${nomElement(t.arme)}`;
}

export function CarteIndice({ id, dossier, ouvert = true, categorie }: { id: string; dossier?: number; ouvert?: boolean; categorie?: CarteIndiceType['categorie'] }) {
  const c = INDICES_PAR_ID[id];
  const [details, setDetails] = useState(ouvert);
  if (!c) return null;
  const affichee = categorie ?? c.categorie;
  return (
    <article className={affichee === 'journal' ? 'indice page-journal' : 'indice'}>
      <div className="meta">
        <span>{libelleCategorie(affichee, affaireDeCarte(c))}</span>
        {dossier !== undefined && <span>Dossier n° {dossier}</span>}
        <span>Précision {precision(c)}</span>
      </div>
      <h4>{c.titre}</h4>
      <p>{c.texte}</p>
      <button type="button" className="btn btn-discret btn-petit" style={{ color: '#5b4520' }} onClick={() => setDetails(!details)} aria-expanded={details}>
        {details ? 'Masquer' : 'Afficher'} ce que l'indice permet d'écarter
      </button>
      {details && (
        <ul>
          {ceQueLIndiceEcarte(c).map((l) => (
            <li key={l}>{l}</li>
          ))}
        </ul>
      )}
    </article>
  );
}

export function Modale({
  titre,
  onFermer,
  children,
  pied,
  titreMasque = false,
}: {
  titre: ReactNode;
  onFermer?: () => void;
  children: ReactNode;
  pied?: ReactNode;
  /** Titre lu par les lecteurs d'écran mais non affiché (le contenu le montre déjà). */
  titreMasque?: boolean;
}) {
  const idTitre = useId();
  const ref = useRef<HTMLDivElement>(null);
  // Dernière version de onFermer : les parents la recréent à chaque rendu, ce qui ne doit
  // PAS relancer l'effet ci-dessous (sinon le focus est volé à chaque frappe ou mise à jour).
  const fermer = useRef(onFermer);
  fermer.current = onFermer;
  useEffect(() => {
    const precedent = document.activeElement as HTMLElement | null;
    // Le focus n'est placé sur la fenêtre que si rien à l'intérieur ne l'a déjà (ex. autoFocus).
    if (!ref.current?.contains(document.activeElement)) ref.current?.focus();
    const echap = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fermer.current?.();
    };
    document.addEventListener('keydown', echap);
    return () => {
      document.removeEventListener('keydown', echap);
      precedent?.focus?.();
    };
  }, []);
  // Rendu à la racine du document : une fenêtre ne doit jamais être prisonnière de son parent
  // (ex. la barre du haut, dont le flou d’arrière-plan crée un nouveau repère d’affichage).
  return createPortal(
    <div className="voile" onMouseDown={(e) => e.target === e.currentTarget && onFermer?.()}>
      <div className="modale" role="dialog" aria-modal="true" aria-labelledby={idTitre} tabIndex={-1} ref={ref}>
        <div className="modale-entete">
          <h2 id={idTitre} className={titreMasque ? 'sr-only' : undefined} style={{ margin: 0 }}>
            {titre}
          </h2>
          {onFermer && (
            <button type="button" className="btn btn-discret btn-petit" style={{ marginLeft: 'auto' }} onClick={onFermer} aria-label="Fermer">
              ✕
            </button>
          )}
        </div>
        {children}
        {pied && <div className="modale-pied">{pied}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Bulle d'aide accessible au clavier, à la souris et au toucher. */
/**
 * Bulle d'aide « ? ». Elle est placée par rapport au bouton puis ramenée dans l'écran
 * (au-dessus du bouton, ou en dessous s'il n'y a pas la place) : sur téléphone, un bouton
 * collé au bord ne doit pas faire déborder le texte hors de l'écran.
 */
export function Aide({ children, libelle = 'Aide' }: { children: ReactNode; libelle?: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const bulle = useRef<HTMLSpanElement>(null);
  const id = useId();
  useLayoutEffect(() => {
    if (!ouvert) {
      setPosition(null);
      return;
    }
    const placer = () => {
      const b = bouton.current?.getBoundingClientRect();
      const el = bulle.current;
      if (!b || !el) return;
      const marge = 12;
      const largeur = el.offsetWidth;
      const hauteur = el.offsetHeight;
      const left = Math.max(marge, Math.min(b.left + b.width / 2 - largeur / 2, window.innerWidth - marge - largeur));
      const dessus = b.top - 8 - hauteur;
      const top = dessus >= marge ? dessus : Math.min(b.bottom + 8, window.innerHeight - marge - hauteur);
      setPosition({ left, top });
    };
    placer();
    window.addEventListener('resize', placer);
    window.addEventListener('scroll', placer, true);
    return () => {
      window.removeEventListener('resize', placer);
      window.removeEventListener('scroll', placer, true);
    };
  }, [ouvert]);
  return (
    <span className="aide" onMouseEnter={() => setOuvert(true)} onMouseLeave={() => setOuvert(false)}>
      <button
        ref={bouton}
        type="button"
        className="aide-bouton"
        aria-label={libelle}
        aria-describedby={ouvert ? id : undefined}
        onClick={() => setOuvert(!ouvert)}
        onBlur={() => setOuvert(false)}
      >
        ?
      </button>
      {ouvert &&
        createPortal(
          <span
            ref={bulle}
            role="tooltip"
            id={id}
            className="aide-bulle"
            style={position ? { left: position.left, top: position.top } : { left: 0, top: 0, visibility: 'hidden' }}
          >
            {children}
          </span>,
          document.body,
        )}
    </span>
  );
}

export function Prive({ children, titre = 'Privé — visible par vous seul' }: { children: ReactNode; titre?: string }) {
  return (
    <section className="prive">
      <div className="prive-entete">
        <Icone nom="cadenas" taille={14} /> {titre}
      </div>
      {children}
    </section>
  );
}

export function EntetePublic({ children = 'Public — visible par tous' }: { children?: ReactNode }) {
  return (
    <div className="public-entete">
      <Icone nom="oeil" taille={14} /> {children}
    </div>
  );
}

/** Compte à rebours basé sur l'heure du serveur. */
export function Chrono({ echeance, decalage, total }: { echeance: number; decalage: number; total?: number }) {
  const [, setTic] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTic((x) => x + 1), 250);
    return () => clearInterval(t);
  }, []);
  const restant = Math.max(0, echeance - (Date.now() + decalage));
  const s = Math.ceil(restant / 1000);
  const texte = s >= 60 ? `${Math.floor(s / 60)} min ${String(s % 60).padStart(2, '0')}` : `${s} s`;
  return (
    <span>
      <span className={`chrono${s <= 10 ? ' urgent' : ''}`} aria-label={`${s} secondes restantes`}>
        {texte}
      </span>
      {total ? (
        <div className="barre-progression" aria-hidden="true">
          <div style={{ width: `${Math.min(100, (restant / total) * 100)}%` }} />
        </div>
      ) : null}
    </span>
  );
}

/** Petite notification temporaire. */
export function useNotification() {
  const [notif, setNotif] = useState<{ texte: string; erreur: boolean } | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const afficher = (texte: string, erreur = false) => {
    setNotif({ texte, erreur });
    if (minuteur.current) clearTimeout(minuteur.current);
    minuteur.current = setTimeout(() => setNotif(null), erreur ? 5000 : 3000);
  };
  const vue = notif ? (
    <div className={`notification${notif.erreur ? ' erreur-notif' : ''}`} role={notif.erreur ? 'alert' : 'status'}>
      {notif.texte}
    </div>
  ) : null;
  return { afficher, vue };
}
