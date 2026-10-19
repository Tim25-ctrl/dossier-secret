// Simulations d'équilibrage : npm run simulate [-- --parties 400]
//
// ATTENTION : les bots sont des approximations grossières de joueurs humains
// (ils ne discutent pas, ne bluffent pas en dehors des pouvoirs, ne soupçonnent
// personne). Les pourcentages donnent une TENDANCE, pas une mesure fiable.

import { simulerPartie } from '../src/bots/simulation';
import { PROFIL_OCCASIONNEL, PROFIL_PAR_DEFAUT, type ProfilBot } from '../src/bots/bot';
import { CONFIG_PAR_DEFAUT, REGLES_INITIALES, type ConfigPartie } from '../src/engine/config';

const argParties = process.argv.indexOf('--parties');
const N = argParties > 0 ? Number(process.argv[argParties + 1]) : 300;

interface Stat {
  victoiresEnqueteurs: number;
  mancheMoyenne: number;
  hypothesesMoyennes: number;
  mensonges: number;
  falsifications: number;
  mauvaisesAccusations: number;
  refus: number;
}

function campagne(nbJoueurs: number, config: Partial<ConfigPartie>, profil: ProfilBot): Stat {
  const s: Stat = { victoiresEnqueteurs: 0, mancheMoyenne: 0, hypothesesMoyennes: 0, mensonges: 0, falsifications: 0, mauvaisesAccusations: 0, refus: 0 };
  for (let seed = 1; seed <= N; seed++) {
    const { etat, refus } = simulerPartie({ nbJoueurs, seed: seed * 7919 + nbJoueurs, config, profil });
    if (etat.resultat?.vainqueur === 'enqueteurs') s.victoiresEnqueteurs++;
    s.mancheMoyenne += etat.manche;
    s.hypothesesMoyennes += etat.hypotheses.length;
    s.mensonges += etat.hypotheses.filter((h) => h.reponses.some((r) => r.resultat === 'mensonge')).length;
    s.falsifications += etat.hypotheses.filter((h) => h.falsification).length;
    s.mauvaisesAccusations += etat.accusations.filter((a) => !a.correcte).length;
    s.refus += refus.length;
  }
  return {
    victoiresEnqueteurs: s.victoiresEnqueteurs / N,
    mancheMoyenne: s.mancheMoyenne / N,
    hypothesesMoyennes: s.hypothesesMoyennes / N,
    mensonges: s.mensonges / N,
    falsifications: s.falsifications / N,
    mauvaisesAccusations: s.mauvaisesAccusations / N,
    refus: s.refus,
  };
}

const pct = (x: number) => `${(x * 100).toFixed(0).padStart(3)} %`;
const f1 = (x: number) => x.toFixed(1).padStart(5);

function tableau(titre: string, config: Partial<ConfigPartie>, profil: ProfilBot) {
  console.log(`\n=== ${titre} — ${N} parties par taille ===`);
  console.log('Joueurs | Enquêteurs gagnent | (sans pouvoirs) | Manche moy. | Hypothèses | Mensonges | Falsif. | Mauvaises acc. | Refus');
  for (const n of [3, 4, 5, 6]) {
    const a = campagne(n, config, profil);
    const b = campagne(n, config, { ...profil, pouvoirs: false });
    console.log(
      `   ${n}    |       ${pct(a.victoiresEnqueteurs)}        |     ${pct(b.victoiresEnqueteurs)}       |    ${f1(a.mancheMoyenne)}    |   ${f1(a.hypothesesMoyennes)}    |   ${f1(a.mensonges)}   |  ${f1(a.falsifications)}  |     ${f1(a.mauvaisesAccusations)}      | ${a.refus}`,
    );
  }
}

const t0 = Date.now();
const variantes: [string, Partial<ConfigPartie>][] = [
  ['Règles actuelles (corrections 1 + 3 + 4)', {}],
  ['Règles initiales (avant corrections)', REGLES_INITIALES],
  ['Correction 1 seule : cartes restantes en pièces à conviction', { ...REGLES_INITIALES, cartesRestantes: 'archives' }],
  ['Correction 3 seule : hypothèse à 2 PA', { ...REGLES_INITIALES, coutHypothese: 2 }],
  ['Correction 4 seule : pouvoirs 3 mensonges / 2 falsifications à 5-6 joueurs', { ...REGLES_INITIALES, pouvoirs: CONFIG_PAR_DEFAUT.pouvoirs }],
];
const idx = process.argv.indexOf('--variante');
const filtre = idx > 0 ? [variantes[Number(process.argv[idx + 1])]] : process.argv.includes('--rapide') ? variantes.slice(0, 1) : variantes;
for (const [nom, config] of filtre) {
  tableau(`${nom} — bots EXPERTS (mémoire parfaite)`, config, PROFIL_PAR_DEFAUT);
  tableau(`${nom} — bots OCCASIONNELS (éliminations directes uniquement)`, config, PROFIL_OCCASIONNEL);
}
console.log(`\nDurée : ${((Date.now() - t0) / 1000).toFixed(1)} s`);
