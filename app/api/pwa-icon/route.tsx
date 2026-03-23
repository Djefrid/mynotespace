/**
 * ============================================================================
 * ROUTE API — Icônes PWA dynamiques
 * ============================================================================
 * GET /api/pwa-icon?size=192 → PNG 192×192
 * GET /api/pwa-icon?size=512 → PNG 512×512
 * Design : carré bleu arrondi + 3 lignes blanches horizontales
 *          (identique au logo de la navbar landing page)
 * ============================================================================
 */

import { ImageResponse } from 'next/og';
import { NextRequest } from 'next/server';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const size = parseInt(searchParams.get('size') ?? '192', 10);

  /* Safe zone maskable : contenu dans 80% central */
  const padding = Math.round(size * 0.1);
  const inner   = size - padding * 2;
  const radius  = Math.round(inner * 0.25);

  /* Lignes horizontales — proportionnelles */
  const lineH   = Math.max(2, Math.round(size * 0.035));
  const lineR   = lineH;
  const gap     = Math.round(size * 0.065);
  const line1W  = Math.round(inner * 0.65);
  const line2W  = Math.round(inner * 0.48);
  const line3W  = Math.round(inner * 0.57);

  return new ImageResponse(
    (
      <div
        style={{
          width: size, height: size,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          background: 'transparent',
        }}
      >
        {/* Carré bleu arrondi */}
        <div
          style={{
            width: inner, height: inner,
            borderRadius: radius,
            background: '#3b82f6',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'flex-start',
            justifyContent: 'center',
            paddingLeft: Math.round(inner * 0.22),
            gap: gap,
          }}
        >
          {/* Ligne 1 — longue */}
          <div style={{ width: line1W, height: lineH, background: 'white', borderRadius: lineR, display: 'flex' }} />
          {/* Ligne 2 — courte */}
          <div style={{ width: line2W, height: lineH, background: 'white', borderRadius: lineR, display: 'flex' }} />
          {/* Ligne 3 — moyenne */}
          <div style={{ width: line3W, height: lineH, background: 'white', borderRadius: lineR, display: 'flex' }} />
        </div>
      </div>
    ),
    { width: size, height: size },
  );
}
