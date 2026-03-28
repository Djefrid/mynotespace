/**
 * ============================================================================
 * IMAGE OPENGRAPH — app/opengraph-image.tsx
 * ============================================================================
 *
 * Image Open Graph générée dynamiquement via Next.js ImageResponse (satori).
 * Affichée sur les partages réseaux sociaux (Twitter, LinkedIn, Slack…).
 *
 * Dimensions standard OG : 1200×630 px.
 * Design : fond sombre (#0d0d0d), accent primary bleu, titre + sous-titre.
 *
 * Next.js sert automatiquement cette image à /opengraph-image.png.
 * Elle est référencée dans les métadonnées openGraph.images via la convention
 * de fichier Next.js (pas besoin de la lier explicitement dans metadata).
 * ============================================================================
 */

import { ImageResponse } from 'next/og';

/** Dimensions recommandées pour l'OG image (ratio 1.91:1) */
export const size = { width: 1200, height: 630 };

/** Format PNG — compatible avec tous les réseaux sociaux */
export const contentType = 'image/png';

/**
 * Génère l'image Open Graph de MyNoteSpace.
 * Rendue côté serveur par satori (pas de dépendances client).
 */
export default function OGImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width:           '100%',
          height:          '100%',
          display:         'flex',
          flexDirection:   'column',
          alignItems:      'center',
          justifyContent:  'center',
          backgroundColor: '#0d0d0d',
          fontFamily:      'sans-serif',
          gap:             '32px',
        }}
      >
        {/* Logo carré jaune avec initiales */}
        <div
          style={{
            display:         'flex',
            alignItems:      'center',
            justifyContent:  'center',
            width:           120,
            height:          120,
            backgroundColor: '#3b82f6',
            borderRadius:    20,
          }}
        >
          <span
            style={{
              fontSize:   56,
              fontWeight: 900,
              color:      '#0d0d0d',
              letterSpacing: '-2px',
            }}
          >
            M
          </span>
        </div>

        {/* Titre principal */}
        <div
          style={{
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            gap:            '12px',
          }}
        >
          <span
            style={{
              fontSize:      72,
              fontWeight:    800,
              color:         '#ffffff',
              letterSpacing: '-2px',
            }}
          >
            MyNoteSpace
          </span>
          <span
            style={{
              fontSize:  28,
              color:     '#9ca3af',
              textAlign: 'center',
              maxWidth:  800,
            }}
          >
            Éditeur de notes riche — dossiers, tags, dessin, LaTeX
          </span>
        </div>

        {/* Barre accent jaune en bas */}
        <div
          style={{
            position:        'absolute',
            bottom:          0,
            left:            0,
            right:           0,
            height:          8,
            backgroundColor: '#3b82f6',
          }}
        />
      </div>
    ),
    { ...size }
  );
}
