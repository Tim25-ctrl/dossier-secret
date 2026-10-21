import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MESSAGE_MAX, type MessageChat } from '../../shared/protocole';
import { connexion } from '../connexion';

/** Réactions rapides : un toucher suffit, pratique sur téléphone. */
const REACTIONS = [
  { emoji: '🤔', sens: 'je réfléchis' },
  { emoji: '👀', sens: 'je vous surveille' },
  { emoji: '🤥', sens: 'menteur !' },
  { emoji: '😱', sens: 'surprise' },
  { emoji: '😂', sens: 'rire' },
  { emoji: '👍', sens: "d'accord" },
];
const SEULE_REACTION = new RegExp('^(' + REACTIONS.map((r) => r.emoji).join('|') + ')$', 'u');

export function Chat({ messages, moi, onErreur }: { messages: MessageChat[]; moi: string; onErreur: (e: string) => void }) {
  const [texte, setTexte] = useState('');
  const liste = useRef<HTMLUListElement>(null);
  useEffect(() => {
    liste.current?.scrollTo({ top: liste.current.scrollHeight });
  }, [messages.length]);

  const [envoiReaction, setEnvoiReaction] = useState(false);
  const reagir = async (emoji: string) => {
    setEnvoiReaction(true);
    const r = await connexion.message(emoji);
    setEnvoiReaction(false);
    if (!r.ok) onErreur(r.erreur);
  };

  const envoyer = async (e: FormEvent) => {
    e.preventDefault();
    if (!texte.trim()) return;
    const r = await connexion.message(texte);
    if (r.ok) setTexte('');
    else onErreur(r.erreur);
  };

  return (
    <div className="chat">
      <ul className="chat-messages" ref={liste} aria-live="polite" aria-label="Messages de la discussion">
        {messages.length === 0 && <li className="muet">Aucun message. Partagez vos soupçons… ou semez le doute.</li>}
        {messages.map((m) => (
          <li key={m.id}>
            <span className="auteur">{m.auteur === moi ? 'Vous' : m.nom}</span>
            {SEULE_REACTION.test(m.texte) ? <span className="reaction-message">{m.texte}</span> : m.texte}
          </li>
        ))}
      </ul>
      <div className="reactions" role="group" aria-label="Réactions rapides">
        {REACTIONS.map((r) => (
          <button key={r.emoji} type="button" className="reaction" disabled={envoiReaction} onClick={() => void reagir(r.emoji)} title={r.sens} aria-label={`Réagir : ${r.sens}`}>
            {r.emoji}
          </button>
        ))}
      </div>
      <form onSubmit={envoyer} className="ligne" style={{ flexWrap: 'nowrap' }}>
        <label htmlFor="message" className="sr-only">
          Votre message
        </label>
        <input
          id="message"
          value={texte}
          onChange={(e) => setTexte(e.target.value)}
          maxLength={MESSAGE_MAX}
          placeholder="Votre message (public)"
          autoComplete="off"
          style={{ flex: 1, minWidth: 0, minHeight: 44, padding: '0.5em 0.7em', borderRadius: 8, border: '1px solid var(--ardoise-clair)', background: 'var(--nuit-2)' }}
        />
        <button className="btn btn-petit" type="submit" style={{ minHeight: 44 }} disabled={!texte.trim()}>
          Envoyer
        </button>
      </form>
    </div>
  );
}
