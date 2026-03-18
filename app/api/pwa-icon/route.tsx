/**
 * ============================================================================
 * ROUTE API — Icônes PWA dynamiques
 * ============================================================================
 * GET /api/pwa-icon?size=192 → PNG 192×192
 * GET /api/pwa-icon?size=512 → PNG 512×512
 * Design : page/carnet + coin replié jaune + lignes grises + "MNS" serif bold.
 * Police : Playfair Display Bold chargée dynamiquement depuis Google Fonts.
 *
 * Safe zone maskable (best practice PWA) :
 *   - Tout contenu visuel doit rester dans 80% du centre de l'icône
 *   - Notre page à 60% de largeur centrée → ✓ dans la zone sûre
 *   - Padding additionnel appliqué sur l'icône 512px (purpose: maskable)
 * ============================================================================
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = parseInt(searchParams.get('size') ?? '192', 10);

  /* Dimensions proportionnelles — page à 56% pour respecter la safe zone maskable */
  const iconW = Math.round(size * 0.56);
  const iconH = Math.round(size * 0.67);
  const radius = Math.round(size * 0.08);
  const fontSize = Math.round(size * 0.19);
  const lineW = Math.round(iconW * 0.65);
  const lineH = Math.max(1, Math.round(size * 0.01));
  const lineGap = Math.round(size * 0.025);
  const lineMargin = Math.round(size * 0.045);

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
      <div style={{ width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center', background: '#0d0d0d', borderRadius: radius }}>
        <div style={{ position: 'relative', width: `${iconW}px`, height: `${iconH}px`, display: 'flex' }}>
          {/* Page SVG avec coin replié jaune */}
          <svg width={iconW} height={iconH} viewBox="0 0 22 26" fill="none">
            <path d="M 0 0 L 14 0 L 22 8 L 22 26 L 0 26 Z" fill="#e8e8e8" />
            <path d="M 14 0 L 22 8 L 14 8 Z" fill="#eab308" />
          </svg>
          {/* Overlay colonne : lignes grises + MNS + lignes grises */}
          <div style={{ position: 'absolute', top: '0', left: '0', width: `${iconW}px`, height: `${iconH}px`, display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            {/* Lignes grises au-dessus — simulent des lignes d'écriture */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${lineGap}px`, width: `${lineW}px`, marginBottom: `${lineMargin}px` }}>
              <div style={{ height: `${lineH}px`, background: 'rgba(110,110,110,0.40)', borderRadius: '1px', width: '100%' }}></div>
              <div style={{ height: `${lineH}px`, background: 'rgba(110,110,110,0.30)', borderRadius: '1px', width: '78%' }}></div>
              <div style={{ height: `${lineH}px`, background: 'rgba(110,110,110,0.22)', borderRadius: '1px', width: '88%' }}></div>
            </div>
            {/* Texte MNS — Playfair Display Bold bleu italique */}
            <div style={{ fontSize: `${fontSize}px`, fontWeight: 700, fontFamily: fontData ? 'Playfair' : 'serif', color: '#2563eb', letterSpacing: '-2px', transform: 'skewX(-12deg)', display: 'flex' }}>
              MNS
            </div>
            {/* Lignes grises en dessous */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: `${lineGap}px`, width: `${lineW}px`, marginTop: `${lineMargin}px` }}>
              <div style={{ height: `${lineH}px`, background: 'rgba(110,110,110,0.22)', borderRadius: '1px', width: '88%' }}></div>
              <div style={{ height: `${lineH}px`, background: 'rgba(110,110,110,0.30)', borderRadius: '1px', width: '78%' }}></div>
              <div style={{ height: `${lineH}px`, background: 'rgba(110,110,110,0.40)', borderRadius: '1px', width: '100%' }}></div>
            </div>
          </div>
        </div>
      </div>
    ),
    {
      width: size,
      height: size,
      ...(fontData ? { fonts: [{ name: 'Playfair', data: fontData, weight: 700 }] } : {}),
    },
  );
}
