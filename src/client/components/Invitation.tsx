// Invitation au salon : QR code à scanner (joueurs dans la même pièce) et partage natif du lien.

import qrcode from 'qrcode-generator';
import { useMemo } from 'react';
import { Modale } from './Commun';

/** QR code en SVG (modules noirs sur fond blanc, avec la marge réglementaire de 4 modules). */
export function QrCode({ texte, taille = 240 }: { texte: string; taille?: number }) {
  const { n, d } = useMemo(() => {
    const qr = qrcode(0, 'M');
    qr.addData(texte);
    qr.make();
    const n = qr.getModuleCount();
    let d = '';
    for (let l = 0; l < n; l++) for (let c = 0; c < n; c++) if (qr.isDark(l, c)) d += `M${c + 4} ${l + 4}h1v1h-1z`;
    return { n, d };
  }, [texte]);
  return (
    <svg className="qr-code" width={taille} height={taille} viewBox={`0 0 ${n + 8} ${n + 8}`} role="img" aria-label="QR code du lien d'invitation" shapeRendering="crispEdges">
      <rect width={n + 8} height={n + 8} fill="#fff" />
      <path d={d} fill="#000" />
    </svg>
  );
}

export function ModaleQr({ lien, code, onFermer }: { lien: string; code: string; onFermer: () => void }) {
  return (
    <Modale titre="Rejoindre avec un téléphone" onFermer={onFermer}>
      <div className="qr-bloc">
        <QrCode texte={lien} />
        <p>
          Scannez ce code avec l'appareil photo du téléphone : la page du salon <strong>{code}</strong> s'ouvre, il ne reste qu'à choisir un pseudonyme.
        </p>
      </div>
    </Modale>
  );
}

/** Partage natif (WhatsApp, SMS, e-mail…) quand le navigateur le propose. */
export const partageDisponible = () => typeof navigator !== 'undefined' && typeof navigator.share === 'function';

export async function partagerInvitation(lien: string, code: string): Promise<'partage' | 'annule' | 'impossible'> {
  try {
    await navigator.share({ title: 'Dossier Secret', text: `Rejoins ma partie de Dossier Secret ! Code du salon : ${code}`, url: lien });
    return 'partage';
  } catch (e) {
    return (e as Error)?.name === 'AbortError' ? 'annule' : 'impossible';
  }
}
