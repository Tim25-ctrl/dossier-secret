import { AFFAIRE } from '../../shared/data/manoir';
import { useState } from 'react';
import type { VueJoueur } from '../../shared/types';
import { Modale } from '../components/Commun';
import { Dossier } from '../components/jeu/Dossier';

export function ContenuRegles() {
  return (
    <div className="regles">
      <h3>L'affaire</h3>
      {AFFAIRE.resume.map((p) => (
        <p key={p}>{p}</p>
      ))}

      <h3>But du jeu</h3>
      <p>
        Découvrir <strong>qui</strong> a tué Armand, <strong>où</strong> et <strong>avec quelle arme</strong>. Six suspects, six lieux et six armes : une seule
        combinaison est la bonne. Le meurtrier est un personnage de l'histoire — aucun joueur ne l'incarne.
      </p>

      <h3>Les rôles secrets</h3>
      <ul>
        <li>
          <strong>Les enquêteurs</strong> (tous les joueurs sauf un) cherchent la solution. Ils gagnent dès que l'un d'eux formule une accusation finale juste.
        </li>
        <li>
          <strong>Le complice</strong> (un seul joueur, tiré au sort) connaît le nom du meurtrier, mais ni le lieu ni l'arme. Il gagne si personne n'a trouvé la
          solution à la fin de la 12ᵉ manche, ou si tous les enquêteurs se sont trompés d'accusation. Il ne peut pas faire d'accusation finale. Tout le monde sait qu'il y a un complice, personne ne
          sait qui.
        </li>
      </ul>

      <h3>Les cartes</h3>
      <p>
        Les 18 cartes (suspects, lieux, armes) moins les trois de la solution sont distribuées. Chaque carte que vous possédez est innocente : elle ne fait
        pas partie de la solution. S'il en reste (à 4 et 6 joueurs), elles deviennent des « pièces à conviction » rangées dans les archives : chacun peut les consulter (1 PA) pour les écarter.
      </p>
      <div className="tableau-defilant">
      <table>
        <thead>
          <tr>
            <th>Joueurs</th>
            <th>Cartes par joueur</th>
            <th>Pièces à conviction</th>
            <th>Joueurs interrogés</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>3</td>
            <td>5</td>
            <td>0</td>
            <td>1</td>
          </tr>
          <tr>
            <td>4</td>
            <td>3</td>
            <td>3</td>
            <td>2</td>
          </tr>
          <tr>
            <td>5</td>
            <td>3</td>
            <td>0</td>
            <td>2</td>
          </tr>
          <tr>
            <td>6</td>
            <td>2</td>
            <td>3</td>
            <td>3</td>
          </tr>
        </tbody>
      </table>
      </div>

      <h3>Le tour de jeu</h3>
      <p>
        La partie dure au maximum <strong>12 manches</strong>. À chaque manche, chacun joue son tour avec <strong>2 points d'action (PA)</strong> :
      </p>
      <ul>
        <li>
          <strong>Formuler une hypothèse</strong> — 2 PA (tout votre tour), une fois par tour.
        </li>
        <li>
          <strong>Consulter un dossier d'archives</strong> — 1 PA. Vous seul lisez l'indice ; les autres voient seulement que vous avez consulté un dossier. Certains
          dossiers ne s'ouvrent qu'à partir d'une certaine manche.
        </li>
        <li>
          <strong>Accusation finale</strong> — gratuite, pendant votre tour, une seule fois par partie.
        </li>
        <li>
          <strong>Carnet de déduction et discussion</strong> — gratuits, à tout moment.
        </li>
      </ul>
      <p>L'hôte choisit dans le salon d'attente la durée d'un tour (de 1 à 10 minutes, ou sans limite). À la fin du temps, le tour passe automatiquement. Un joueur déconnecté est passé au bout de quelques secondes, même sans limite de temps.</p>

      <h3>L'hypothèse et l'interrogation</h3>
      <p>
        Vous proposez un suspect, un lieu et une arme, puis vous choisissez qui interroger (1 joueur à 3 joueurs, 2 à 4 ou 5 joueurs, 3 à 6 joueurs) et dans quel
        ordre. Les joueurs interrogés répondent l'un après l'autre :
      </p>
      <ul>
        <li>le premier qui possède au moins une des trois cartes doit vous en montrer une (il choisit laquelle) — en secret, à vous seul ;</li>
        <li>dès qu'une carte est montrée, l'interrogation s'arrête ;</li>
        <li>si personne n'a de carte, vous ne recevez rien. Attention : cela ne prouve pas que l'hypothèse est juste !</li>
      </ul>
      <p>Répondre à une interrogation ne coûte aucun point d'action.</p>

      <h3>Les pouvoirs du complice</h3>
      <ul>
        <li>
          <strong>Mensonge (2 fois par partie, 3 fois à 5 ou 6 joueurs)</strong> — quand il est interrogé et qu'il possède une carte correspondante, le complice peut faire comme s'il n'en avait
          aucune. Pour tous, cela ressemble à « aucune carte ». L'interrogation continue alors avec le joueur suivant.
        </li>
        <li>
          <strong>Hypothèse falsifiée (1 fois par partie, 2 fois à 5 ou 6 joueurs)</strong> — juste après l'hypothèse d'un autre joueur, le complice peut modifier un seul de ses trois éléments
          avant qu'elle soit annoncée. Les autres joueurs voient la version modifiée ; l'auteur, lui, voit toujours sa version originale et n'est pas prévenu.
          Les cartes à montrer restent calculées sur la version originale.
        </li>
      </ul>
      <p>Une accusation finale ne peut jamais être falsifiée. Ces pouvoirs sont ceux du mode « Classique ».</p>

      <h3>Mode « Complice rusé » (recommandé)</h3>
      <p>
        L'hôte choisit le mode dans le salon d'attente. En mode rusé, le complice dispose d'une <strong>réserve de ruses</strong> (2 à 3 joueurs, 4 à 4 joueurs,
        5 à 5 ou 6 joueurs). Chaque ruse a un coût :
      </p>
      <ul>
        <li>
          <strong>Mensonge (1)</strong> — interrogé, il répond « aucune carte » alors qu'il en a une.
        </li>
        <li>
          <strong>Carte empruntée (2)</strong> — interrogé, il montre une carte de l'hypothèse qu'il ne possède pas (jamais celle du meurtrier). Comme il ignore le
          lieu et l'arme, la carte peut être innocente… ou faire partie de la solution.
        </li>
        <li>
          <strong>Hypothèse falsifiée (1)</strong> — comme en mode classique.
        </li>
        <li>
          <strong>Dossier trafiqué (1)</strong> — en consultant un dossier d'archives, il lit le vrai indice mais le remplace par un faux pour tous ceux qui
          l'ouvriront ensuite. Le faux indice est toujours faux : il finit par contredire les autres informations.
        </li>
      </ul>
      <p>
        <strong>Les empreintes.</strong> Une ruse peut laisser une empreinte, publiée une ou deux manches plus tard : « L'empreinte n'appartient pas à X ». Une
        empreinte est toujours vraie et innocente un joueur. En les recoupant, on peut identifier le complice. Elles sont plus rares à 3 et 4 joueurs.
      </p>
      <p>
        <strong>Dénoncer le complice (1 PA).</strong> Chaque joueur peut, une fois par partie et pendant son tour, désigner le complice. Si c'est juste, le complice est
        démasqué devant tous et perd toutes ses ruses (il continue de jouer et répond honnêtement). Si c'est faux, le dénonciateur perd son prochain tour. La victoire
        reste la même : trouver le meurtrier, le lieu et l'arme.
      </p>
      <p className="muet">
        Indices de supercherie : deux joueurs qui montrent la même carte, un indice qui contredit tous les autres, une hypothèse dont les réponses semblent
        incohérentes… Croisez vos informations dans la discussion !
      </p>

      <h3>L'accusation finale</h3>
      <p>
        Si les trois éléments sont justes, les enquêteurs gagnent immédiatement. Sinon, vous ne pourrez plus accuser — mais vous continuez à jouer, à interroger et à
        être interrogé. Vous n'apprenez pas quel élément était faux.
      </p>
      <p>
        <strong>Le complice ne peut pas formuler d'accusation finale.</strong> Les autres joueurs ne le voient pas : pour eux, il semble simplement ne pas
        encore avoir accusé.
      </p>

      <h3>Indices</h3>
      <p>
        Des indices sont versés au dossier public au début de la partie et en cours de partie. D'autres dorment dans les archives. Tous les indices sont vrais et
        cohérents entre eux : aucun n'exclut la vraie solution.
      </p>
    </div>
  );
}

export function ModaleRegles({ onFermer, vue }: { onFermer: () => void; vue?: VueJoueur }) {
  const [section, setSection] = useState<'regles' | 'dossier'>('regles');
  return (
    <Modale titre="Règles du jeu" onFermer={onFermer} pied={<button className="btn btn-or" onClick={onFermer}>Compris</button>}>
      <div className="ligne" role="tablist" aria-label="Sections des règles" style={{ marginBottom: 12 }}>
        <button role="tab" aria-selected={section === 'regles'} className={`btn btn-petit ${section === 'regles' ? 'btn-or' : ''}`} onClick={() => setSection('regles')}>
          Règles
        </button>
        <button role="tab" aria-selected={section === 'dossier'} className={`btn btn-petit ${section === 'dossier' ? 'btn-or' : ''}`} onClick={() => setSection('dossier')}>
          Le dossier de l'affaire
        </button>
      </div>
      {section === 'regles' ? (
        <ContenuRegles />
      ) : (
        <>
          <p className="muet petit">Fiches des six suspects, des six lieux et des six armes : histoires, mobiles, secrets et alibis déclarés.</p>
          <Dossier vue={vue} />
        </>
      )}
    </Modale>
  );
}
