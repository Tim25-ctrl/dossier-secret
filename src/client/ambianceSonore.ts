// Ambiance sonore et musique de la partie, synthétisées dans le navigateur (Web Audio) comme les
// bruitages : aucun fichier, aucun droit d'auteur.
//
// - Manoir : pluie continue, rafales de vent, tonnerre lointain ; l'horloge sonne à chaque manche.
// - Train (immobilisé par l'avalanche, donc sans roulement) : vent de montagne, craquements du
//   métal, souffle de vapeur de la locomotive à l'arrêt ; la cloche du valet à chaque manche.
// - Musique : notes lentes et graves (piano, violoncelle), plus tendue dans les dernières manches.
//
// RÈGLE (comme pour les bruitages) : rien ne réagit à une information propre au complice. La
// tension de la musique ne dépend que de la manche, que tout le monde voit.

import { contexteAudio, bruitDe } from './sons';

export type AffaireSonore = 'manoir' | 'train';

interface Reglages {
  /** Interrupteur général des sons (réglage « Sons »). */
  sons: boolean;
  ambiance: boolean;
  musique: boolean;
  /** Volume commun de l'ambiance et de la musique, de 0 à 1. */
  volume: number;
}

interface Session {
  affaire: AffaireSonore;
  c: AudioContext;
  maitre: GainNode;
  ambiance: GainNode;
  musique: GainNode;
  /** Pluie (manoir) ou neige soufflée (train) : faiblit à l'aube. */
  intemperies: GainNode;
  reverb: ConvolverNode;
  sources: AudioScheduledSourceNode[];
  minuteurs: Set<number>;
  tension: boolean;
}

let reglages: Reglages = { sons: true, ambiance: true, musique: true, volume: 0.5 };
let voulue: AffaireSonore | null = null;
let session: Session | null = null;
let tensionVoulue = false;
let aubeVoulue = 0;

const alea = (min: number, max: number) => min + Math.random() * (max - min);

// ---------------------------------------------------------------------------
// Réglages et cycle de vie
// ---------------------------------------------------------------------------

export function reglerAmbiance(r: Reglages) {
  reglages = r;
  synchroniser();
}

/** À l'ouverture de la partie. */
export function demarrerAmbiance(affaire: AffaireSonore) {
  if (voulue !== affaire) arreter();
  voulue = affaire;
  synchroniser();
}

/** En quittant la partie. */
export function arreterAmbiance() {
  voulue = null;
  tensionVoulue = false;
  aubeVoulue = 0;
  arreter();
}

function actifs() {
  return reglages.sons && reglages.volume > 0 && (reglages.ambiance || reglages.musique);
}

function synchroniser() {
  if (!voulue || !actifs()) return arreter();
  if (!session) session = demarrer(voulue);
  if (!session) return;
  const t = session.c.currentTime;
  const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  // Volumes volontairement bas : l'ambiance reste derrière les bruitages et la lecture.
  session.maitre.gain.setTargetAtTime(visible ? reglages.volume * 1.6 : 0, t, 0.4);
  session.ambiance.gain.setTargetAtTime(reglages.ambiance ? 1 : 0, t, 0.4);
  session.musique.gain.setTargetAtTime(reglages.musique ? 0.8 : 0, t, 0.4);
  session.intemperies.gain.setTargetAtTime(1 - 0.7 * aubeVoulue, t, 3);
  session.tension = tensionVoulue;
}

function arreter() {
  const s = session;
  session = null;
  if (!s) return;
  for (const id of s.minuteurs) clearTimeout(id);
  const t = s.c.currentTime;
  s.maitre.gain.setTargetAtTime(0, t, 0.3);
  setTimeout(() => {
    for (const src of s.sources) {
      try {
        src.stop();
      } catch {
        /* déjà arrêtée */
      }
    }
    s.maitre.disconnect();
  }, 1500);
}

if (typeof document !== 'undefined') document.addEventListener('visibilitychange', synchroniser);

/** Dernières manches : musique plus tendue. */
export function definirTension(tension: boolean) {
  tensionVoulue = tension;
  if (session) session.tension = tension;
}

/** 0 = pleine nuit, 1 = aube : la pluie ou la neige faiblit. */
export function definirAube(aube: number) {
  aubeVoulue = Math.min(1, Math.max(0, aube));
  synchroniser();
}

/** Nouvelle manche : l'horloge du manoir sonne (3 coups à l'heure pile, 1 à la demie) ou la cloche du valet. */
export function sonnerManche(heurePile: boolean) {
  const s = session;
  if (!s || !reglages.ambiance) return;
  if (s.affaire === 'manoir') {
    const coups = heurePile ? 3 : 1;
    for (let i = 0; i < coups; i++) cloche(s, { base: 196, debut: i * 2.2, duree: 5, gain: 0.22 });
  } else {
    for (let i = 0; i < 3; i++) cloche(s, { base: 1180, debut: i * 0.28, duree: 1.3, gain: 0.07 });
  }
}

// ---------------------------------------------------------------------------
// Construction
// ---------------------------------------------------------------------------

function reverberation(c: AudioContext, duree: number): ConvolverNode {
  const n = Math.floor(c.sampleRate * duree);
  const ir = c.createBuffer(2, n, c.sampleRate);
  for (let canal = 0; canal < 2; canal++) {
    const d = ir.getChannelData(canal);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / n, 3);
  }
  const r = c.createConvolver();
  r.buffer = ir;
  return r;
}

function demarrer(affaire: AffaireSonore): Session | null {
  const c = contexteAudio();
  if (!c) return null;
  try {
    const maitre = c.createGain();
    maitre.gain.value = 0;
    maitre.connect(c.destination);
    const ambiance = c.createGain();
    const musique = c.createGain();
    const intemperies = c.createGain();
    const reverb = reverberation(c, 2.8);
    const retour = c.createGain();
    retour.gain.value = 0.35;
    reverb.connect(retour).connect(maitre);
    ambiance.connect(maitre);
    musique.connect(maitre);
    intemperies.connect(ambiance);
    const s: Session = { affaire, c, maitre, ambiance, musique, intemperies, reverb, sources: [], minuteurs: new Set(), tension: tensionVoulue };
    if (affaire === 'manoir') decorManoir(s);
    else decorTrain(s);
    lancerMusique(s);
    return s;
  } catch {
    return null; // l'ambiance n'est jamais indispensable
  }
}

/** Répète `fn` à intervalles aléatoires tant que la session est active. */
function repeter(s: Session, min: number, max: number, fn: () => void, premier = alea(min, max)) {
  const id = window.setTimeout(() => {
    s.minuteurs.delete(id);
    if (session !== s) return;
    try {
      fn();
    } catch {
      /* rien */
    }
    repeter(s, min, max, fn);
  }, premier);
  s.minuteurs.add(id);
}

/** Bruit continu filtré (pluie, vent, neige) : retourne le gain et le dernier filtre, pour les moduler. */
function bruitContinu(s: Session, sortie: AudioNode, filtres: { type: BiquadFilterType; freq: number; q?: number }[], gain: number) {
  const src = s.c.createBufferSource();
  src.buffer = bruitDe(s.c, 3);
  src.loop = true;
  let noeud: AudioNode = src;
  const fs = filtres.map((f) => {
    const b = s.c.createBiquadFilter();
    b.type = f.type;
    b.frequency.value = f.freq;
    b.Q.value = f.q ?? 0.7;
    noeud.connect(b);
    noeud = b;
    return b;
  });
  const g = s.c.createGain();
  g.gain.value = gain;
  noeud.connect(g).connect(sortie);
  src.start(s.c.currentTime, Math.random() * 2);
  s.sources.push(src);
  return { g, filtre: fs[fs.length - 1] };
}

/** Rafales : le vent forcit et faiblit au hasard. */
function vent(s: Session, q: number, gainMin: number, gainMax: number, freqMin: number, freqMax: number) {
  const v = bruitContinu(s, s.ambiance, [{ type: 'bandpass', freq: (freqMin + freqMax) / 2, q }], gainMin);
  repeter(
    s,
    2500,
    7000,
    () => {
      const t = s.c.currentTime;
      v.g.gain.setTargetAtTime(alea(gainMin, gainMax), t, alea(0.8, 2.2));
      v.filtre.frequency.setTargetAtTime(alea(freqMin, freqMax), t, alea(1, 2.5));
    },
    200,
  );
}

function enveloppe(g: GainNode, t: number, pic: number, attaque: number, duree: number) {
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(pic, t + attaque);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
}

/** Cloche : partiels inharmoniques qui s'éteignent lentement, avec un peu d'écho. */
function cloche(s: Session, o: { base: number; debut: number; duree: number; gain: number }) {
  const t = s.c.currentTime + o.debut;
  for (const [rapport, part] of [
    [0.5, 0.5],
    [1, 1],
    [1.19, 0.45],
    [1.5, 0.35],
    [2, 0.3],
    [2.74, 0.15],
  ] as const) {
    const osc = s.c.createOscillator();
    const g = s.c.createGain();
    osc.frequency.value = o.base * rapport;
    enveloppe(g, t, o.gain * part, 0.006, o.duree * (1.2 - rapport * 0.15));
    osc.connect(g);
    g.connect(s.ambiance);
    g.connect(s.reverb);
    osc.start(t);
    osc.stop(t + o.duree + 0.1);
  }
}

/** Souffle de bruit ponctuel (tonnerre, vapeur). */
function bouffee(s: Session, o: { filtre: BiquadFilterType; freq: number; q?: number; gain: number; attaque: number; duree: number; reverb?: boolean }) {
  const t = s.c.currentTime;
  const src = s.c.createBufferSource();
  src.buffer = bruitDe(s.c, 3);
  const f = s.c.createBiquadFilter();
  f.type = o.filtre;
  f.frequency.value = o.freq;
  f.Q.value = o.q ?? 0.7;
  const g = s.c.createGain();
  enveloppe(g, t, o.gain, o.attaque, o.duree);
  src.connect(f).connect(g).connect(s.ambiance);
  if (o.reverb) g.connect(s.reverb);
  src.start(t, Math.random());
  src.stop(t + o.duree + 0.1);
}

function decorManoir(s: Session) {
  // Pluie : chuintement aigu + grondement sur le toit.
  bruitContinu(s, s.intemperies, [{ type: 'highpass', freq: 1500 }, { type: 'lowpass', freq: 6500 }], 0.07);
  bruitContinu(s, s.intemperies, [{ type: 'lowpass', freq: 420 }], 0.05);
  // Gouttes sur la vitre.
  repeter(s, 90, 420, () => {
    const t = s.c.currentTime;
    const osc = s.c.createOscillator();
    const g = s.c.createGain();
    osc.frequency.setValueAtTime(alea(2200, 4200), t);
    osc.frequency.exponentialRampToValueAtTime(alea(900, 1600), t + 0.03);
    enveloppe(g, t, alea(0.004, 0.012), 0.002, 0.05);
    osc.connect(g).connect(s.intemperies);
    osc.start(t);
    osc.stop(t + 0.08);
  });
  vent(s, 0.9, 0.01, 0.07, 280, 750);
  // Tonnerre lointain, de temps en temps.
  repeter(
    s,
    40_000,
    95_000,
    () => {
      bouffee(s, { filtre: 'lowpass', freq: 160, q: 0.5, gain: 0.32, attaque: 0.4, duree: alea(4, 7), reverb: true });
      bouffee(s, { filtre: 'lowpass', freq: 90, q: 0.5, gain: 0.25, attaque: 1.2, duree: alea(5, 8) });
    },
    alea(15_000, 30_000),
  );
}

function decorTrain(s: Session) {
  // Neige soufflée contre les vitres, très douce.
  bruitContinu(s, s.intemperies, [{ type: 'highpass', freq: 3500 }], 0.025);
  // Vent de montagne : plus sifflant (filtre étroit).
  vent(s, 4, 0.015, 0.09, 350, 1100);
  // Chaudière de la locomotive, maintenue en chauffe : un ronronnement grave.
  for (const [f, gain] of [
    [47, 0.035],
    [94, 0.012],
  ] as const) {
    const osc = s.c.createOscillator();
    const g = s.c.createGain();
    osc.frequency.value = f;
    g.gain.value = gain;
    osc.connect(g).connect(s.ambiance);
    osc.start();
    s.sources.push(osc);
  }
  // Souffle de vapeur.
  repeter(
    s,
    22_000,
    55_000,
    () => bouffee(s, { filtre: 'highpass', freq: 2600, gain: 0.06, attaque: 0.35, duree: alea(1.8, 3.2) }),
    alea(6_000, 15_000),
  );
  // Craquements du métal qui refroidit.
  repeter(
    s,
    12_000,
    32_000,
    () => {
      const t = s.c.currentTime;
      const duree = alea(0.5, 1.2);
      const osc = s.c.createOscillator();
      osc.type = 'sawtooth';
      const base = alea(85, 160);
      osc.frequency.setValueAtTime(base, t);
      for (let k = 1; k <= 6; k++) osc.frequency.linearRampToValueAtTime(base * alea(0.85, 1.25), t + (duree * k) / 6);
      const f = s.c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = alea(450, 900);
      f.Q.value = 6;
      const g = s.c.createGain();
      enveloppe(g, t, 0.05, 0.05, duree);
      osc.connect(f).connect(g);
      g.connect(s.ambiance);
      g.connect(s.reverb);
      osc.start(t);
      osc.stop(t + duree + 0.1);
    },
    alea(4_000, 10_000),
  );
}

// ---------------------------------------------------------------------------
// Musique
// ---------------------------------------------------------------------------

// Ré mineur : graves pour le violoncelle, médiums pour le piano.
const VIOLONCELLE = [73.42, 87.31, 110, 130.81, 98];
const PIANO = [293.66, 349.23, 440, 523.25, 587.33, 349.23, 392];
const TENSION = [311.13, 277.18, 415.3]; // mi bémol, do dièse, sol dièse : notes qui grincent

function piano(s: Session, freq: number, debut = 0, gain = 0.05) {
  const t = s.c.currentTime + debut;
  for (const [rapport, part, type] of [
    [1, 1, 'triangle'],
    [2, 0.25, 'sine'],
    [3, 0.08, 'sine'],
  ] as const) {
    const osc = s.c.createOscillator();
    osc.type = type;
    osc.frequency.value = freq * rapport;
    const g = s.c.createGain();
    enveloppe(g, t, gain * part, 0.01, 4.5 / rapport);
    osc.connect(g);
    g.connect(s.musique);
    g.connect(s.reverb);
    osc.start(t);
    osc.stop(t + 4.6);
  }
}

function violoncelle(s: Session, freq: number, duree: number, gain = 0.035) {
  const t = s.c.currentTime;
  const osc = s.c.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = freq;
  const vibrato = s.c.createOscillator();
  vibrato.frequency.value = 5;
  const profondeur = s.c.createGain();
  profondeur.gain.value = freq * 0.006;
  vibrato.connect(profondeur).connect(osc.frequency);
  const f = s.c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = 650;
  const g = s.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 1.4);
  g.gain.setValueAtTime(gain, t + duree * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  osc.connect(f).connect(g);
  g.connect(s.musique);
  g.connect(s.reverb);
  osc.start(t);
  vibrato.start(t);
  osc.stop(t + duree + 0.1);
  vibrato.stop(t + duree + 0.1);
}

/** Battement sourd, comme un cœur (dernières manches). */
function battement(s: Session) {
  for (const debut of [0, 0.28]) {
    const t = s.c.currentTime + debut;
    const osc = s.c.createOscillator();
    osc.frequency.setValueAtTime(62, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.18);
    const g = s.c.createGain();
    enveloppe(g, t, debut ? 0.05 : 0.08, 0.01, 0.22);
    osc.connect(g).connect(s.musique);
    osc.start(t);
    osc.stop(t + 0.3);
  }
}

function lancerMusique(s: Session) {
  let n = 0;
  const phrase = () => {
    n++;
    if (n % 3 === 1) violoncelle(s, VIOLONCELLE[Math.floor(Math.random() * VIOLONCELLE.length)], alea(7, 10));
    const notes = s.tension && Math.random() < 0.5 ? TENSION : PIANO;
    piano(s, notes[Math.floor(Math.random() * notes.length)]);
    if (Math.random() < 0.4) piano(s, PIANO[Math.floor(Math.random() * PIANO.length)], alea(0.6, 1.4), 0.035);
  };
  // Rythme lent, plus serré quand la tension monte.
  const suite = () => {
    const id = window.setTimeout(
      () => {
        s.minuteurs.delete(id);
        if (session !== s) return;
        phrase();
        suite();
      },
      s.tension ? alea(2800, 4500) : alea(5500, 9500),
    );
    s.minuteurs.add(id);
  };
  suite();
  repeter(s, 1150, 1250, () => s.tension && battement(s), 1200);
}
