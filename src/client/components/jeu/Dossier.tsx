import { useState } from 'react';
import { AFFAIRES, ARMES_FICHES, LIEUX_FICHES, MOBILES_FICHES, PERSONNAGES } from '../../../shared/data/catalogue';
import { categorieDe, elementsDe, type AffaireId, type ArmeId, type ElementId, type LieuId, type SuspectId } from '../../../shared/types';
import { Modale } from '../Commun';
import { Embleme } from '../Emblemes';

/** Contenu de la fiche d'un élément : le même dans les règles et sur la carte du carnet. */
interface Fiche {
  nom: string;
  categorie: string;
  /** Ligne en italique sous le nom. */
  accroche: string;
  rubriques: [string, string][];
}

/**
 * @param grande « Grande enquête » : la rubrique « mobile » d'un suspect devient « raison d'en vouloir
 *        à la victime », car le vrai mobile est une carte à part, qui peut être un autre.
 */
export function ficheDe(id: ElementId, grande = false): Fiche {
  const cat = categorieDe(id);
  if (cat === 'mobile') {
    const m = MOBILES_FICHES[id];
    return { nom: m.nom, categorie: 'Mobile', accroche: m.description, rubriques: [['Si c’est le mobile', `Le crime a été commis ${m.article}.`]] };
  }
  if (cat === 'suspect') {
    const p = PERSONNAGES[id as SuspectId];
    return {
      nom: p.nom,
      categorie: 'Suspect',
      accroche: `${p.titre} — ${p.description}`,
      rubriques: [
        ['Histoire', p.histoire],
        ['Relation', p.relation],
        [grande ? 'Raison d’en vouloir à la victime' : 'Mobile possible', p.mobile],
        ['Secret', p.secret],
        ['Alibi déclaré', p.alibi],
        ["Ce qu'il sait", p.connaissances],
      ],
    };
  }
  if (cat === 'lieu') {
    const l = LIEUX_FICHES[id as LieuId];
    return { nom: l.nom, categorie: 'Lieu', accroche: l.description, rubriques: [['À observer', l.details.join(' · ')]] };
  }
  const a = ARMES_FICHES[id as ArmeId];
  return { nom: a.nom, categorie: 'Arme', accroche: a.description, rubriques: [['Caractéristiques', a.caracteristiques.join(' · ')]] };
}

function FicheDossier({ id, grande = false }: { id: ElementId; grande?: boolean }) {
  const f = ficheDe(id, grande);
  return (
    <article className="panneau fiche">
      <Embleme id={id} taille={96} />
      <div>
        <h3 style={{ marginBottom: 2 }}>{f.nom}</h3>
        <p className="muet" style={{ fontStyle: 'italic' }}>
          {f.accroche}
        </p>
        <dl>
          {f.rubriques.map(([titre, texte]) => (
            <div key={titre} style={{ display: 'contents' }}>
              <dt>{titre}</dt>
              <dd>{texte}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

/** La même fiche, présentée comme une carte à jouer (carnet : carte affichée en grand). */
export function CarteDeJeu({ id, grande = false }: { id: ElementId; grande?: boolean }) {
  const f = ficheDe(id, grande);
  return (
    <article className={`carte-jeu carte-jeu-${categorieDe(id)}`} aria-label={`Carte ${f.categorie.toLowerCase()} : ${f.nom}`}>
      <span className="carte-jeu-coin haut" aria-hidden="true">
        <Embleme id={id} taille={22} />
      </span>
      <span className="carte-jeu-coin bas" aria-hidden="true">
        <Embleme id={id} taille={22} />
      </span>
      <div className="carte-jeu-cadre">
        <p className="carte-jeu-categorie">{f.categorie}</p>
        <div className="carte-jeu-portrait">
          <Embleme id={id} taille={120} />
        </div>
        <h3 className="carte-jeu-nom">{f.nom}</h3>
        <p className="carte-jeu-accroche">{f.accroche}</p>
        <dl className="carte-jeu-rubriques">
          {f.rubriques.map(([titre, texte]) => (
            <div key={titre}>
              <dt>{titre}</dt>
              <dd>{texte}</dd>
            </div>
          ))}
        </dl>
      </div>
    </article>
  );
}

/** L'histoire de l'affaire : le crime, le huis clos, la fenêtre du crime. */
export function HistoireAffaire({ affaire }: { affaire: AffaireId }) {
  const infos = AFFAIRES[affaire];
  return (
    <div className="histoire-affaire">
      <h3>{infos.titre}</h3>
      {infos.resume.map((p) => (
        <p key={p}>{p}</p>
      ))}
    </div>
  );
}

const CLE_HISTOIRES_LUES = 'dossier-secret:histoires-lues';

/** Parties dont l'histoire a déjà été présentée sur cet appareil (les 30 dernières). */
function histoiresLues(): string[] {
  try {
    const l = JSON.parse(localStorage.getItem(CLE_HISTOIRES_LUES) ?? '[]') as unknown;
    return Array.isArray(l) ? l.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** L'histoire est-elle à présenter pour cette partie (première ouverture sur cet appareil) ? */
export function histoireAPresenter(partieId: string): boolean {
  return !histoiresLues().includes(partieId);
}

export function marquerHistoireLue(partieId: string) {
  try {
    localStorage.setItem(CLE_HISTOIRES_LUES, JSON.stringify([...histoiresLues().filter((x) => x !== partieId), partieId].slice(-30)));
  } catch {
    /* stockage indisponible : l'histoire sera reproposée */
  }
}

/** Fenêtre d'ouverture de la partie : l'histoire de l'affaire, à lire avant de commencer. */
export function ModaleHistoire({ affaire, onFermer }: { affaire: AffaireId; onFermer: () => void }) {
  return (
    <Modale
      titre="L'affaire"
      onFermer={onFermer}
      pied={
        <button className="btn btn-or" onClick={onFermer} autoFocus>
          Commencer l'enquête
        </button>
      }
    >
      <HistoireAffaire affaire={affaire} />
      <p className="petit muet" style={{ marginBottom: 0 }}>
        Votre rôle et vos cartes sont dans le panneau privé. Vous retrouverez cette histoire à tout moment dans le menu ☰, « Les affaires ».
      </p>
    </Modale>
  );
}

/** @param grande « Grande enquête » : ajoute les six mobiles. */
export function Dossier({ affaire, grande = false }: { affaire: AffaireId; grande?: boolean }) {
  const [section, setSection] = useState<'histoire' | 'suspects' | 'lieux' | 'armes' | 'mobiles'>('histoire');
  const e = elementsDe(affaire);
  const ids: readonly ElementId[] = section === 'suspects' ? e.suspects : section === 'lieux' ? e.lieux : section === 'mobiles' ? e.mobiles : e.armes;
  const sections = grande ? (['histoire', 'suspects', 'lieux', 'armes', 'mobiles'] as const) : (['histoire', 'suspects', 'lieux', 'armes'] as const);
  const titres = { histoire: "L'histoire", suspects: 'Les six suspects', lieux: 'Les six lieux', armes: 'Les six armes', mobiles: 'Les six mobiles' };
  return (
    <div>
      <div className="ligne" role="tablist" aria-label="Sections du dossier" style={{ marginBottom: 12 }}>
        {sections.map((s) => (
          <button key={s} role="tab" aria-selected={section === s} className={`btn btn-petit ${section === s ? 'btn-or' : ''}`} onClick={() => setSection(s)}>
            {titres[s]}
          </button>
        ))}
      </div>
      {section === 'histoire' ? (
        <HistoireAffaire affaire={affaire} />
      ) : (
        <div className="indices">
          {ids.map((id) => (
            <FicheDossier key={id} id={id} grande={grande} />
          ))}
        </div>
      )}
    </div>
  );
}
