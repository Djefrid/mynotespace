/**
 * ============================================================================
 * FAVICON — app/icon.tsx
 * ============================================================================
 *
 * Icône navigateur (favicon) 32×32 — générée via ImageResponse (satori).
 * Design simplifié (best practice 32px) : page + coin jaune + "MNS" bold.
 * Les lignes décoratives sont supprimées à cette taille (invisibles < 48px).
 * Police : Playfair Display Bold chargée depuis Google Fonts.
 * ============================================================================
 */

import { ImageResponse } from 'next/og';

export const size = { width: 32, height: 32 };
export const contentType = 'image/png';

export default async function Icon() {
  /* Chargement de la police Playfair Display Bold depuis Google Fonts */
  const css = await fetch(
    'https://fonts.googleapis.com/css2?family=Playfair+Display:wght@700&display=swap',
    { headers: { 'User-Agent': 'Mozilla/5.0' } }
  ).then(r => r.text());

  /* Extraction de l'URL woff2 dans la réponse CSS */
  const fontUrl = css.match(/src: url\((.+?)\) format\('woff2'\)/)?.[1];
  const fontData = fontUrl
    ? await fetch(fontUrl).then(r => r.arrayBuffer())
    : null;

  return new ImageResponse(
    (
      /* Conteneur principal — fond sombre arrondi */
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e40af', borderRadius: '5px' }}>
        {/* Wrapper relatif pour superposer SVG + texte */}
        <div style={{ position: 'relative', width: '22px', height: '26px', display: 'flex' }}>
          {/* Page SVG avec coin replié jaune */}
          <svg width="22" height="26" viewBox="0 0 22 26" fill="none">
            <path d="M 0 0 L 14 0 L 22 8 L 22 26 L 0 26 Z" fill="#e8e8e8" />
            <path d="M 14 0 L 22 8 L 14 8 Z" fill="#3b82f6" />
          </svg>
          {/* "MNS" centré — design simplifié pour 32px (pas de lignes, trop petites) */}
          <div style={{ position: 'absolute', top: '0', left: '0', width: '22px', height: '26px', display: 'flex', justifyContent: 'center', alignItems: 'center', fontSize: '7px', fontWeight: 700, fontFamily: fontData ? 'Playfair' : 'serif', color: '#2563eb', letterSpacing: '-0.3px', transform: 'skewX(-12deg)' }}>
            MNS
          </div>
        </div>
      </div>
    ),
    {
      ...size,
      ...(fontData ? { fonts: [{ name: 'Playfair', data: fontData, weight: 700 }] } : {}),
    },
  );
}
