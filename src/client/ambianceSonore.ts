// Ambiance sonore et musique de la partie, synthétisées dans le navigateur (Web Audio) comme les
// bruitages : aucun fichier, aucun droit d'auteur.
//
// - Manoir : pluie continue, rafales de vent, tonnerre lointain ; l'horloge sonne à chaque manche.
// - Train (immobilisé par l'avalanche, donc sans roulement) : vent de montagne, craquements du
//   métal, souffle de vapeur de la locomotive à l'arrêt ; la cloche du valet à chaque manche.
// - Paquebot (machines coupées dans le brouillard) : houle lente contre la coque, clapotis, coque qui
//   craque, et parfois la corne de brume d'un autre navire au loin ; la corne de brume de l'Aurélia
//   sonne à chaque manche.
// - Musique : de vrais petits morceaux (voir musique.ts), plus tendus dans les dernières manches.
//
// RÈGLE (comme pour les bruitages) : rien ne réagit à une information propre au complice. La
// tension de la musique ne dépend que de la manche, que tout le monde voit.

import { intensiteMeteo } from './meteo';
import { lancerMusique } from './musique';
import { contexteAudio, bruitDe, type CouleurBruit, type ReglageCanal } from './sons';

/** « menu » : accueil et salon d'attente (musique seule, sans décor sonore). */
export type AffaireSonore = 'manoir' | 'train' | 'paquebot' | 'menu';

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

/** En quittant la partie (ou l'accueil : `seulement` évite de couper la musique d'un autre écran). */
export function arreterAmbiance(seulement?: AffaireSonore) {
  if (seulement && voulue !== seulement) return;
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
  session.intemperies.gain.setTargetAtTime(niveauIntemperies(), t, 3);
  session.tension = tensionVoulue;
}

/** Pluie ou neige : par averses (comme à l'écran), et plus faible à l'aube. */
function niveauIntemperies() {
  return (1 - 0.7 * aubeVoulue) * intensiteMeteo();
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

/**
 * Nouvelle manche (`minutes` : l'heure de la nuit, en minutes depuis minuit). L'horloge du manoir
 * sonne (3 coups à l'heure pile, 1 à la demie), la cloche du valet tinte dans le train, la corne de
 * brume du paquebot mugit (deux longs coups à l'heure pile, un à la demie).
 */
export function sonnerManche(minutes: number) {
  const s = session;
  if (!s || !niveau(reglages.horloge)) return;
  const heurePile = minutes % 60 === 0;
  if (s.affaire === 'paquebot') {
    for (let i = 0; i < (heurePile ? 2 : 1); i++) corneDeBrume(s, { debut: i * 4.2, duree: 3, gain: 0.32, sortie: s.horloge });
  } else if (s.affaire === 'manoir') {
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
    intemperies.gain.value = niveauIntemperies();
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
    // L'averse arrive et repart en même temps que les gouttes à l'écran.
    repeter(s, 1000, 1000, () => s.intemperies.gain.setTargetAtTime(niveauIntemperies(), s.c.currentTime, 1.5), 1000);
    if (affaire === 'manoir') decorManoir(s);
    else if (affaire === 'paquebot') decorPaquebot(s);
    else if (affaire === 'train') decorTrain(s);
    lancerMusique(
      { c, sortie: musique, echo: echoMusique, vivante: () => session === s, tension: () => s.tension, minuteurs: s.minuteurs },
      affaire,
    );
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

/** Vent : un souffle très léger, et de temps en temps seulement une rafale qui monte puis retombe. */
function vent(s: Session, q: number, gainMin: number, gainMax: number, freqMin: number, freqMax: number) {
  const milieu = (freqMin + freqMax) / 2;
  const v = bruitContinu(s, s.ambiance, [{ type: 'bandpass', freq: milieu, q }], gainMin);
  repeter(
    s,
    40_000,
    90_000,
    () => {
      const t = s.c.currentTime;
      const duree = alea(3, 6);
      v.g.gain.setTargetAtTime(alea(gainMax * 0.6, gainMax), t, alea(0.8, 1.4));
      v.filtre.frequency.setTargetAtTime(alea(milieu, freqMax), t, alea(0.8, 1.6));
      v.g.gain.setTargetAtTime(gainMin, t + duree, alea(1.5, 2.5));
      v.filtre.frequency.setTargetAtTime(alea(freqMin, milieu), t + duree, 2);
    },
    alea(15_000, 30_000),
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
  vent(s, 1.2, 0.015, 0.45, 300, 900);
  // Tonnerre (seulement pendant une averse) : un craquement parfois, puis un long grondement.
  const tonnerre = () => {
    if (intensiteMeteo() < 0.4) return;
    if (Math.random() < 0.5) bouffee(s, { filtre: 'highpass', freq: 900, gain: 0.18, attaque: 0.02, duree: 0.7, reverb: true });
    bouffee(s, { filtre: 'lowpass', freq: 650, gain: 0.85, attaque: 0.25, duree: alea(4, 6), reverb: true, couleur: 'brun', debut: 0.1 });
    bouffee(s, { filtre: 'lowpass', freq: 450, gain: 0.6, attaque: 0.6, duree: alea(4, 6), couleur: 'brun', debut: alea(1, 2) });
  };
  repeter(s, 70_000, 150_000, tonnerre, alea(30_000, 60_000));
}

function decorTrain(s: Session) {
  // Neige soufflée contre les vitres, très douce.
  bruitContinu(s, s.intemperies, [{ type: 'highpass', freq: 1800 }, { type: 'lowpass', freq: 5000 }], 0.035);
  // Vent de montagne : plus sifflant (filtre étroit).
  vent(s, 3, 0.02, 0.5, 400, 1200);
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
    70_000,
    150_000,
    () => bouffee(s, { filtre: 'highpass', freq: 1800, gain: 0.18, attaque: 0.35, duree: alea(1.8, 3.2) }),
    alea(25_000, 50_000),
  );
  // Craquements du métal qui refroidit.
  repeter(
    s,
    50_000,
    120_000,
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
    alea(30_000, 60_000),
  );
}

/** Corne de brume : un son grave et rauque, long, qui se perd dans le brouillard. */
function corneDeBrume(s: Session, o: { debut: number; duree: number; gain: number; sortie: GainNode; grave?: number }) {
  const t = s.c.currentTime + o.debut;
  const base = o.grave ?? 98;
  const filtre = s.c.createBiquadFilter();
  filtre.type = 'lowpass';
  filtre.frequency.value = 650;
  filtre.Q.value = 0.8;
  const g = s.c.createGain();
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(o.gain, t + 0.35);
  g.gain.setValueAtTime(o.gain, t + o.duree);
  g.gain.exponentialRampToValueAtTime(0.0001, t + o.duree + 1.2);
  filtre.connect(g);
  g.connect(o.sortie);
  g.connect(s.reverb);
  for (const [rapport, part] of [
    [1, 1],
    [1.5, 0.6],
    [2, 0.25],
  ] as const) {
    const osc = s.c.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(base * rapport * 0.97, t);
    osc.frequency.linearRampToValueAtTime(base * rapport, t + 0.3);
    const p = s.c.createGain();
    p.gain.value = part * 0.5;
    osc.connect(p).connect(filtre);
    osc.start(t);
    osc.stop(t + o.duree + 1.4);
  }
}

function decorPaquebot(s: Session) {
  // Houle lente contre la coque : un grondement sourd qui enfle et retombe (machines coupées).
  const houle = bruitContinu(s, s.ambiance, [{ type: 'lowpass', freq: 380 }], 0.09, 'brun');
  const lfo = s.c.createOscillator();
  lfo.frequency.value = 0.09;
  const ampleur = s.c.createGain();
  ampleur.gain.value = 0.06;
  lfo.connect(ampleur).connect(houle.g.gain);
  lfo.start();
  s.sources.push(lfo);
  // Clapotis contre la coque : suit le brouillard (comme la pluie au manoir).
  bruitContinu(s, s.intemperies, [{ type: 'bandpass', freq: 700, q: 0.9 }], 0.035);
  // La coque qui craque, de temps en temps.
  repeter(
    s,
    50_000,
    120_000,
    () => {
      const t = s.c.currentTime;
      const duree = alea(0.8, 1.6);
      const osc = s.c.createOscillator();
      osc.type = 'sawtooth';
      const base = alea(60, 110);
      osc.frequency.setValueAtTime(base, t);
      for (let k = 1; k <= 5; k++) osc.frequency.linearRampToValueAtTime(base * alea(0.9, 1.15), t + (duree * k) / 5);
      const f = s.c.createBiquadFilter();
      f.type = 'bandpass';
      f.frequency.value = alea(300, 600);
      f.Q.value = 5;
      const g = s.c.createGain();
      enveloppe(g, t, 0.08, 0.1, duree);
      osc.connect(f).connect(g);
      g.connect(s.ambiance);
      g.connect(s.echoAmbiance);
      osc.start(t);
      osc.stop(t + duree + 0.1);
    },
    alea(30_000, 60_000),
  );
  // Au loin, un autre navire répond dans le brouillard (seulement quand il est épais).
  repeter(
    s,
    100_000,
    200_000,
    () => {
      if (intensiteMeteo() < 0.4) return;
      corneDeBrume(s, { debut: 0, duree: 2.4, gain: 0.08, sortie: s.ambiance, grave: 82 });
    },
    alea(40_000, 80_000),
  );
}
