// Musique de la partie : de vrais petits morceaux composés (mélodie, accords, forme), joués par des
// instruments synthétisés dans le navigateur (Web Audio). Aucun fichier, aucun droit d'auteur.
//
// - Manoir : nocturnes en ré mineur à trois temps, comme une valse lente (piano et violoncelle).
// - Train : ballades feutrées façon années 30, comme au wagon-restaurant (piano, contrebasse
//   pincée, balais sur la caisse claire).
// - Deux dernières manches : un morceau tendu (cordes pincées qui pressent le pas, battement de
//   cœur). Il ne dépend que de la manche, que tout le monde voit.
//
// Entre deux morceaux, un silence laisse la place à l'ambiance. Chaque passage varie un peu
// (nuances, ordre des morceaux). La musique reste discrète, en fond, et plutôt grave : les aigus
// sont adoucis et moins forts.

export type AffaireMusique = 'manoir' | 'train';
export type Instrument = 'piano' | 'violoncelle' | 'pizz' | 'brosse' | 'coeur';

/** Une note : départ et durée en secondes (depuis le début de sa section), force de 0 à 1. */
export interface Note {
  t: number;
  instr: Instrument;
  midi: number;
  duree: number;
  force: number;
}

export interface SectionJouee {
  duree: number;
  notes: Note[];
}

/** Où et quand jouer. */
export interface SortieMusique {
  c: BaseAudioContext;
  /** Son direct. */
  sortie: AudioNode;
  /** Envoi vers la réverbération. */
  echo: AudioNode;
}

interface Lecture extends SortieMusique {
  /** Faux quand la partie est quittée : tout s'arrête. */
  vivante: () => boolean;
  /** Deux dernières manches. */
  tension: () => boolean;
  minuteurs: Set<number>;
}

// ---------------------------------------------------------------------------
// Écriture des partitions
// ---------------------------------------------------------------------------

const DEGRES: Record<string, number> = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };

/** « D4 », « Bb3 », « C#5 » → numéro MIDI (La 4 = 69). */
export function midi(nom: string): number {
  const m = /^([A-G])([#b]?)(\d)$/.exec(nom);
  if (!m) throw new Error(`Note inconnue : ${nom}`);
  return 12 * (Number(m[3]) + 1) + DEGRES[m[1]] + (m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0);
}

const frequence = (m: number) => 440 * Math.pow(2, (m - 69) / 12);

interface Accord {
  basse: number;
  voix: number[];
}
const acc = (basse: string, voix: string): Accord => ({ basse: midi(basse), voix: voix.split(' ').map(midi) });

/** « D5:3 C5:2 - :1 | … » : chaque élément est « nom:durée en temps » (« - » = silence). */
function lire(partition: string): { nom: string | null; pos: number; duree: number }[] {
  let pos = 0;
  return partition
    .split(/\s+/)
    .filter((x) => x && x !== '|')
    .map((x) => {
      const [nom, d] = x.split(':');
      const duree = Number(d);
      if (!(duree > 0)) throw new Error(`Durée invalide : ${x}`);
      const e = { nom: nom === '-' ? null : nom, pos, duree };
      pos += duree;
      return e;
    });
}

type Accompagnement = 'valse' | 'arpege' | 'tenu' | 'comp' | 'ostinato';

interface Partie {
  section: string;
  /** Qui joue la mélodie (aucune : accompagnement seul). */
  melodie?: 'piano' | 'violoncelle';
  /** Transposition de la mélodie, en octaves. */
  octave?: number;
  accomp: Accompagnement;
  /** Le violoncelle tient la basse de chaque accord. */
  celloBasse?: boolean;
  /** Battement de cœur sur les temps 1 et 3. */
  coeur?: boolean;
}

export interface Morceau {
  nom: string;
  tempo: number;
  temps: 3 | 4;
  /** Croches « swing » (longue-brève), comme dans le jazz des années 30. */
  swing?: boolean;
  /** Tout le morceau est joué plus bas (en demi-tons), pour éviter les aigus. */
  transposition?: number;
  accords: Record<string, Accord>;
  sections: Record<string, { accords: string; melodie: string }>;
  forme: Partie[];
}

// ---------------------------------------------------------------------------
// Les morceaux
// ---------------------------------------------------------------------------

const ACCORDS_MANOIR: Record<string, Accord> = {
  Dm: acc('D3', 'F3 A3 D4'),
  'Dm/C': acc('C3', 'F3 A3 D4'),
  'Dm/F': acc('F3', 'A3 D4 F4'),
  Bb: acc('Bb2', 'F3 Bb3 D4'),
  A: acc('A2', 'E3 A3 C#4'),
  A7: acc('A2', 'G3 C#4 E4'),
  Gm: acc('G2', 'G3 Bb3 D4'),
  F: acc('F2', 'F3 A3 C4'),
  'F/A': acc('A2', 'F3 A3 C4'),
  C: acc('C3', 'E3 G3 C4'),
};

const ACCORDS_TRAIN: Record<string, Accord> = {
  Dm7: acc('D3', 'F3 A3 C4 E4'),
  Em7b5: acc('E3', 'G3 Bb3 D4'),
  A7: acc('A2', 'G3 C#4 F4'),
  Bbmaj7: acc('Bb2', 'A3 D4 F4'),
  Gm7: acc('G2', 'F3 Bb3 D4'),
  C7: acc('C3', 'E3 Bb3 D4'),
  Fmaj7: acc('F2', 'E3 A3 C4'),
  Am7: acc('A2', 'G3 C4 E4'),
  D7: acc('D3', 'F#3 C4 E4'),
};

const CODA_TRAIN = { accords: 'Dm7:4 Dm7:4', melodie: '-:1 A4:0.5 C5:0.5 D5:2 | -:4' };
const INTRO_TRAIN = { accords: 'Dm7:4 A7:4', melodie: '-:8' };

export const MORCEAUX: Record<AffaireMusique | 'tension', Morceau[]> = {
  manoir: [
    {
      nom: 'Nocturne',
      tempo: 60,
      temps: 3,
      transposition: -12,
      accords: ACCORDS_MANOIR,
      sections: {
        intro: { accords: 'Dm:3 Dm:3', melodie: '-:6' },
        A: {
          accords: 'Dm:3 Dm/C:3 Bb:3 A:3 Gm:3 Dm/F:3 A7:3 Dm:3',
          melodie: 'D5:3 | C5:2 A4:1 | Bb4:1.5 A4:0.5 G4:1 | A4:3 | G4:2 Bb4:1 | A4:2 F4:1 | G4:1 F4:1 E4:1 | D4:3',
        },
        B: {
          accords: 'Bb:3 F/A:3 Gm:3 Dm:3 Gm:3 A7:3 Dm:3 A:3',
          melodie: 'F5:2 D5:1 | C5:3 | D5:1.5 C5:0.5 Bb4:1 | A4:3 | Bb4:2 G4:1 | C#5:2 E5:1 | F5:1 E5:1 D5:1 | C#5:3',
        },
        coda: { accords: 'Gm:3 Dm:6', melodie: 'Bb4:2 A4:1 | D4:6' },
      },
      forme: [
        { section: 'intro', accomp: 'valse' },
        { section: 'A', melodie: 'piano', accomp: 'valse' },
        { section: 'B', melodie: 'piano', accomp: 'valse', celloBasse: true },
        { section: 'A', melodie: 'violoncelle', accomp: 'arpege' },
        { section: 'coda', melodie: 'piano', accomp: 'tenu', celloBasse: true },
      ],
    },
    {
      nom: 'Valse triste',
      tempo: 66,
      temps: 3,
      transposition: -12,
      accords: ACCORDS_MANOIR,
      sections: {
        intro: { accords: 'Dm:3 A:3', melodie: '-:6' },
        A: {
          accords: 'Dm:3 Bb:3 Gm:3 A:3 Dm:3 F:3 Gm:1.5 A:1.5 Dm:3',
          melodie: '-:1 F4:1 A4:1 | D5:2 C5:1 | Bb4:2 A4:1 | E4:3 | -:1 A4:1 D5:1 | F5:2 E5:1 | D5:1.5 C#5:1.5 | D5:3',
        },
        B: {
          accords: 'Gm:3 C:3 F:3 Bb:3 Gm:3 A:3 Dm:3 A7:3',
          melodie: 'G5:2 F5:1 | E5:2 D5:1 | C5:3 | D5:1 C5:1 Bb4:1 | Bb4:2 A4:1 | C#5:1.5 B4:0.5 A4:1 | F4:1 E4:1 D4:1 | E4:2 -:1',
        },
        coda: { accords: 'Gm:3 A7:3 Dm:6', melodie: 'Bb4:3 | C#5:3 | D5:6' },
      },
      forme: [
        { section: 'intro', accomp: 'valse' },
        { section: 'A', melodie: 'piano', accomp: 'valse' },
        { section: 'B', melodie: 'violoncelle', accomp: 'valse' },
        { section: 'A', melodie: 'piano', accomp: 'arpege', celloBasse: true },
        { section: 'coda', melodie: 'piano', accomp: 'tenu' },
      ],
    },
  ],
  train: [
    {
      nom: 'Wagon-restaurant',
      tempo: 72,
      temps: 4,
      swing: true,
      transposition: -12,
      accords: ACCORDS_TRAIN,
      sections: {
        intro: INTRO_TRAIN,
        A: {
          accords: 'Dm7:4 Em7b5:2 A7:2 Dm7:4 Bbmaj7:4 Gm7:4 C7:4 Fmaj7:4 Em7b5:2 A7:2',
          melodie:
            '-:1 A4:0.5 C5:0.5 D5:1.5 C5:0.5 | A4:2 G4:0.5 A4:0.5 Bb4:1 | A4:3 -:1 | -:0.5 F4:0.5 G4:0.5 A4:0.5 D5:1 C5:1 | Bb4:1.5 A4:0.5 G4:2 | -:1 G4:0.5 A4:0.5 Bb4:1 C5:1 | A4:4 | G4:1 E4:1 C#5:2',
        },
        B: {
          accords: 'Gm7:4 C7:4 Am7:4 D7:4 Gm7:4 C7:4 Fmaj7:4 A7:4',
          melodie:
            'D5:1.5 Bb4:0.5 G4:1 A4:1 | Bb4:3 -:1 | C5:1.5 A4:0.5 E4:1 G4:1 | F#4:3 -:1 | G4:0.5 A4:0.5 Bb4:0.5 D5:0.5 F5:1.5 E5:0.5 | D5:1 C5:1 Bb4:1 G4:1 | A4:2 C5:2 | C#5:1 E5:1 -:2',
        },
        coda: CODA_TRAIN,
      },
      forme: [
        { section: 'intro', accomp: 'comp' },
        { section: 'A', melodie: 'piano', accomp: 'comp' },
        { section: 'B', melodie: 'piano', accomp: 'comp' },
        { section: 'A', melodie: 'piano', accomp: 'comp' },
        { section: 'coda', melodie: 'piano', accomp: 'tenu' },
      ],
    },
    {
      nom: 'Blues de minuit',
      tempo: 76,
      temps: 4,
      swing: true,
      transposition: -12,
      accords: ACCORDS_TRAIN,
      sections: {
        intro: INTRO_TRAIN,
        A: {
          accords: 'Dm7:4 Dm7:4 Dm7:4 Dm7:4 Gm7:4 Gm7:4 Dm7:4 Dm7:4 Bbmaj7:4 A7:4 Dm7:4 A7:4',
          melodie:
            '-:1 A4:0.5 C5:0.5 D5:1 F5:1 | E5:1.5 D5:0.5 C5:2 | -:1 A4:0.5 C5:0.5 D5:0.5 C5:0.5 A4:1 | F4:2 -:2 | -:1 D5:0.5 F5:0.5 G5:1 F5:1 | D5:3 -:1 | -:1 A4:0.5 C5:0.5 D5:1 C5:1 | A4:3 -:1 | -:0.5 F4:0.5 A4:0.5 D5:0.5 F5:2 | E5:1.5 C#5:0.5 A4:2 | D5:1 A4:1 F4:1 E4:1 | C#5:2 E4:1 -:1',
        },
        coda: CODA_TRAIN,
      },
      forme: [
        { section: 'intro', accomp: 'comp' },
        { section: 'A', melodie: 'piano', accomp: 'comp' },
        { section: 'A', melodie: 'piano', accomp: 'comp' },
        { section: 'coda', melodie: 'piano', accomp: 'tenu' },
      ],
    },
  ],
  tension: [
    {
      nom: 'Tension',
      tempo: 92,
      temps: 4,
      transposition: -7,
      accords: {
        Dm: acc('D3', 'F3 A3 D4'),
        'Eb/D': acc('D3', 'G3 Bb3 Eb4'),
        'C#o/D': acc('D3', 'E3 G3 C#4'),
        Bb: acc('Bb2', 'F3 Bb3 D4'),
        A: acc('A2', 'E3 A3 C#4'),
      },
      sections: {
        T: {
          accords: 'Dm:4 Eb/D:4 Dm:4 C#o/D:4 Dm:4 Eb/D:4 Bb:4 A:4',
          melodie: '-:2 A4:2 | -:2 Bb4:2 | -:2 A4:1 F4:1 | E4:4 | -:2 D4:2 | -:2 Eb4:2 | -:2 D4:1 F4:1 | E4:2 C#4:2',
        },
        U: {
          accords: 'Dm:4 Eb/D:4 Dm:4 C#o/D:4 Dm:4 Eb/D:4 Bb:4 A:4',
          melodie: 'D4:4 | Eb4:4 | F4:2 E4:2 | C#4:4 | D4:2 F4:2 | G4:3 F4:1 | F4:2 D4:2 | E4:2 C#4:2',
        },
      },
      forme: [
        { section: 'T', melodie: 'piano', accomp: 'ostinato', coeur: true },
        { section: 'U', melodie: 'violoncelle', accomp: 'ostinato', coeur: true },
        { section: 'T', melodie: 'piano', accomp: 'ostinato', coeur: true, celloBasse: true },
        { section: 'U', melodie: 'violoncelle', accomp: 'ostinato', coeur: true },
      ],
    },
  ],
};

// ---------------------------------------------------------------------------
// Composition : de la partition aux notes
// ---------------------------------------------------------------------------

/** Vérifie qu'une section tombe juste (mélodie et accords de même longueur, mesures entières). */
export function verifierMorceau(m: Morceau): string[] {
  const erreurs: string[] = [];
  for (const [nom, s] of Object.entries(m.sections)) {
    const acc = lire(s.accords);
    const mel = lire(s.melodie);
    const la = acc.reduce((x, a) => x + a.duree, 0);
    const lm = mel.reduce((x, a) => x + a.duree, 0);
    if (la !== lm) erreurs.push(`${m.nom} / ${nom} : accords ${la} temps, mélodie ${lm} temps`);
    if (la % m.temps) erreurs.push(`${m.nom} / ${nom} : ${la} temps, pas un nombre entier de mesures`);
    for (const a of acc) if (!a.nom || !m.accords[a.nom]) erreurs.push(`${m.nom} / ${nom} : accord inconnu ${a.nom}`);
    for (const n of mel) if (n.nom) midi(n.nom);
  }
  for (const p of m.forme) if (!m.sections[p.section]) erreurs.push(`${m.nom} : section inconnue ${p.section}`);
  return erreurs;
}

/** Note la plus grave jouée (Ré 2) : en dessous, on n'entend qu'un grondement. */
const PLUS_GRAVE = 38;

export function composer(m: Morceau, hasard: () => number = Math.random): SectionJouee[] {
  const b = 60 / m.tempo; // secondes par temps
  const tr = m.transposition ?? 0;
  // Swing : la croche sur la deuxième moitié du temps est jouée aux deux tiers.
  const sw = (p: number) => {
    if (!m.swing) return p;
    const e = Math.floor(p + 1e-9);
    return Math.abs(p - e - 0.5) < 1e-6 ? e + 2 / 3 : p;
  };

  return m.forme.map((partie) => {
    const sec = m.sections[partie.section];
    const accords = lire(sec.accords).map((a) => ({ ...m.accords[a.nom!], pos: a.pos, duree: a.duree }));
    const total = accords.reduce((x, a) => x + a.duree, 0);
    const notes: Note[] = [];
    const ajouter = (instr: Instrument, note: number, pos: number, duree: number, force: number) => {
      const a = sw(pos);
      const z = sw(pos + duree);
      let hauteur = note + tr;
      if (instr === 'piano' || instr === 'pizz' || instr === 'violoncelle') while (hauteur < PLUS_GRAVE) hauteur += 12;
      notes.push({ t: a * b, instr, midi: hauteur, duree: (z - a) * b, force });
    };
    const accordA = (p: number) => accords.find((a) => p >= a.pos - 1e-9 && p < a.pos + a.duree - 1e-9) ?? accords[accords.length - 1];

    // Mélodie.
    if (partie.melodie) {
      const mel = lire(sec.melodie);
      const octave = partie.octave ?? 0;
      for (const n of mel) {
        if (!n.nom) continue;
        const instr = partie.melodie === 'piano' ? 'piano' : 'violoncelle';
        ajouter(instr, midi(n.nom) + 12 * octave, n.pos, n.duree, n.duree >= 2 ? 0.9 : 0.8);
      }
    }

    // Accompagnement.
    switch (partie.accomp) {
      case 'valse': {
        // Basse sur le premier temps de chaque accord, accord plaqué sur les temps suivants.
        const temps = new Set<number>();
        for (let p = 0; p < total; p++) temps.add(p);
        for (const a of accords) temps.add(a.pos);
        for (const p of [...temps].sort((x, y) => x - y)) {
          const a = accordA(p);
          if (Math.abs(p - a.pos) < 1e-9) ajouter('piano', a.basse, p, a.duree, 0.5);
          else for (const v of a.voix) ajouter('piano', v, p, 0.85, 0.3);
        }
        break;
      }
      case 'arpege': {
        // Accord égrené en croches, la pédale tenue jusqu'au bout de l'accord.
        const ordre = [-1, 0, 1, 2, 1, 0];
        for (const a of accords) {
          for (let k = 0; k * 0.5 < a.duree - 1e-9; k++) {
            const i = ordre[k % ordre.length];
            const note = i < 0 ? a.basse : a.voix[Math.min(i, a.voix.length - 1)];
            ajouter('piano', note, a.pos + k * 0.5, a.duree - k * 0.5 + 0.3, i < 0 ? 0.45 : 0.27);
          }
        }
        break;
      }
      case 'tenu':
        for (const [i, a] of accords.entries()) {
          const fin = i === accords.length - 1 ? 2.5 : 0.6;
          ajouter('piano', a.basse, a.pos, a.duree + fin, 0.42);
          for (const v of a.voix) ajouter('piano', v, a.pos, a.duree + fin, 0.3);
        }
        break;
      case 'comp': {
        // Contrebasse sur 1 et 3, piano feutré sur 2 et 4, balais.
        for (const a of accords) {
          const basse = a.basse;
          ajouter('pizz', basse, a.pos, Math.min(2, a.duree) - 0.1, 0.8);
          if (a.duree >= 4) ajouter('pizz', basse + (hasard() < 0.6 ? 7 : 12), a.pos + 2, 1.9, 0.65);
        }
        for (let p = 0; p < total; p++) {
          const a = accordA(p);
          if (p % 2 === 1) {
            const decale = p % 4 === 3 && hasard() < 0.3;
            for (const v of a.voix) ajouter('piano', v, p + (decale ? 0.5 : 0), 0.45, 0.24);
            ajouter('brosse', 0, p, 0.1, 0.8);
          } else ajouter('brosse', 0, p, 0.6, 0.45);
        }
        break;
      }
      case 'ostinato': {
        // Cordes pincées en croches, obstinées ; un accord de piano très doux pour l'harmonie.
        const motif = [0, 0, 7, 0, 12, 0, 7, 0];
        for (const a of accords) {
          for (let k = 0; k * 0.5 < a.duree - 1e-9; k++) ajouter('pizz', a.basse + motif[k % motif.length], a.pos + k * 0.5, 0.42, k % 2 ? 0.45 : 0.7);
          for (const v of a.voix) ajouter('piano', v, a.pos, a.duree, 0.2);
        }
        break;
      }
    }

    if (partie.celloBasse) {
      // Le violoncelle tient la basse (regroupée quand elle ne change pas).
      let debut = 0;
      for (let i = 0; i < accords.length; i++) {
        const a = accords[i];
        const suivant = accords[i + 1];
        if (suivant && suivant.basse === a.basse) continue;
        const note = a.basse + tr < midi('A2') ? a.basse + 12 : a.basse;
        ajouter('violoncelle', note, debut, a.pos + a.duree - debut, 0.45);
        debut = a.pos + a.duree;
      }
    }
    if (partie.coeur) for (let p = 0; p < total; p += 2) ajouter('coeur', 0, p, 0.5, 1);

    // Jeu humain : de petites irrégularités de temps et de nuance.
    for (const n of notes) {
      n.t += hasard() * 0.012;
      n.force *= 0.88 + hasard() * 0.22;
    }
    notes.sort((x, y) => x.t - y.t);
    return { duree: total * b, notes };
  });
}

// ---------------------------------------------------------------------------
// Instruments
// ---------------------------------------------------------------------------

/** Mélange : volume, part envoyée dans la réverbération, place gauche-droite. */
const MIX: Record<Instrument, { niveau: number; echo: number; pan: number }> = {
  piano: { niveau: 1, echo: 0.8, pan: 0.12 },
  violoncelle: { niveau: 1, echo: 1, pan: -0.25 },
  pizz: { niveau: 1, echo: 0.4, pan: -0.15 },
  brosse: { niveau: 1, echo: 0.3, pan: 0.3 },
  coeur: { niveau: 1, echo: 0, pan: 0 },
};

/** Volume d'ensemble de la musique (discrète, derrière l'ambiance). */
const VOLUME = 0.45;

/** Les notes aiguës sont jouées moins fort (au-dessus du La 4). */
const doux = (f: number) => Math.min(1, Math.pow(440 / f, 0.7));

interface Bus {
  c: BaseAudioContext;
  entrees: Record<Instrument, GainNode>;
  bruit: AudioBuffer;
  onde: PeriodicWave;
}

function creerBus(o: SortieMusique): Bus {
  const c = o.c;
  const entrees = {} as Record<Instrument, GainNode>;
  // Toute la musique passe par un filtre doux : aigus coupés, graves un peu plus chauds.
  const coupeAigus = c.createBiquadFilter();
  coupeAigus.type = 'lowpass';
  coupeAigus.frequency.value = 1800;
  coupeAigus.Q.value = 0.5;
  const chaleur = c.createBiquadFilter();
  chaleur.type = 'lowshelf';
  chaleur.frequency.value = 250;
  chaleur.gain.value = 3;
  coupeAigus.connect(chaleur);
  chaleur.connect(o.sortie);
  // L'écho aussi, pour que la réverbération ne rajoute pas d'aigus.
  const echoDoux = c.createBiquadFilter();
  echoDoux.type = 'lowpass';
  echoDoux.frequency.value = 1500;
  echoDoux.Q.value = 0.5;
  echoDoux.connect(o.echo);
  for (const instr of Object.keys(MIX) as Instrument[]) {
    const g = c.createGain();
    g.gain.value = MIX[instr].niveau * VOLUME;
    let sortie: AudioNode = g;
    if (typeof c.createStereoPanner === 'function') {
      const p = c.createStereoPanner();
      p.pan.value = MIX[instr].pan;
      g.connect(p);
      sortie = p;
    }
    sortie.connect(coupeAigus);
    if (MIX[instr].echo > 0) {
      const e = c.createGain();
      e.gain.value = MIX[instr].echo;
      sortie.connect(e).connect(echoDoux);
    }
    entrees[instr] = g;
  }
  // Bruit blanc d'une seconde (marteau du piano, archet, balais).
  const bruit = c.createBuffer(1, c.sampleRate, c.sampleRate);
  const d = bruit.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  // Timbre de corde frappée : harmoniques qui décroissent vite.
  const harmoniques = [0, 1, 0.42, 0.16, 0.07, 0.035, 0.015];
  const onde = c.createPeriodicWave(new Float32Array(harmoniques.length), new Float32Array(harmoniques));
  return { c, entrees, bruit, onde };
}

function souffle(b: Bus, t: number, duree: number, filtre: BiquadFilterType, freq: number, q: number): { src: AudioBufferSourceNode; g: GainNode } {
  const src = b.c.createBufferSource();
  src.buffer = b.bruit;
  src.loop = duree > 0.9;
  const f = b.c.createBiquadFilter();
  f.type = filtre;
  f.frequency.value = freq;
  f.Q.value = q;
  const g = b.c.createGain();
  g.gain.setValueAtTime(0, t);
  src.connect(f).connect(g);
  src.start(t, Math.random() * 0.5);
  src.stop(t + duree);
  return { src, g };
}

/** Piano : attaque du marteau, deux cordes un peu désaccordées, son qui s'assombrit en s'éteignant. */
function piano(b: Bus, t: number, n: Note) {
  const c = b.c;
  const f = frequence(n.midi);
  const pic = 0.15 * n.force * doux(f);
  const fin = t + n.duree;
  const tenue = Math.min(2.6, Math.max(0.5, 1.5 * Math.sqrt(262 / f)));

  const filtre = c.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.Q.value = 0.4;
  filtre.frequency.setValueAtTime(Math.min(3200, f * (2 + 3 * n.force)), t);
  filtre.frequency.setTargetAtTime(Math.min(1800, Math.max(400, f * 1.3)), t + 0.01, 0.5);

  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pic, t + 0.005);
  g.gain.setTargetAtTime(pic * 0.5, t + 0.005, 0.1);
  if (fin > t + 0.25) {
    g.gain.setTargetAtTime(0, t + 0.25, tenue);
    g.gain.setTargetAtTime(0, fin, 0.09); // étouffoir
  } else g.gain.setTargetAtTime(0, Math.max(fin, t + 0.05), 0.09);
  filtre.connect(g).connect(b.entrees.piano);

  for (const desaccord of [-2, 2]) {
    const osc = c.createOscillator();
    osc.setPeriodicWave(b.onde);
    osc.frequency.value = f;
    osc.detune.value = desaccord;
    osc.connect(filtre);
    osc.start(t);
    osc.stop(fin + 0.7);
  }
  // Le marteau qui frappe la corde.
  const m = souffle(b, t, 0.08, 'bandpass', Math.min(2500, f * 2), 0.9);
  m.g.gain.linearRampToValueAtTime(pic * 0.1, t + 0.002);
  m.g.gain.setTargetAtTime(0, t + 0.003, 0.012);
  m.g.connect(b.entrees.piano);
}

/** Violoncelle : coup d'archet progressif, vibrato qui arrive après l'attaque, caisse boisée. */
function violoncelle(b: Bus, t: number, n: Note) {
  const c = b.c;
  const f = frequence(n.midi);
  const pic = 0.11 * n.force * doux(f);
  const fin = t + n.duree;
  const attaque = Math.min(0.35, n.duree * 0.3);

  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(pic * 0.75, t + attaque);
  g.gain.linearRampToValueAtTime(pic, t + Math.max(attaque + 0.01, n.duree * 0.45));
  g.gain.linearRampToValueAtTime(pic * 0.7, fin);
  g.gain.setTargetAtTime(0.0001, fin, 0.15);

  const corps = c.createBiquadFilter();
  corps.type = 'lowpass';
  corps.frequency.value = 1400;
  corps.Q.value = 0.6;
  const caisse = c.createBiquadFilter();
  caisse.type = 'peaking';
  caisse.frequency.value = 290;
  caisse.Q.value = 1.2;
  caisse.gain.value = 5;
  corps.connect(caisse).connect(g).connect(b.entrees.violoncelle);

  const vibrato = c.createOscillator();
  vibrato.frequency.value = 5 + Math.random() * 0.6;
  const profondeur = c.createGain();
  profondeur.gain.setValueAtTime(0, t);
  profondeur.gain.linearRampToValueAtTime(f * 0.005, t + Math.min(0.8, n.duree * 0.5));
  vibrato.connect(profondeur);
  vibrato.start(t);
  vibrato.stop(fin + 1);
  for (const desaccord of [-5, 5]) {
    const osc = c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = f;
    osc.detune.value = desaccord;
    profondeur.connect(osc.frequency);
    osc.connect(corps);
    osc.start(t);
    osc.stop(fin + 1);
  }
  // Frottement de l'archet, surtout à l'attaque.
  const a = souffle(b, t, n.duree + 0.5, 'bandpass', 1700, 1);
  a.g.gain.linearRampToValueAtTime(pic * 0.07, t + attaque * 0.5);
  a.g.gain.setTargetAtTime(pic * 0.015, t + attaque, 0.2);
  a.g.gain.setTargetAtTime(0, fin, 0.1);
  a.g.connect(b.entrees.violoncelle);
}

/** Corde pincée (contrebasse, violoncelle en pizzicato). */
function pizz(b: Bus, t: number, n: Note) {
  const c = b.c;
  const f = frequence(n.midi);
  const pic = 0.2 * n.force;
  const fin = Math.max(t + n.duree, t + 0.1);
  const tenue = Math.min(0.7, Math.max(0.2, 0.5 * Math.pow(110 / f, 0.3)));
  const filtre = c.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.setValueAtTime(Math.min(3000, f * 10), t);
  filtre.frequency.setTargetAtTime(f * 2.5, t + 0.01, 0.15);
  const g = c.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(pic, t + 0.004);
  g.gain.setTargetAtTime(0, t + 0.006, tenue);
  g.gain.setTargetAtTime(0, fin, 0.06);
  filtre.connect(g).connect(b.entrees.pizz);
  for (const [rapport, part, type] of [
    [1, 1, 'triangle'],
    [2, 0.35, 'sine'],
  ] as const) {
    const osc = c.createOscillator();
    osc.type = type;
    osc.frequency.value = f * rapport;
    const p = c.createGain();
    p.gain.value = part;
    osc.connect(p).connect(filtre);
    osc.start(t);
    osc.stop(fin + 0.4);
  }
  const doigt = souffle(b, t, 0.06, 'lowpass', 400, 0.7);
  doigt.g.gain.linearRampToValueAtTime(pic * 0.4, t + 0.002);
  doigt.g.gain.setTargetAtTime(0, t + 0.003, 0.015);
  doigt.g.connect(b.entrees.pizz);
}

/** Balais sur la caisse claire : petite frappe, ou long frottement circulaire. */
function brosse(b: Bus, t: number, n: Note) {
  const long = n.duree > 0.3;
  const s = souffle(b, t, n.duree + 0.4, 'bandpass', long ? 1500 : 1800, 0.7);
  const attaque = long ? 0.12 : 0.008;
  s.g.gain.linearRampToValueAtTime(0.013 * n.force, t + attaque);
  s.g.gain.setTargetAtTime(0, t + attaque, long ? 0.16 : 0.05);
  s.g.connect(b.entrees.brosse);
}

/** Battement sourd, comme un cœur. */
function coeur(b: Bus, t0: number, n: Note) {
  for (const debut of [0, 0.28]) {
    const t = t0 + debut;
    const osc = b.c.createOscillator();
    osc.frequency.setValueAtTime(64, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = b.c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime((debut ? 0.05 : 0.08) * n.force, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.22);
    osc.connect(g).connect(b.entrees.coeur);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}

const INSTRUMENTS: Record<Instrument, (b: Bus, t: number, n: Note) => void> = { piano, violoncelle, pizz, brosse, coeur };

function jouerNote(b: Bus, n: Note, t: number) {
  try {
    INSTRUMENTS[n.instr](b, t, n);
  } catch {
    /* une note ratée n'arrête pas la musique */
  }
}

// ---------------------------------------------------------------------------
// Lecture
// ---------------------------------------------------------------------------

/** Laisse le temps aux minuteurs du navigateur : les notes sont programmées un peu à l'avance. */
const AVANCE = 1.5;
const alea = (min: number, max: number) => min + Math.random() * (max - min);

/** Joue les morceaux les uns après les autres, avec un silence entre deux, tant que la partie dure. */
export function lancerMusique(o: Lecture, affaire: AffaireMusique) {
  const bus = creerBus(o);
  const file: { t: number; n: Note }[] = [];
  const derniers: Partial<Record<string, number>> = {};

  const plusTard = (secondes: number, fn: () => void) => {
    const id = window.setTimeout(
      () => {
        o.minuteurs.delete(id);
        if (o.vivante()) fn();
      },
      Math.max(0, secondes * 1000),
    );
    o.minuteurs.add(id);
  };
  const enMarche = () => !('state' in o.c) || o.c.state === 'running';

  // Programme les notes qui arrivent bientôt.
  const pompe = () => {
    const maintenant = o.c.currentTime;
    while (file.length && file[0].t < maintenant + AVANCE) {
      const x = file.shift()!;
      if (x.t >= maintenant - 0.05) jouerNote(bus, x.n, x.t); // trop tard (onglet en veille) : on saute
    }
    plusTard(0.25, pompe);
  };

  const morceauSuivant = (debut: number) => {
    const tension = o.tension();
    const cle = tension ? 'tension' : affaire;
    const liste = MORCEAUX[cle];
    let i = Math.floor(Math.random() * liste.length);
    if (liste.length > 1 && i === derniers[cle]) i = (i + 1) % liste.length;
    derniers[cle] = i;
    section(composer(liste[i]), 0, debut, tension);
  };

  const section = (sections: SectionJouee[], k: number, debut: number, tension: boolean) => {
    if (!enMarche()) return plusTard(1, () => section(sections, k, o.c.currentTime + 0.5, tension));
    // L'onglet a dormi : on repart de maintenant au lieu de rattraper le retard.
    debut = Math.max(debut, o.c.currentTime + 0.3);
    const fini = k >= sections.length;
    // Les dernières manches arrivent : on change de morceau à la fin de la section en cours.
    if (fini || o.tension() !== tension) {
      const reprise = debut + (fini ? alea(10, 22) : 2);
      return plusTard(reprise - o.c.currentTime - AVANCE, () => morceauSuivant(reprise));
    }
    const s = sections[k];
    for (const n of s.notes) file.push({ t: debut + n.t, n });
    file.sort((x, y) => x.t - y.t);
    const fin = debut + s.duree;
    plusTard(fin - o.c.currentTime - AVANCE - 0.5, () => section(sections, k + 1, fin, tension));
  };

  pompe();
  morceauSuivant(o.c.currentTime + 2);
}

/** Pour les essais (rendu hors ligne) : écrit tout un morceau d'un coup. Retourne sa durée. */
export function ecrireMorceau(o: SortieMusique, m: Morceau, debut = 0.3): number {
  const bus = creerBus(o);
  let t = debut;
  for (const s of composer(m)) {
    for (const n of s.notes) jouerNote(bus, n, t + n.t);
    t += s.duree;
  }
  return t - debut;
}
