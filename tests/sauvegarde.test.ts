import { describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { demarrerServeur } from '../src/server/serveur';
import { Coffre, DUREE_VALIDITE_MS } from '../src/server/sauvegarde';
import type { Salon } from '../src/server/salons';
import type { EtatClient, EvenementsClient, EvenementsServeur, Reponse, Session } from '../src/shared/protocole';

type Client = Socket<EvenementsServeur, EvenementsClient>;

const attendre = async (cond: () => boolean, ms = 4000, msg = 'condition') => {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error(`Délai dépassé : ${msg}`);
    await new Promise((r) => setTimeout(r, 10));
  }
};

const options = (cleSauvegarde: string | null) => ({
  port: 0,
  dossierDonnees: null,
  journaliser: false,
  cleSauvegarde,
  intervalleSauvegardeMs: 20,
  delaiBotsMs: [60_000, 60_000] as [number, number], // les bots ne jouent pas pendant le test
});

/** Petit client : garde le dernier état et la dernière sauvegarde reçus. */
async function client(url: string) {
  const socket: Client = ioClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  const c = { socket, etat: null as EtatClient | null, sauvegarde: null as string | null };
  socket.on('etat', (e) => (c.etat = e));
  socket.on('sauvegarde', (p) => (c.sauvegarde = p.sauvegarde));
  await new Promise<void>((r) => socket.once('connect', () => r()));
  return c;
}
const emettre = (s: Client, ev: keyof EvenementsClient, p: unknown) =>
  new Promise<Reponse<{ session?: Session }>>((r) => (s.emit as (...a: unknown[]) => void)(ev, p, r));
const restaurer = (url: string, sauvegarde: unknown) =>
  fetch(`${url}/api/restaurer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sauvegarde }) }).then(
    async (r) => ({ statut: r.status, corps: (await r.json()) as Reponse<{ code: string; restaure: boolean }> }),
  );

describe('Coffre des sauvegardes', () => {
  const salon = { code: 'ABCDEF', joueurs: [{ id: 'j1' }], secret: 'solution' } as unknown as Salon;

  it('rend le salon intact avec la même clé, et rien de lisible dans la sauvegarde', () => {
    const coffre = new Coffre('cle');
    const texte = coffre.sceller(salon);
    expect(texte).not.toContain('solution');
    expect(Buffer.from(texte, 'base64url').toString('latin1')).not.toContain('solution');
    expect(coffre.ouvrir(texte)?.salon).toEqual(salon);
    expect(new Coffre('cle').ouvrir(texte)?.salon).toEqual(salon);
  });

  it('refuse une autre clé, une sauvegarde modifiée, trop ancienne ou mal formée', () => {
    const coffre = new Coffre('cle');
    const texte = coffre.sceller(salon);
    expect(new Coffre('autre').ouvrir(texte)).toBeNull();
    const brut = Buffer.from(texte, 'base64url');
    brut[brut.length - 1] ^= 1;
    expect(coffre.ouvrir(brut.toString('base64url'))).toBeNull();
    expect(coffre.ouvrir(coffre.sceller(salon, Date.now() - DUREE_VALIDITE_MS - 1000))).toBeNull();
    expect(coffre.ouvrir('nimporte quoi')).toBeNull();
    expect(coffre.ouvrir(42)).toBeNull();
  });

  it('sans clé, la clé provisoire change à chaque démarrage', () => {
    const texte = new Coffre(null).sceller(salon);
    expect(new Coffre(null).ouvrir(texte)).toBeNull();
  });
});

describe('Reprise après un redémarrage du serveur', () => {
  it('la sauvegarde gardée par un joueur recrée le salon : même partie, mêmes cartes, même place', async () => {
    // 1. Une partie démarre sur un premier serveur ; le joueur reçoit sa sauvegarde.
    const a = await demarrerServeur(options('secret-commun'));
    const hote = await client(a.url);
    const r = await emettre(hote.socket, 'salon:creer', { nom: 'Hôte' });
    expect(r.ok).toBe(true);
    const session = (r as { session: Session }).session;
    await emettre(hote.socket, 'salon:ajouterBot', {});
    await emettre(hote.socket, 'salon:ajouterBot', {});
    expect((await emettre(hote.socket, 'salon:demarrer', {})).ok).toBe(true);
    await attendre(() => !!hote.etat?.partie && hote.sauvegarde !== null, 4000, 'sauvegarde reçue');
    const sauvegarde = hote.sauvegarde!;
    const avant = hote.etat!.partie!;
    hote.socket.disconnect();
    await a.fermer();

    // 2. Nouveau serveur (mémoire vide) : le salon n'existe plus.
    const b = await demarrerServeur(options('secret-commun'));
    const revenu = await client(b.url);
    const echec = await emettre(revenu.socket, 'salon:reprendre', { code: session.code, jeton: session.jeton });
    expect(echec.ok).toBe(false);

    // 3. La sauvegarde le recrée ; le joueur reprend sa place, avec les mêmes informations.
    const res = await restaurer(b.url, sauvegarde);
    expect(res.corps).toEqual({ ok: true, code: session.code, restaure: true });
    expect((await emettre(revenu.socket, 'salon:reprendre', { code: session.code, jeton: session.jeton })).ok).toBe(true);
    await attendre(() => !!revenu.etat?.partie, 2000, 'état restauré');
    const apres = revenu.etat!.partie!;
    expect(apres.moi.main).toEqual(avant.moi.main);
    expect(apres.moi.role).toEqual(avant.moi.role);
    expect(apres.manche).toBe(avant.manche);
    expect(apres.joueurActif).toBe(avant.joueurActif);

    // 4. Le salon existe déjà : une seconde sauvegarde ne l'écrase pas.
    expect((await restaurer(b.url, sauvegarde)).corps).toEqual({ ok: true, code: session.code, restaure: false });
    revenu.socket.disconnect();
    await b.fermer();

    // 5. Un serveur avec une autre clé refuse cette sauvegarde, comme une sauvegarde modifiée.
    const c = await demarrerServeur(options('autre-secret'));
    expect((await restaurer(c.url, sauvegarde)).statut).toBe(400);
    expect((await restaurer(c.url, sauvegarde.slice(0, -4) + 'AAAA')).statut).toBe(400);
    await c.fermer();
  });
});
