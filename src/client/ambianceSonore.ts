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

import { contexteAudio, bruitDe, type CouleurBruit, type ReglageCanal } from './sons';

export type AffaireSonore = 'manoir' | 'train';

interface Reglages {
  /** Interrupteur général des sons (réglage « Sons »). */
  sons: boolean;
  /** Volume général, de 0 à 1. */
  general: number;
  /** Décor sonore (pluie, vent, tonnerre ; vent, vapeur, métal). */
  ambiance: ReglageCanal;
  /** Horloge du manoir, cloche du train, à chaque manche. */
  horloge: ReglageCanal;
  musique: ReglageCanal;
}

interface Session {
  affaire: AffaireSonore;
  c: AudioContext;
  maitre: GainNode;
  ambiance: GainNode;
  horloge: GainNode;
  musique: GainNode;
  /** Écho de l'ambiance et de la musique : suit leur volume (rien quand elles sont coupées). */
  echoAmbiance: GainNode;
  echoMusique: GainNode;
  /** Pluie (manoir) ou neige soufflée (train) : faiblit à l'aube. */
  intemperies: GainNode;
  reverb: ConvolverNode;
  sources: AudioScheduledSourceNode[];
  minuteurs: Set<number>;
  tension: boolean;
}

let reglages: Reglages = {
  sons: true,
  general: 0.8,
  ambiance: { actif: true, volume: 0.5 },
  horloge: { actif: true, volume: 0.5 },
  musique: { actif: true, volume: 0.5 },
};
const niveau = (r: ReglageCanal) => (r.actif ? Math.min(1, Math.max(0, r.volume)) : 0);
let voulue: AffaireSonore | null = null;
let session: Session | null = null;
let tensionVoulue = false;
/** Moment de suspense (accusation) : l'ambiance et la musique se taisent presque. */
let assourdie = false;
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
  assourdie = false;
  tensionVoulue = false;
  aubeVoulue = 0;
  arreter();
}

function actifs() {
  return reglages.sons && reglages.general > 0 && (niveau(reglages.ambiance) > 0 || niveau(reglages.horloge) > 0 || niveau(reglages.musique) > 0);
}

function synchroniser() {
  if (!voulue || !actifs()) return arreter();
  if (!session) session = demarrer(voulue);
  if (!session) return;
  const t = session.c.currentTime;
  const visible = typeof document === 'undefined' || document.visibilityState !== 'hidden';
  // Volumes volontairement bas : l'ambiance reste derrière les bruitages et la lecture.
  session.maitre.gain.setTargetAtTime(visible ? reglages.general * 1.6 * (assourdie ? 0.1 : 1) : 0, t, assourdie ? 0.5 : 1.2);
  session.ambiance.gain.setTargetAtTime(niveau(reglages.ambiance), t, 0.3);
  session.horloge.gain.setTargetAtTime(niveau(reglages.horloge), t, 0.3);
  session.musique.gain.setTargetAtTime(niveau(reglages.musique), t, 0.3);
  session.echoAmbiance.gain.setTargetAtTime(niveau(reglages.ambiance), t, 0.3);
  session.echoMusique.gain.setTargetAtTime(niveau(reglages.musique), t, 0.3);
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

/** Suspense : baisse l'ambiance presque jusqu'au silence (et la remonte ensuite). */
export function assourdir(oui: boolean) {
  assourdie = oui;
  synchroniser();
}

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
  if (!s || !niveau(reglages.horloge)) return;
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
    const horloge = c.createGain();
    const musique = c.createGain();
    const intemperies = c.createGain();
    const reverb = reverberation(c, 2.8);
    const retour = c.createGain();
    retour.gain.value = 0.35;
    reverb.connect(retour).connect(maitre);
    ambiance.connect(maitre);
    horloge.connect(maitre);
    musique.connect(maitre);
    horloge.connect(reverb);
    const echoAmbiance = c.createGain();
    const echoMusique = c.createGain();
    echoAmbiance.connect(reverb);
    echoMusique.connect(reverb);
    intemperies.connect(ambiance);
    const s: Session = { affaire, c, maitre, ambiance, horloge, musique, echoAmbiance, echoMusique, intemperies, reverb, sources: [], minuteurs: new Set(), tension: tensionVoulue };
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
function bruitContinu(
  s: Session,
  sortie: AudioNode,
  filtres: { type: BiquadFilterType; freq: number; q?: number }[],
  gain: number,
  couleur: CouleurBruit = 'rose',
) {
  const src = s.c.createBufferSource();
  src.buffer = bruitDe(s.c, 4, couleur);
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
  // Une rafale sur deux environ : le vent monte nettement, puis retombe.
  repeter(
    s,
    2500,
    6000,
    () => {
      const t = s.c.currentTime;
      const rafale = Math.random() < 0.45;
      v.g.gain.setTargetAtTime(rafale ? alea(gainMax * 0.7, gainMax) : alea(gainMin, gainMin * 2), t, rafale ? alea(0.6, 1.2) : alea(1.5, 2.5));
      v.filtre.frequency.setTargetAtTime(rafale ? alea((freqMin + freqMax) / 2, freqMax) : alea(freqMin, (freqMin + freqMax) / 2), t, alea(0.8, 1.8));
    },
    1500,
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
    g.connect(s.horloge);
    osc.start(t);
    osc.stop(t + o.duree + 0.1);
  }
}

/** Souffle de bruit ponctuel (tonnerre, vapeur). */
function bouffee(
  s: Session,
  o: { filtre: BiquadFilterType; freq: number; q?: number; gain: number; attaque: number; duree: number; reverb?: boolean; couleur?: CouleurBruit; debut?: number },
) {
  const t = s.c.currentTime + (o.debut ?? 0);
  const src = s.c.createBufferSource();
  src.buffer = bruitDe(s.c, 4, o.couleur ?? 'rose');
  const f = s.c.createBiquadFilter();
  f.type = o.filtre;
  f.frequency.value = o.freq;
  f.Q.value = o.q ?? 0.7;
  const g = s.c.createGain();
  enveloppe(g, t, o.gain, o.attaque, o.duree);
  src.connect(f).connect(g).connect(s.ambiance);
  if (o.reverb) g.connect(s.echoAmbiance);
  src.start(t, Math.random());
  src.stop(t + o.duree + 0.1);
}

function decorManoir(s: Session) {
  // Pluie : un souffle doux (bruit rose), sans aigus qui grésillent, et l'averse sur le toit.
  bruitContinu(s, s.intemperies, [{ type: 'highpass', freq: 350 }, { type: 'lowpass', freq: 2400 }], 0.1);
  bruitContinu(s, s.intemperies, [{ type: 'lowpass', freq: 700 }], 0.07, 'brun');
  // Rafales de vent.
  vent(s, 1.2, 0.03, 0.9, 300, 900);
  // Tonnerre : un craquement parfois, puis un long grondement qui roule.
  const tonnerre = () => {
    if (Math.random() < 0.5) bouffee(s, { filtre: 'highpass', freq: 900, gain: 0.18, attaque: 0.02, duree: 0.7, reverb: true });
    bouffee(s, { filtre: 'lowpass', freq: 650, gain: 0.85, attaque: 0.25, duree: alea(4, 6), reverb: true, couleur: 'brun', debut: 0.1 });
    bouffee(s, { filtre: 'lowpass', freq: 450, gain: 0.6, attaque: 0.6, duree: alea(4, 6), couleur: 'brun', debut: alea(1, 2) });
  };
  repeter(s, 30_000, 70_000, tonnerre, alea(8_000, 14_000));
}

function decorTrain(s: Session) {
  // Neige soufflée contre les vitres, très douce.
  bruitContinu(s, s.intemperies, [{ type: 'highpass', freq: 1800 }, { type: 'lowpass', freq: 5000 }], 0.035);
  // Vent de montagne : plus sifflant (filtre étroit).
  vent(s, 3, 0.04, 1, 400, 1200);
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
    () => bouffee(s, { filtre: 'highpass', freq: 1800, gain: 0.22, attaque: 0.35, duree: alea(1.8, 3.2) }),
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
      enveloppe(g, t, 0.1, 0.05, duree);
      osc.connect(f).connect(g);
      g.connect(s.ambiance);
      g.connect(s.echoAmbiance);
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
// (Assez aiguës pour être entendues sur les haut-parleurs d'un téléphone.)
const VIOLONCELLE = [146.83, 174.61, 220, 196, 130.81];
const PIANO = [293.66, 349.23, 440, 523.25, 587.33, 698.46, 392];
const TENSION = [311.13, 277.18, 415.3]; // mi bémol, do dièse, sol dièse : notes qui grincent

function piano(s: Session, freq: number, debut = 0, gain = 0.24) {
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
    g.connect(s.echoMusique);
    osc.start(t);
    osc.stop(t + 4.6);
  }
}

function violoncelle(s: Session, freq: number, duree: number, gain = 0.15) {
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
  f.frequency.value = 1600;
  const g = s.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 1.4);
  g.gain.setValueAtTime(gain, t + duree * 0.6);
  g.gain.exponentialRampToValueAtTime(0.0001, t + duree);
  osc.connect(f).connect(g);
  g.connect(s.musique);
  g.connect(s.echoMusique);
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
    if (Math.random() < 0.4) piano(s, PIANO[Math.floor(Math.random() * PIANO.length)], alea(0.6, 1.4), 0.16);
  };
  // Rythme lent, plus serré quand la tension monte. La première phrase vient vite.
  let premiere = true;
  const suite = () => {
    const id = window.setTimeout(
      () => {
        s.minuteurs.delete(id);
        if (session !== s) return;
        phrase();
        suite();
      },
      premiere ? ((premiere = false), 1500) : s.tension ? alea(2800, 4500) : alea(5000, 8500),
    );
    s.minuteurs.add(id);
  };
  suite();
  repeter(s, 1150, 1250, () => s.tension && battement(s), 1200);
}
