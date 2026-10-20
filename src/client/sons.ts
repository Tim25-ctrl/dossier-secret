// Bruitages du jeu, synthétisés dans le navigateur (Web Audio) : aucun fichier à télécharger,
// aucun droit d'auteur. Les navigateurs n'autorisent le son qu'après un geste de l'utilisateur :
// le contexte audio est (ré)activé au premier clic ou toucher.
//
// RÈGLE : aucun son ne doit trahir le complice. Seuls des événements publics, ou vécus de la même
// façon par tous les joueurs (être interrogé, voir une carte, ouvrir un dossier), font du bruit.

export type Son = 'tour' | 'interrogation' | 'carte' | 'hypothese' | 'dossier' | 'empreinte' | 'demasque' | 'victoire' | 'defaite';

let ctx: AudioContext | null = null;
let actif = true;
let volume = 0.6;
let bruitBlanc: AudioBuffer | null = null;

export function reglerSons(sonActif: boolean, vol: number) {
  actif = sonActif;
  volume = Math.min(1, Math.max(0, vol));
}

function contexte(): AudioContext | null {
  if (!actif || volume <= 0) return null;
  try {
    ctx ??= new AudioContext();
  } catch {
    return null; // navigateur sans Web Audio
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

if (typeof window !== 'undefined') {
  const debloquer = () => {
    if (actif && ctx?.state !== 'running') contexte();
  };
  window.addEventListener('pointerdown', debloquer, { passive: true });
  window.addEventListener('keydown', debloquer);
}

function bruit(c: AudioContext): AudioBuffer {
  if (!bruitBlanc) {
    bruitBlanc = c.createBuffer(1, c.sampleRate, c.sampleRate);
    const d = bruitBlanc.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  return bruitBlanc;
}

interface Note {
  freq: number;
  debut?: number;
  duree: number;
  type?: OscillatorType;
  gain?: number;
  attaque?: number;
  freqFin?: number;
}

function note(c: AudioContext, sortie: AudioNode, n: Note) {
  const t = c.currentTime + (n.debut ?? 0);
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = n.type ?? 'sine';
  o.frequency.setValueAtTime(n.freq, t);
  if (n.freqFin) o.frequency.exponentialRampToValueAtTime(n.freqFin, t + n.duree);
  const attaque = n.attaque ?? 0.005;
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(n.gain ?? 0.3, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + n.duree);
  o.connect(g).connect(sortie);
  o.start(t);
  o.stop(t + n.duree + 0.05);
}

interface Souffle {
  debut?: number;
  duree: number;
  filtre: BiquadFilterType;
  freq: number;
  freqFin?: number;
  q?: number;
  gain?: number;
  attaque?: number;
}

function souffle(c: AudioContext, sortie: AudioNode, s: Souffle) {
  const t = c.currentTime + (s.debut ?? 0);
  const src = c.createBufferSource();
  src.buffer = bruit(c);
  const f = c.createBiquadFilter();
  f.type = s.filtre;
  f.frequency.setValueAtTime(s.freq, t);
  if (s.freqFin) f.frequency.exponentialRampToValueAtTime(s.freqFin, t + s.duree);
  f.Q.value = s.q ?? 1;
  const g = c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(s.gain ?? 0.3, t + (s.attaque ?? 0.005));
  g.gain.exponentialRampToValueAtTime(0.0001, t + s.duree);
  src.connect(f).connect(g).connect(sortie);
  src.start(t, Math.random() * 0.5);
  src.stop(t + s.duree + 0.05);
}

const RECETTES: Record<Son, (c: AudioContext, s: AudioNode) => void> = {
  // Petite cloche de réception : deux frappes claires.
  tour: (c, s) => {
    for (const [debut, base] of [
      [0, 1046.5],
      [0.18, 1318.5],
    ] as const) {
      note(c, s, { freq: base, debut, duree: 1.1, gain: 0.22 });
      note(c, s, { freq: base * 2.76, debut, duree: 0.5, gain: 0.05 });
    }
  },
  // Deux coups frappés à la porte.
  interrogation: (c, s) => {
    for (const debut of [0, 0.2]) {
      note(c, s, { freq: 140, freqFin: 70, debut, duree: 0.14, gain: 0.5 });
      souffle(c, s, { debut, duree: 0.06, filtre: 'bandpass', freq: 900, q: 2, gain: 0.25 });
    }
  },
  // Une carte qu'on fait glisser sur la table.
  carte: (c, s) => {
    souffle(c, s, { duree: 0.32, filtre: 'bandpass', freq: 1800, freqFin: 4200, q: 0.8, gain: 0.22, attaque: 0.04 });
    souffle(c, s, { debut: 0.28, duree: 0.05, filtre: 'highpass', freq: 3000, gain: 0.12 });
  },
  // Coup de tampon du greffier.
  hypothese: (c, s) => {
    note(c, s, { freq: 110, freqFin: 45, duree: 0.25, gain: 0.6 });
    souffle(c, s, { duree: 0.08, filtre: 'lowpass', freq: 1200, gain: 0.35 });
  },
  // Sceau de cire qui casse, puis papier qu'on déplie.
  dossier: (c, s) => {
    souffle(c, s, { duree: 0.05, filtre: 'highpass', freq: 2500, gain: 0.4 });
    souffle(c, s, { debut: 0.04, duree: 0.04, filtre: 'highpass', freq: 3500, gain: 0.25 });
    souffle(c, s, { debut: 0.12, duree: 0.45, filtre: 'bandpass', freq: 2500, freqFin: 1200, q: 0.7, gain: 0.15, attaque: 0.06 });
  },
  // « Ding » de loupe : une note de verre.
  empreinte: (c, s) => {
    note(c, s, { freq: 1567.98, duree: 1.4, gain: 0.18 });
    note(c, s, { freq: 2093, debut: 0.08, duree: 1.2, gain: 0.12 });
    note(c, s, { freq: 3135.96, debut: 0.16, duree: 0.8, gain: 0.05 });
  },
  // Accord dramatique (ré mineur) sur un coup sourd.
  demasque: (c, s) => {
    note(c, s, { freq: 73.4, freqFin: 50, duree: 0.6, gain: 0.5 });
    for (const f of [146.83, 174.61, 220, 293.66]) note(c, s, { freq: f, duree: 1.8, type: 'sawtooth', gain: 0.05, attaque: 0.08 });
  },
  // Petite fanfare montante.
  victoire: (c, s) => {
    [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => note(c, s, { freq: f, debut: i * 0.13, duree: i === 3 ? 1.2 : 0.3, type: 'triangle', gain: 0.25 }));
  },
  // Descente mineure, lente.
  defaite: (c, s) => {
    [392, 311.13, 261.63].forEach((f, i) => note(c, s, { freq: f, debut: i * 0.3, duree: i === 2 ? 1.4 : 0.45, type: 'triangle', gain: 0.22 }));
  },
};

/** Joue un bruitage (sans effet si le son est coupé ou indisponible). */
export function jouer(son: Son) {
  const c = contexte();
  if (!c) return;
  try {
    const sortie = c.createGain();
    sortie.gain.value = volume;
    sortie.connect(c.destination);
    RECETTES[son](c, sortie);
  } catch {
    /* le son n'est jamais indispensable */
  }
}
