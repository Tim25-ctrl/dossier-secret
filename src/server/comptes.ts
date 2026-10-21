// Comptes joueurs : pseudonyme + mot de passe, sans adresse e-mail.
//
// - Le mot de passe et le code de secours ne sont jamais gardés en clair : seulement une empreinte
//   scrypt salée (lente à calculer, pour décourager les essais en série si la base fuitait).
// - Le code de secours (12 caractères, montré une seule fois) permet de choisir un nouveau mot de passe.
// - L'appareil connecté reçoit un jeton de session (aléatoire) ; le serveur n'en garde que l'empreinte.
// - Après plusieurs mots de passe faux pour un même pseudonyme, les essais sont bloqués quelques minutes.

import { createHash, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { ALPHABET_CODE, MOT_DE_PASSE_MIN, type CompteVue } from '../shared/protocole';
import type { Compte, Depot } from './emplacements';
import { ErreurJeu, normaliserPseudo } from './salons';

const MOT_DE_PASSE_MAX = 100;
/** Une session (appareil connecté) expire ce délai après la connexion. */
const DUREE_SESSION_MS = 180 * 24 * 3600 * 1000;
const ESSAIS_MAX = 5;
const FENETRE_ESSAIS_MS = 15 * 60_000;
const BLOCAGE_MS = 5 * 60_000;
const PROFIL_MAX = 20_000;

const INCORRECT = 'Pseudonyme ou mot de passe incorrect.';

function deriver(secret: string, sel: Buffer): Promise<Buffer> {
  return new Promise((ok, ko) => scrypt(secret.normalize('NFC'), sel, 32, { N: 16384, r: 8, p: 1 }, (e, cle) => (e ? ko(e) : ok(cle))));
}

export async function empreinte(secret: string): Promise<string> {
  const sel = randomBytes(16);
  return `s1$${sel.toString('base64url')}$${(await deriver(secret, sel)).toString('base64url')}`;
}

export async function verifier(secret: string, empreinteGardee: string): Promise<boolean> {
  const [version, sel, attendu] = empreinteGardee.split('$');
  if (version !== 's1' || !sel || !attendu) return false;
  const calcule = await deriver(secret, Buffer.from(sel, 'base64url'));
  const ref = Buffer.from(attendu, 'base64url');
  return ref.length === calcule.length && timingSafeEqual(ref, calcule);
}

const hacherJeton = (jeton: string) => createHash('sha256').update(`compte:${jeton}`).digest('hex');

/** Clé d'unicité d'un pseudonyme : insensible à la casse et aux accents composés différemment. */
export const cleNom = (nom: string) => nom.normalize('NFC').toLocaleLowerCase('fr');

function nouveauCodeSecours(): string {
  const alea = randomBytes(12);
  const brut = [...alea].map((n) => ALPHABET_CODE[n % ALPHABET_CODE.length]).join('');
  return brut.match(/.{4}/g)!.join('-');
}
const normaliserCodeSecours = (code: string) => code.trim().toUpperCase().replace(/[\s-]/g, '');

function verifierMotDePasse(mdp: unknown): string {
  if (typeof mdp !== 'string' || mdp.length < MOT_DE_PASSE_MIN) throw new ErreurJeu(`Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`);
  if (mdp.length > MOT_DE_PASSE_MAX) throw new ErreurJeu(`Le mot de passe est limité à ${MOT_DE_PASSE_MAX} caractères.`);
  return mdp;
}

function lireProfil(json: string | null): unknown {
  if (!json) return null;
  try {
    return JSON.parse(json);
  } catch {
    return null;
  }
}

export const vueCompte = (c: Compte): CompteVue => ({ nom: c.nom, profil: lireProfil(c.profil) });

export class ServiceComptes {
  /** Mots de passe faux récents, par pseudonyme (en mémoire seulement). */
  private essais = new Map<string, { echecs: number; debut: number; bloqueJusqua: number }>();

  constructor(
    private depot: Depot,
    private now: () => number = Date.now,
  ) {}

  private verifierBlocage(nomCle: string) {
    const e = this.essais.get(nomCle);
    if (e && e.bloqueJusqua > this.now()) {
      const minutes = Math.ceil((e.bloqueJusqua - this.now()) / 60_000);
      throw new ErreurJeu(`Trop d'essais pour ce compte : réessayez dans ${minutes} minute${minutes > 1 ? 's' : ''}.`);
    }
  }

  private noterEchec(nomCle: string) {
    const t = this.now();
    const e = this.essais.get(nomCle);
    const courant = e && t - e.debut < FENETRE_ESSAIS_MS ? e : { echecs: 0, debut: t, bloqueJusqua: 0 };
    courant.echecs++;
    if (courant.echecs >= ESSAIS_MAX) {
      courant.bloqueJusqua = t + BLOCAGE_MS;
      courant.echecs = 0;
      courant.debut = t;
    }
    this.essais.set(nomCle, courant);
    // La table ne grossit pas indéfiniment.
    if (this.essais.size > 5000) for (const [k, v] of this.essais) if (t - v.debut > FENETRE_ESSAIS_MS && v.bloqueJusqua < t) this.essais.delete(k);
  }

  private async ouvrirSession(compteId: string) {
    const jeton = randomBytes(32).toString('base64url');
    await this.depot.ajouterSession(hacherJeton(jeton), compteId, this.now());
    return jeton;
  }

  async creer(nomBrut: unknown, mdpBrut: unknown, profil: unknown) {
    const nom = normaliserPseudo(nomBrut);
    const mdp = verifierMotDePasse(mdpBrut);
    const codeSecours = nouveauCodeSecours();
    const compte: Compte = {
      id: randomBytes(12).toString('base64url'),
      nom,
      nomCle: cleNom(nom),
      mdp: await empreinte(mdp),
      secours: await empreinte(normaliserCodeSecours(codeSecours)),
      profil: profil ? JSON.stringify(profil) : null,
      creeLe: this.now(),
    };
    if (compte.profil && compte.profil.length > PROFIL_MAX) compte.profil = null;
    if (!(await this.depot.creerCompte(compte))) throw new ErreurJeu('Ce pseudonyme est déjà pris par un autre compte.');
    return { compte, jeton: await this.ouvrirSession(compte.id), codeSecours };
  }

  async connecter(nomBrut: unknown, mdpBrut: unknown) {
    const nomCle = cleNom(normaliserPseudo(nomBrut));
    this.verifierBlocage(nomCle);
    if (typeof mdpBrut !== 'string' || mdpBrut.length > MOT_DE_PASSE_MAX) throw new ErreurJeu(INCORRECT);
    const compte = await this.depot.compteParNom(nomCle);
    // Même lenteur que le compte existe ou non : on ne révèle pas quels pseudonymes ont un compte.
    const bon = compte ? await verifier(mdpBrut, compte.mdp) : (await empreinte(mdpBrut), false);
    if (!compte || !bon) {
      this.noterEchec(nomCle);
      throw new ErreurJeu(INCORRECT);
    }
    this.essais.delete(nomCle);
    return { compte, jeton: await this.ouvrirSession(compte.id) };
  }

  /** Compte lié au jeton de session de l'appareil (null s'il n'est plus valable). */
  async reprendre(jeton: unknown): Promise<Compte | null> {
    if (typeof jeton !== 'string' || jeton.length < 20 || jeton.length > 100) return null;
    const s = await this.depot.sessionCompte(hacherJeton(jeton));
    if (!s) return null;
    if (this.now() - s.t > DUREE_SESSION_MS) {
      await this.depot.supprimerSession(hacherJeton(jeton));
      return null;
    }
    return this.depot.compteParId(s.compteId);
  }

  async deconnecter(jeton: unknown) {
    if (typeof jeton === 'string' && jeton.length <= 100) await this.depot.supprimerSession(hacherJeton(jeton));
  }

  /** Mot de passe oublié : le code de secours permet d'en choisir un nouveau (et donne un nouveau code). */
  async recuperer(nomBrut: unknown, codeBrut: unknown, mdpBrut: unknown) {
    const nomCle = cleNom(normaliserPseudo(nomBrut));
    this.verifierBlocage(nomCle);
    const mdp = verifierMotDePasse(mdpBrut);
    const compte = await this.depot.compteParNom(nomCle);
    const bon = compte && typeof codeBrut === 'string' && codeBrut.length < 40 ? await verifier(normaliserCodeSecours(codeBrut), compte.secours) : false;
    if (!compte || !bon) {
      this.noterEchec(nomCle);
      throw new ErreurJeu('Pseudonyme ou code de secours incorrect.');
    }
    this.essais.delete(nomCle);
    const codeSecours = nouveauCodeSecours();
    await this.depot.majCompte(compte.id, { mdp: await empreinte(mdp), secours: await empreinte(normaliserCodeSecours(codeSecours)) });
    await this.depot.supprimerSessions(compte.id); // les appareils déjà connectés devront se reconnecter
    return { compte, jeton: await this.ouvrirSession(compte.id), codeSecours };
  }

  async changerMotDePasse(compteId: string, ancien: unknown, nouveau: unknown, jetonActuel: string) {
    const compte = await this.depot.compteParId(compteId);
    if (!compte) throw new ErreurJeu("Ce compte n'existe plus.");
    this.verifierBlocage(compte.nomCle);
    const mdp = verifierMotDePasse(nouveau);
    if (typeof ancien !== 'string' || !(await verifier(ancien, compte.mdp))) {
      this.noterEchec(compte.nomCle);
      throw new ErreurJeu('Mot de passe actuel incorrect.');
    }
    await this.depot.majCompte(compteId, { mdp: await empreinte(mdp) });
    await this.depot.supprimerSessions(compteId, hacherJeton(jetonActuel)); // les autres appareils sont déconnectés
  }

  async supprimer(compteId: string, mdp: unknown) {
    const compte = await this.depot.compteParId(compteId);
    if (!compte) return;
    this.verifierBlocage(compte.nomCle);
    if (typeof mdp !== 'string' || !(await verifier(mdp, compte.mdp))) {
      this.noterEchec(compte.nomCle);
      throw new ErreurJeu('Mot de passe incorrect.');
    }
    await this.depot.supprimerCompte(compteId);
  }

  async enregistrerProfil(compteId: string, profil: unknown) {
    const json = JSON.stringify(profil);
    if (json.length > PROFIL_MAX) throw new ErreurJeu('Profil trop volumineux.');
    await this.depot.majCompte(compteId, { profil: json });
  }
}
