// Simulations d'équilibrage : npm run simulate [-- --parties 400] [-- --variante 0] [-- --affaire train]
//
// ATTENTION : les bots sont des approximations grossières de joueurs humains
// (ils ne discutent pas, ne bluffent pas en dehors des pouvoirs, ne soupçonnent
// personne en dehors des empreintes). Les pourcentages donnent une TENDANCE,
// pas une mesure fiable.

import { simulerPartie } from '../src/bots/simulation';
import { PROFIL_OCCASIONNEL, PROFIL_PAR_DEFAUT, type ProfilBot } from '../src/bots/bot';
import { CONFIG_PAR_DEFAUT, REGLES_INITIALES, type ConfigPartie } from '../src/engine/config';

const argParties = process.argv.indexOf('--parties');
const N = argParties > 0 ? Number(process.argv[argParties + 1]) : 300;
const argAffaire = process.argv.indexOf('--affaire');
const AFFAIRE: Partial<ConfigPartie> = argAffaire > 0 ? { affaire: process.argv[argAffaire + 1] as ConfigPartie['affaire'] } : {};

interface Stat {
  victoiresEnqueteurs: number;
  mancheMoyenne: number;
  ruses: number;
  demasque: number;
  denonciationsFausses: number;
  mauvaisesAccusations: number;
  refus: number;
}

function campagne(nbJoueurs: number, config: Partial<ConfigPartie>, profil: ProfilBot): Stat {
  const s: Stat = { victoiresEnqueteurs: 0, mancheMoyenne: 0, ruses: 0, demasque: 0, denonciationsFausses: 0, mauvaisesAccusations: 0, refus: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const { etat, refus } = simulerPartie({ nbJoueurs, seed: seed * 7919 + nbJoueurs, config: { ...AFFAIRE, ...config }, profil });
    if (etat.resultat?.vainqueur === 'enqueteurs') s.victoiresEnqueteurs++;
    s.mancheMoyenne += etat.manche;
    s.ruses +=
      etat.hypotheses.filter((h) => h.reponses.some((r) => r.resultat === 'mensonge' || r.resultat === 'emprunt')).length +
      etat.hypotheses.filter((h) => h.falsification).length +
      (etat.trafics?.length ?? 0);
    if (etat.compliceDemasque) s.demasque++;
    s.denonciationsFausses += (etat.denonciations ?? []).filter((d) => !d.correcte).length;
    s.mauvaisesAccusations += etat.accusations.filter((a) => !a.correcte).length;
    s.refus += refus.length;
  }
  return {
    victoiresEnqueteurs: s.victoiresEnqueteurs / N,
    mancheMoyenne: s.mancheMoyenne / N,
    ruses: s.ruses / N,
    demasque: s.demasque / N,
    denonciationsFausses: s.denonciationsFausses / N,
    mauvaisesAccusations: s.mauvaisesAccusations / N,
    refus: s.refus,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0).padStart(3)} %`;
const f1 = (x: number) => x.toFixed(1).padStart(5);

function tableau(titre: string, config: Partial<ConfigPartie>, profil: ProfilBot) {
  console.log(`\n=== ${titre} — ${N} parties par taille ===`);
  console.log('Joueurs | Enquêteurs gagnent | (sans pouvoirs) | Manche moy. | Pouvoirs utilisés | Complice démasqué | Dénonc. fausses | Mauvaises acc. | Refus');
  for (const n of [3, 4, 5, 6]) {
    const a = campagne(n, config, profil);
    const b = campagne(n, config, { ...profil, pouvoirs: false });
    console.log(
      `   ${n}    |       ${pct(a.victoiresEnqueteurs)}        |     ${pct(b.victoiresEnqueteurs)}       |    ${f1(a.mancheMoyenne)}    |       ${f1(a.ruses)}       |       ${pct(a.demasque)}       |     ${f1(a.denonciationsFausses)}     |     ${f1(a.mauvaisesAccusations)}      | ${a.refus}`,
    );
  }
}

const t0 = Date.now();
const CLASSIQUE: Partial<ConfigPartie> = { modeComplice: 'classique' };
const variantes: [string, Partial<ConfigPartie>][] = [
  ['Complice RUSÉ (réglages par défaut)', {}],
  ['Complice CLASSIQUE (mensonges + falsifications)', CLASSIQUE],
  ['Rusé, moins de ruses (2 / 3 / 4 / 4)', { ruses: { 3: 2, 4: 3, 5: 4, 6: 4 } }],
  ['Rusé, moins de ruses et carte empruntée à 3', { ruses: { 3: 2, 4: 3, 5: 4, 6: 4 }, coutRuses: { mensonge: 1, falsification: 1, emprunt: 3, trafic: 1 } }],
  ['Rusé, empreinte à chaque ruse', { probaEmpreinte: { 3: 1, 4: 1, 5: 1, 6: 1 } }],
  ['Rusé, 6 ruses à 6 joueurs', { ruses: { 3: 3, 4: 4, 5: 5, 6: 6 } }],
  ['Règles initiales (avant toute correction)', REGLES_INITIALES],
  [
    'Rusé, anciennes empreintes (avant le 20/10/2026 : dès la manche 2, nominatives à 3, ruses perdues si démasqué)',
    { probaEmpreinte: { 3: 0.35, 4: 0.5, 5: 0.6, 6: 0.7 }, delaiEmpreinte: [1, 2], premiereMancheEmpreinte: 1, empreinteAnonymeJusqua: 0, suspensionDemasque: 99 },
  ],
];
const idx = process.argv.indexOf('--variante');
const filtre = idx > 0 ? [variantes[Number(process.argv[idx + 1])]] : process.argv.includes('--rapide') ? variantes.slice(0, 1) : variantes;
for (const [nom, config] of filtre) {
  tableau(`${nom} — bots EXPERTS (mémoire parfaite)`, config, PROFIL_PAR_DEFAUT);
  tableau(`${nom} — bots OCCASIONNELS (éliminations directes uniquement)`, config, PROFIL_OCCASIONNEL);
}
console.log(`\nDurée : ${((Date.now() - t0) / 1000).toFixed(1)} s`);
void CONFIG_PAR_DEFAUT;
