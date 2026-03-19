/**
 * ============================================================================
 * APPLE TOUCH ICON — app/apple-icon.tsx
 * ============================================================================
 * Design : page/carnet + coin replié jaune + lignes grises + "MNS" (180×180).
 * Police : Playfair Display Bold chargée dynamiquement depuis Google Fonts.
 * ============================================================================
 */

import { ImageResponse } from 'next/og';

export const size = { width: 180, height: 180 };
export const contentType = 'image/png';

export default async function AppleIcon() {
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
      <div style={{ width: '100%', height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#1e40af', borderRadius: '36px' }}>
        <div style={{ position: 'relative', width: '110px', height: '130px', display: 'flex' }}>
          <svg width="110" height="130" viewBox="0 0 22 26" fill="none">
            <path d="M 0 0 L 14 0 L 22 8 L 22 26 L 0 26 Z" fill="#e8e8e8" />
            <path d="M 14 0 L 22 8 L 14 8 Z" fill="#eab308" />
          </svg>
          {/* Overlay colonne : lignes + MNS + lignes */}
          <div style={{ position: 'absolute', top: '0', left: '0', width: '110px', height: '130px', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {/* Lignes grises au-dessus */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '72px', marginBottom: '10px' }}>
              <div style={{ height: '2px', background: 'rgba(110,110,110,0.40)', borderRadius: '1px', width: '100%' }}></div>
              <div style={{ height: '2px', background: 'rgba(110,110,110,0.30)', borderRadius: '1px', width: '78%' }}></div>
              <div style={{ height: '2px', background: 'rgba(110,110,110,0.22)', borderRadius: '1px', width: '88%' }}></div>
            </div>
            {/* Texte MNS — serif bold bleu italique */}
            <div style={{ fontSize: '38px', fontWeight: 700, fontFamily: fontData ? 'Playfair' : 'serif', color: '#2563eb', letterSpacing: '-1.5px', transform: 'skewX(-12deg)', display: 'flex' }}>
              MNS
            </div>
            {/* Lignes grises en dessous */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '5px', width: '72px', marginTop: '10px' }}>
              <div style={{ height: '2px', background: 'rgba(110,110,110,0.22)', borderRadius: '1px', width: '88%' }}></div>
              <div style={{ height: '2px', background: 'rgba(110,110,110,0.30)', borderRadius: '1px', width: '78%' }}></div>
              <div style={{ height: '2px', background: 'rgba(110,110,110,0.40)', borderRadius: '1px', width: '100%' }}></div>
            </div>
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
