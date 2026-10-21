// Compte joueur : connexion, création, mot de passe oublié (code de secours), gestion du compte.
// Sans compte, on joue normalement ; le compte sert à sauvegarder ses parties et à garder son profil
// (grade, succès) sur tous ses appareils.

import { useState, type FormEvent, type ReactNode } from 'react';
import { MOT_DE_PASSE_MIN, PSEUDO_MAX } from '../../shared/protocole';
import { connexion, useConnexion } from '../connexion';
import { Modale } from './Commun';
import { Icone } from './Emblemes';

type Vue = 'connexion' | 'creation' | 'oubli' | 'motDePasse' | 'suppression' | 'pseudo';

/** Code de secours à noter, montré une seule fois (après la création ou une récupération). */
function CodeSecours({ code, repris, onFini }: { code: string; repris: number; onFini: () => void }) {
  const [copie, setCopie] = useState<string | null>(null);
  const copier = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopie('Code copié.');
    } catch {
      setCopie('Copie impossible : recopiez le code à la main.');
    }
  };
  return (
    <>
      <p style={{ marginTop: 0 }}>
        Voici votre <strong>code de secours</strong>. Il permet de choisir un nouveau mot de passe si vous oubliez le vôtre.
      </p>
      <div className="code-secours">{code}</div>
      <div className="ligne" style={{ justifyContent: 'center' }}>
        <button className="btn btn-petit" onClick={() => void copier()}>
          <Icone nom="copie" /> Copier
        </button>
      </div>
      {copie && (
        <p className="petit" role="status" style={{ textAlign: 'center' }}>
          {copie}
        </p>
      )}
      <p className="petit avertissement-code">
        ⚠️ Notez-le maintenant (papier, notes du téléphone) : <strong>il ne sera plus jamais affiché</strong>. Sans lui, un mot de passe oublié ne peut
        pas être retrouvé.
      </p>
      {repris > 0 && (
        <p className="petit">
          ✅ {repris === 1 ? 'La sauvegarde faite sur cet appareil a été ajoutée' : `Les ${repris} sauvegardes faites sur cet appareil ont été ajoutées`} à
          votre compte.
        </p>
      )}
      <button className="btn btn-or btn-bloc" onClick={onFini}>
        J'ai noté mon code
      </button>
    </>
  );
}

function Champ({ id, label, children }: { id: string; label: string; children: ReactNode }) {
  return (
    <div className="champ">
      <label htmlFor={id}>{label}</label>
      {children}
    </div>
  );
}

/**
 * Fenêtre du compte. `pseudo` : pseudonyme proposé pour un nouveau compte. `onConnecte` : appelé avec
 * le nom du compte après une connexion ou une création réussie.
 */
export function ModaleCompte({
  onFermer,
  initiale = 'connexion',
  pseudo = '',
  onConnecte,
}: {
  onFermer: () => void;
  initiale?: 'connexion' | 'creation';
  pseudo?: string;
  onConnecte?: (nom: string) => void;
}) {
  const { compte } = useConnexion();
  const [vue, setVue] = useState<Vue>(initiale);
  const [nom, setNom] = useState(pseudo);
  const [mdp, setMdp] = useState('');
  const [mdp2, setMdp2] = useState('');
  const [ancien, setAncien] = useState('');
  const [codeSaisi, setCodeSaisi] = useState('');
  const [erreur, setErreur] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const [secours, setSecours] = useState<{ code: string; repris: number } | null>(null);

  const aller = (v: Vue) => {
    setVue(v);
    setErreur(null);
    setInfo(null);
    setMdp('');
    setMdp2('');
    setAncien('');
  };

  const valider = async (e: FormEvent) => {
    e.preventDefault();
    setErreur(null);
    setInfo(null);
    if ((vue === 'creation' || vue === 'oubli' || vue === 'motDePasse') && mdp.length < MOT_DE_PASSE_MIN)
      return setErreur(`Le mot de passe doit faire au moins ${MOT_DE_PASSE_MIN} caractères.`);
    if ((vue === 'creation' || vue === 'oubli' || vue === 'motDePasse') && mdp !== mdp2) return setErreur('Les deux mots de passe ne sont pas identiques.');
    if ((vue === 'connexion' || vue === 'creation' || vue === 'oubli') && !nom.trim()) return setErreur('Indiquez votre pseudonyme.');
    setEnvoi(true);
    if (vue === 'connexion') {
      const r = await connexion.connecterCompte(nom, mdp);
      setEnvoi(false);
      if (!r.ok) return setErreur(r.erreur);
      onConnecte?.(r.compte.nom);
      if (r.repris) setInfo(`${r.repris} sauvegarde${r.repris > 1 ? 's' : ''} de cet appareil ajoutée${r.repris > 1 ? 's' : ''} à votre compte.`);
      else onFermer();
    } else if (vue === 'creation') {
      const r = await connexion.creerCompte(nom, mdp);
      setEnvoi(false);
      if (!r.ok) return setErreur(r.erreur);
      onConnecte?.(r.compte.nom);
      setSecours({ code: r.codeSecours ?? '', repris: r.repris ?? 0 });
    } else if (vue === 'oubli') {
      const r = await connexion.recupererCompte(nom, codeSaisi, mdp);
      setEnvoi(false);
      if (!r.ok) return setErreur(r.erreur);
      onConnecte?.(r.compte.nom);
      setSecours({ code: r.codeSecours ?? '', repris: 0 });
    } else if (vue === 'motDePasse') {
      const r = await connexion.changerMotDePasse(ancien, mdp);
      setEnvoi(false);
      if (!r.ok) return setErreur(r.erreur);
      aller('connexion');
      setInfo('Mot de passe changé. Les autres appareils connectés à ce compte devront se reconnecter.');
    } else if (vue === 'pseudo') {
      if (!nom.trim()) {
        setEnvoi(false);
        return setErreur('Indiquez le nouveau pseudonyme.');
      }
      const r = await connexion.renommerCompte(nom, mdp);
      setEnvoi(false);
      if (!r.ok) return setErreur(r.erreur);
      onConnecte?.(r.compte.nom);
      aller('connexion');
      setInfo(`Pseudonyme changé : vous jouez et vous vous connectez désormais avec « ${r.compte.nom} ».`);
    } else if (vue === 'suppression') {
      const r = await connexion.supprimerCompte(mdp);
      setEnvoi(false);
      if (!r.ok) return setErreur(r.erreur);
      aller('connexion');
      setInfo('Compte supprimé, avec ses sauvegardes.');
    }
  };

  const messages = (
    <>
      {erreur && (
        <div className="erreur" role="alert">
          {erreur}
        </div>
      )}
      {info && (
        <p className="succes-sauvegarde" role="status">
          {info}
        </p>
      )}
    </>
  );

  const champMdp = (id: string, label: string, valeur: string, set: (v: string) => void, nouveau: boolean) => (
    <Champ id={id} label={label}>
      <input id={id} type="password" value={valeur} onChange={(e) => set(e.target.value)} autoComplete={nouveau ? 'new-password' : 'current-password'} maxLength={100} />
    </Champ>
  );

  // Code de secours à noter : rien d'autre tant qu'il n'est pas confirmé.
  if (secours)
    return (
      <Modale titre="Votre code de secours" onFermer={() => setSecours(null)}>
        <CodeSecours code={secours.code} repris={secours.repris} onFini={onFermer} />
      </Modale>
    );

  // Compte connecté : gestion.
  if (compte && vue !== 'motDePasse' && vue !== 'suppression' && vue !== 'pseudo')
    return (
      <Modale
        titre="Mon compte"
        onFermer={onFermer}
        pied={
          <button className="btn btn-or" onClick={onFermer}>
            Fermer
          </button>
        }
      >
        {messages}
        <p style={{ marginTop: 0 }}>
          Connecté en tant que <strong>{compte.nom}</strong>. Vos parties sauvegardées et votre profil (grade, succès) vous suivent sur tous vos appareils.
        </p>
        <div className="ligne">
          <button className="btn" onClick={() => void connexion.deconnecterCompte().then(onFermer)}>
            Se déconnecter
          </button>
          <button
            className="btn btn-discret"
            onClick={() => {
              aller('pseudo');
              setNom(compte.nom);
            }}
          >
            Changer de pseudonyme
          </button>
          <button className="btn btn-discret" onClick={() => aller('motDePasse')}>
            Changer le mot de passe
          </button>
        </div>
        <p className="petit muet" style={{ marginBottom: 0 }}>
          <button className="btn btn-discret btn-petit" onClick={() => aller('suppression')}>
            Supprimer mon compte
          </button>
        </p>
      </Modale>
    );

  const titres: Record<Vue, string> = {
    connexion: 'Se connecter',
    creation: 'Créer un compte',
    oubli: 'Mot de passe oublié',
    motDePasse: 'Changer le mot de passe',
    suppression: 'Supprimer mon compte',
    pseudo: 'Changer de pseudonyme',
  };
  const boutons: Record<Vue, string> = {
    connexion: 'Se connecter',
    creation: 'Créer mon compte',
    oubli: 'Choisir ce mot de passe',
    motDePasse: 'Changer le mot de passe',
    suppression: 'Supprimer définitivement',
    pseudo: 'Changer de pseudonyme',
  };

  return (
    <Modale titre={titres[vue]} onFermer={onFermer}>
      {(vue === 'connexion' || vue === 'creation') && (
        <div className="onglets-compte" role="tablist">
          <button role="tab" aria-selected={vue === 'connexion'} className={`btn btn-petit ${vue === 'connexion' ? 'btn-or' : 'btn-discret'}`} onClick={() => aller('connexion')}>
            J'ai un compte
          </button>
          <button role="tab" aria-selected={vue === 'creation'} className={`btn btn-petit ${vue === 'creation' ? 'btn-or' : 'btn-discret'}`} onClick={() => aller('creation')}>
            Créer un compte
          </button>
        </div>
      )}
      {vue === 'creation' && (
        <p className="petit muet" style={{ marginTop: 0 }}>
          Gratuit, sans adresse e-mail. Le compte garde vos parties sauvegardées (3 solo + 3 multijoueur) et votre profil, sur tous vos appareils.
        </p>
      )}
      {vue === 'oubli' && (
        <p className="petit muet" style={{ marginTop: 0 }}>
          Entrez le code de secours reçu à la création du compte, puis choisissez un nouveau mot de passe.
        </p>
      )}
      {vue === 'pseudo' && (
        <p className="petit muet" style={{ marginTop: 0 }}>
          Le nouveau pseudonyme servira à jouer <strong>et à vous connecter</strong>. Confirmez avec votre mot de passe.
        </p>
      )}
      {vue === 'suppression' && (
        <p className="petit" style={{ marginTop: 0 }}>
          Le compte, ses sauvegardes et son profil seront effacés <strong>définitivement</strong>. Confirmez avec votre mot de passe.
        </p>
      )}
      <form onSubmit={(e) => void valider(e)} noValidate>
        {(vue === 'connexion' || vue === 'creation' || vue === 'oubli' || vue === 'pseudo') && (
          <Champ id="compte-nom" label={vue === 'pseudo' ? 'Nouveau pseudonyme' : 'Pseudonyme'}>
            <input id="compte-nom" value={nom} maxLength={PSEUDO_MAX} onChange={(e) => setNom(e.target.value)} autoComplete="username" autoFocus={!nom} />
          </Champ>
        )}
        {vue === 'oubli' && (
          <Champ id="compte-code" label="Code de secours">
            <input
              id="compte-code"
              className="code-input"
              value={codeSaisi}
              maxLength={14}
              placeholder="ABCD-EFGH-JK23"
              autoCapitalize="characters"
              autoComplete="off"
              onChange={(e) => setCodeSaisi(e.target.value.toUpperCase())}
            />
          </Champ>
        )}
        {vue === 'motDePasse' && champMdp('compte-ancien', 'Mot de passe actuel', ancien, setAncien, false)}
        {(vue === 'connexion' || vue === 'suppression' || vue === 'pseudo') && champMdp('compte-mdp', 'Mot de passe', mdp, setMdp, false)}
        {(vue === 'creation' || vue === 'oubli' || vue === 'motDePasse') && (
          <>
            {champMdp('compte-mdp', vue === 'creation' ? `Mot de passe (${MOT_DE_PASSE_MIN} caractères minimum)` : `Nouveau mot de passe (${MOT_DE_PASSE_MIN} caractères minimum)`, mdp, setMdp, true)}
            {champMdp('compte-mdp2', 'Le même, pour vérifier', mdp2, setMdp2, true)}
          </>
        )}
        {messages}
        <button type="submit" className={`btn btn-bloc ${vue === 'suppression' ? 'btn-danger' : 'btn-or'}`} disabled={envoi} style={{ marginTop: 8 }}>
          {envoi ? 'Un instant…' : boutons[vue]}
        </button>
      </form>
      <div className="ligne" style={{ marginTop: 12 }}>
        {vue === 'connexion' && (
          <button className="btn btn-discret btn-petit" onClick={() => aller('oubli')}>
            Mot de passe oublié ?
          </button>
        )}
        {(vue === 'oubli' || vue === 'motDePasse' || vue === 'suppression' || vue === 'pseudo') && (
          <button className="btn btn-discret btn-petit" onClick={() => aller('connexion')}>
            ← Retour
          </button>
        )}
        <span className="espace" />
        <button className="btn btn-discret btn-petit" onClick={onFermer}>
          {compte ? 'Fermer' : 'Plus tard'}
        </button>
      </div>
    </Modale>
  );
}

/** Invitation à se connecter, là où un compte est nécessaire (sauvegarder, charger). */
export function InvitationCompte({ texte, pseudo, onConnecte }: { texte: ReactNode; pseudo?: string; onConnecte?: (nom: string) => void }) {
  const [ouverte, setOuverte] = useState<'connexion' | 'creation' | null>(null);
  return (
    <div className="invitation-compte">
      <p style={{ marginTop: 0 }}>{texte}</p>
      <div className="ligne">
        <button className="btn btn-or" onClick={() => setOuverte('creation')}>
          Créer un compte
        </button>
        <button className="btn" onClick={() => setOuverte('connexion')}>
          Se connecter
        </button>
      </div>
      <p className="petit muet" style={{ marginBottom: 0 }}>
        Gratuit et sans adresse e-mail : un pseudonyme et un mot de passe suffisent.
      </p>
      {ouverte && <ModaleCompte initiale={ouverte} pseudo={pseudo} onConnecte={onConnecte} onFermer={() => setOuverte(null)} />}
    </div>
  );
}
