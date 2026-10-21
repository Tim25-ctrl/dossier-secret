import { describe, expect, it } from 'vitest';
import { io as ioClient, type Socket } from 'socket.io-client';
import { demarrerServeur } from '../src/server/serveur';
import type { AttentePlace, EtatClient, EvenementsClient, EvenementsServeur, Reponse, Session } from '../src/shared/protocole';

type Client = Socket<EvenementsServeur, EvenementsClient>;
type ReponsePlace = { session: Session } | { refus: string };

const attendre = async (cond: () => boolean, ms = 4000, msg = 'condition') => {
  const fin = Date.now() + ms;
  while (!cond()) {
    if (Date.now() > fin) throw new Error(`Délai dépassé : ${msg}`);
    await new Promise((r) => setTimeout(r, 10));
  }
};

const options = () => ({
  port: 0,
  dossierDonnees: null,
  journaliser: false,
  cleSauvegarde: 'secret-test',
  intervalleSauvegardeMs: 20,
  delaiBotsMs: [60_000, 60_000] as [number, number], // les bots ne jouent pas pendant le test
});

async function client(url: string) {
  const socket: Client = ioClient(url, { transports: ['websocket'], forceNew: true, reconnection: false });
  const c = { socket, etat: null as EtatClient | null, sauvegarde: null as string | null, place: null as ReponsePlace | null };
  socket.on('etat', (e) => (c.etat = e));
  socket.on('sauvegarde', (p) => (c.sauvegarde = p.sauvegarde));
  socket.on('place', (p) => (c.place = p));
  await new Promise<void>((r) => socket.once('connect', () => r()));
  return c;
}
type R = Reponse<{ session?: Session; attente?: AttentePlace }>;
const emettre = (s: Client, ev: keyof EvenementsClient, p: unknown) => new Promise<R>((r) => (s.emit as (...a: unknown[]) => void)(ev, p, r));
const restaurer = (url: string, sauvegarde: string) =>
  fetch(`${url}/api/restaurer`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ sauvegarde }) }).then((r) => r.json());

/** Partie à deux humains (Hôte, Eva) et un bot, sur un serveur neuf. */
async function partieADeux() {
  const serveur = await demarrerServeur(options());
  const hote = await client(serveur.url);
  const eva = await client(serveur.url);
  const sHote = (await emettre(hote.socket, 'salon:creer', { nom: 'Hôte' })) as { session: Session };
  const sEva = (await emettre(eva.socket, 'salon:rejoindre', { code: sHote.session.code, nom: 'Eva' })) as { session: Session };
  await emettre(hote.socket, 'salon:ajouterBot', {});
  expect((await emettre(hote.socket, 'salon:demarrer', {})).ok).toBe(true);
  await attendre(() => !!hote.etat?.partie && !!eva.etat?.partie && hote.sauvegarde !== null, 4000, 'partie lancée');
  return { serveur, hote, eva, code: sHote.session.code, sessionHote: sHote.session, sessionEva: sEva.session };
}

describe('Retour des joueurs', () => {
  it("après le chargement d'une sauvegarde : salle d'attente, puis retour d'Eva sur un autre appareil avec l'accord de l'hôte", async () => {
    const p = await partieADeux();
    const mainEva = p.eva.etat!.partie!.moi.main;
    const sauvegarde = p.hote.sauvegarde!;
    p.hote.socket.disconnect();
    p.eva.socket.disconnect();
    await p.serveur.fermer();

    // Nouveau serveur : l'hôte recharge la partie, la salle d'attente s'affiche (Eva manque).
    const b = await demarrerServeur(options());
    expect(await restaurer(b.url, sauvegarde)).toMatchObject({ ok: true, restaure: true });
    const hote = await client(b.url);
    expect((await emettre(hote.socket, 'salon:reprendre', { code: p.code, jeton: p.sessionHote.jeton })).ok).toBe(true);
    await attendre(() => !!hote.etat?.partie, 2000, 'état hôte');
    expect(hote.etat!.salon.reprise).toBe(true);
    expect(hote.etat!.partie!.pause?.absents.map((a) => a.id)).toEqual([p.sessionEva.joueurId]);

    // Eva, sur un autre appareil : un mauvais pseudonyme est refusé (avec les places libres).
    const eva = await client(b.url);
    const faux = await emettre(eva.socket, 'salon:rejoindre', { code: p.code, nom: 'Zoé' });
    expect(faux.ok).toBe(false);
    expect(!faux.ok && faux.erreur).toContain('Eva');

    // Le bon pseudonyme : demande en attente, visible par l'hôte ; un refus est transmis à Eva.
    const demande = await emettre(eva.socket, 'salon:rejoindre', { code: p.code, nom: 'eva' });
    expect(demande).toEqual({ ok: true, attente: { code: p.code, nom: 'Eva' } });
    await attendre(() => hote.etat!.salon.demandes.length === 1, 2000, 'demande visible');
    expect((await emettre(hote.socket, 'salon:repondrePlace', { demandeId: hote.etat!.salon.demandes[0].id, accepter: false })).ok).toBe(true);
    await attendre(() => eva.place !== null, 2000, 'refus reçu');
    expect(eva.place).toHaveProperty('refus');
    expect(hote.etat!.salon.demandes).toEqual([]);

    // Nouvelle demande, acceptée : Eva reçoit une nouvelle session et retrouve ses cartes ; la partie reprend.
    eva.place = null;
    await emettre(eva.socket, 'salon:rejoindre', { code: p.code, nom: 'Eva' });
    await attendre(() => hote.etat!.salon.demandes.length === 1, 2000, 'deuxième demande');
    expect((await emettre(hote.socket, 'salon:repondrePlace', { demandeId: hote.etat!.salon.demandes[0].id, accepter: true })).ok).toBe(true);
    await attendre(() => eva.place !== null, 2000, 'accord reçu');
    const nouvelle = (eva.place as unknown as { session: Session }).session;
    expect(nouvelle.joueurId).toBe(p.sessionEva.joueurId);
    expect((await emettre(eva.socket, 'salon:reprendre', { code: p.code, jeton: nouvelle.jeton })).ok).toBe(true);
    await attendre(() => !!eva.etat?.partie && hote.etat!.salon.reprise === false, 2000, 'partie reprise');
    expect(eva.etat!.partie!.moi.main).toEqual(mainEva);
    expect(hote.etat!.partie!.pause).toBeNull();

    // L'ancienne session d'Eva ne fonctionne plus.
    const ancien = await client(b.url);
    expect((await emettre(ancien.socket, 'salon:reprendre', { code: p.code, jeton: p.sessionEva.jeton })).ok).toBe(false);
    for (const c of [hote, eva, ancien]) c.socket.disconnect();
    await b.fermer();
  });

  it('une demande disparaît si le joueur revient lui-même ou si le demandeur part ; le salon d\'attente reste normal', async () => {
    const p = await partieADeux();
    // Pas de salle d'attente pour une partie qui n'a pas été rechargée.
    expect(p.hote.etat!.salon.reprise).toBe(false);
    p.eva.socket.disconnect();
    await attendre(() => !!p.hote.etat!.partie!.pause, 2000, 'pause');

    // Le demandeur ferme sa page : sa demande est retirée.
    const intrus = await client(p.serveur.url);
    expect((await emettre(intrus.socket, 'salon:rejoindre', { code: p.code, nom: 'Eva' })).ok).toBe(true);
    await attendre(() => p.hote.etat!.salon.demandes.length === 1, 2000, 'demande');
    intrus.socket.disconnect();
    await attendre(() => p.hote.etat!.salon.demandes.length === 0, 2000, 'demande retirée');

    // Eva revient avec sa session pendant qu'une demande attend : la demande est refusée d'office.
    const autre = await client(p.serveur.url);
    await emettre(autre.socket, 'salon:rejoindre', { code: p.code, nom: 'Eva' });
    await attendre(() => p.hote.etat!.salon.demandes.length === 1, 2000, 'demande 2');
    const eva = await client(p.serveur.url);
    expect((await emettre(eva.socket, 'salon:reprendre', { code: p.code, jeton: p.sessionEva.jeton })).ok).toBe(true);
    await attendre(() => autre.place !== null, 2000, 'refus');
    expect(autre.place).toHaveProperty('refus');
    expect(p.hote.etat!.salon.demandes).toEqual([]);

    // Un joueur présent ne peut pas être « repris ».
    const r = await emettre(autre.socket, 'salon:rejoindre', { code: p.code, nom: 'Hôte' });
    expect(r.ok).toBe(false);
    for (const c of [p.hote, eva, autre]) c.socket.disconnect();
    await p.serveur.fermer();
  });
});
