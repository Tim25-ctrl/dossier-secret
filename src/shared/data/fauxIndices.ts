// Modèles de FAUX indices « pas X avec Y », pour toutes les paires d'éléments d'une affaire.
// Ils ne sont jamais tirés comme vrais indices : seule la ruse « Dossier trafiqué » les utilise,
// quand aucun indice rédigé ne peut servir de faux pour la solution de la partie.

import type { ArmeId, CarteIndice, ElementId, LieuId, MobileId, SuspectId } from '../types';
import type { FicheArme, FicheLieu, FichePersonnage } from './modeles';

export interface TextesFaux {
  /** Préfixe des identifiants (« FAUX » pour le manoir, « FAUX-T » pour le train…). */
  prefixe: string;
  /** Titre d'une page du carnet de la victime, numérotée de 0 à 5 (dates de la même semaine). */
  titrePage: (n: number) => string;
  /** Façon dont la victime nomme chaque suspect dans son carnet. */
  prenoms: Record<string, string>;
  /** Pages du carnet : la victime parle d'un suspect et d'un lieu, d'un suspect et d'une arme, d'un lieu et d'une arme. */
  pageSuspectLieu: (prenom: string, lieu: string) => string;
  pageSuspectArme: (prenom: string, arme: string) => string;
  pageLieuArme: (lieu: string, arme: string) => string;
}

/** « Le bureau » → « du bureau », « La serre » → « de la serre », « L'office » → « de l'office ». */
function deLieu(nom: string): string {
  if (nom.startsWith('Le ')) return `du ${nom.slice(3)}`;
  if (nom.startsWith('La ')) return `de la ${nom.slice(3)}`;
  if (nom.startsWith("L'")) return `de l'${nom.slice(2)}`;
  return `de ${nom}`;
}

/**
 * Témoignage partiel : « si le crime a eu lieu là (ou avec cette arme), le coupable est l'un de
 * ces deux suspects ». Traduit en une règle « pas X avec Y » pour chacun des autres suspects :
 * l'indice n'écarte rien à lui seul et laisse toujours deux coupables possibles.
 */
export function seulsSuspects(tous: readonly SuspectId[], pivot: LieuId | ArmeId | MobileId, suspects: SuspectId[]) {
  return tous.filter((s) => !suspects.includes(s)).map((s) => ({ type: 'pasEnsemble', a: s, b: pivot }) as const);
}

export function genererFauxIndices(
  e: { suspects: readonly SuspectId[]; lieux: readonly LieuId[]; armes: readonly ArmeId[] },
  fiches: { personnages: Record<string, FichePersonnage>; lieux: Record<string, FicheLieu>; armes: Record<string, FicheArme> },
  t: TextesFaux,
): CarteIndice[] {
  const minuscule = (x: string) => x.charAt(0).toLowerCase() + x.slice(1);
  const armeNom = (a: ArmeId) => fiches.armes[a].article.replace(/^avec /, '');
  const regle = (a: ElementId, b: ElementId) => ({ type: 'pasEnsemble', a, b }) as const;
  const out: CarteIndice[] = [];

  // Modèles classiques : témoin, empreintes, fouille.
  for (const s of e.suspects) {
    const nom = fiches.personnages[s].nom;
    for (const l of e.lieux) {
      const lieu = fiches.lieux[l];
      out.push({
        id: `${t.prefixe}-${s}-${l}`,
        titre: `Le témoin ${deLieu(lieu.nom)}`,
        categorie: 'temoignage',
        texte: `Un témoin assure que personne n'est entré ${lieu.article} pendant la soirée, et surtout pas ${nom}. Si ${nom} est coupable, le crime n'a pas eu lieu ${lieu.article}.`,
        concerne: [s, l],
        regles: [regle(s, l)],
        disponibleDesManche: 1,
      });
    }
    for (const a of e.armes) {
      out.push({
        id: `${t.prefixe}-${s}-${a}`,
        titre: `Les empreintes sur ${armeNom(a)}`,
        categorie: 'trace',
        texte: `Les seules empreintes relevées sur ${armeNom(a)} ne sont pas celles de ${nom}, et personne ne l'a vu s'en approcher. Si ${nom} est coupable, ce n'est pas ${fiches.armes[a].article}.`,
        concerne: [s, a],
        regles: [regle(s, a)],
        disponibleDesManche: 1,
      });
    }
  }
  for (const l of e.lieux) {
    const lieu = fiches.lieux[l];
    for (const a of e.armes) {
      out.push({
        id: `${t.prefixe}-${l}-${a}`,
        titre: `Rien ${lieu.article}`,
        categorie: 'trace',
        texte: `Les enquêteurs ont passé ${minuscule(lieu.nom)} au peigne fin : rien n'indique que ${armeNom(a)} y ait servi. Si le crime a eu lieu ${lieu.article}, ce n'était pas ${fiches.armes[a].article}.`,
        concerne: [l, a],
        regles: [regle(l, a)],
        disponibleDesManche: 1,
      });
    }
  }

  // Fausses pages du carnet de la victime : un dossier « carnet » trafiqué doit rester une page datée de la même semaine.
  let n = 0;
  const page = (id: string, texte: string, a: ElementId, b: ElementId) =>
    out.push({ id, titre: t.titrePage(n++ % 6), categorie: 'journal', texte, concerne: [a, b], regles: [regle(a, b)], disponibleDesManche: 1 });
  for (const s of e.suspects) {
    for (const l of e.lieux) page(`${t.prefixe}-J-${s}-${l}`, t.pageSuspectLieu(t.prenoms[s], fiches.lieux[l].article), s, l);
    for (const a of e.armes) page(`${t.prefixe}-J-${s}-${a}`, t.pageSuspectArme(t.prenoms[s], armeNom(a)), s, a);
  }
  for (const l of e.lieux) for (const a of e.armes) page(`${t.prefixe}-J-${l}-${a}`, t.pageLieuArme(fiches.lieux[l].article, armeNom(a)), l, a);
  return out;
}
