import { useEffect, useRef, useState, type FormEvent } from 'react';
import { MESSAGE_MAX, type MessageChat } from '../../shared/protocole';
import { connexion } from '../connexion';

export function Chat({ messages, moi, onErreur }: { messages: MessageChat[]; moi: string; onErreur: (e: string) => void }) {
  const [texte, setTexte] = useState('');
  const liste = useRef<HTMLUListElement>(null);
  useEffect(() => {
    liste.current?.scrollTo({ top: liste.current.scrollHeight });
  }, [messages.length]);

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
            {m.texte}
          </li>
        ))}
      </ul>
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
