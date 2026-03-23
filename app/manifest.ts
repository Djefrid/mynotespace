/**
 * ============================================================================
 * MANIFEST PWA — app/manifest.ts
 * ============================================================================
 *
 * Manifeste de l'application web progressive (PWA) pour mynotespace.
 * Permet l'installation sur mobile (iOS/Android) et desktop (Chrome/Edge).
 *
 * Pour qu'une PWA soit installable par Chrome, il faut :
 *   1. Ce fichier manifest.ts (Next.js le sert à /manifest.webmanifest)
 *   2. Un Service Worker enregistré (public/sw.js via Providers.tsx)
 *   3. Le site servi en HTTPS (ou localhost)
 *
 * Icônes requises :
 *   - /icon-192.png : icône principale (192×192 px)
 *   - /icon-512.png : icône haute résolution (512×512 px)
 * ============================================================================
 */

import type { MetadataRoute } from 'next';

/**
 * Retourne le manifeste PWA de mynotespace.
 * Next.js sert automatiquement ce fichier à /manifest.webmanifest.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    // Nom complet affiché lors de l'installation
    name: 'MyNoteSpace',
    // Nom court affiché sous l'icône sur l'écran d'accueil
    short_name: 'notespace',
    // Description de l'application
    description: 'Éditeur de notes riche — dossiers, tags, dessin, LaTeX',
    // URL de démarrage (page principale de l'app)
    start_url: '/notes',
    // display standalone : plein écran sans barre d'adresse (expérience native)
    display: 'standalone',
    // Orientation : any (portrait et paysage selon l'appareil)
    orientation: 'any',
    // Couleur de fond pendant le splash screen au démarrage
    background_color: '#0d0d0d',
    // Couleur de la barre de statut (Android)
    theme_color: '#3b82f6',
    // Catégorie pour les app stores PWA
    categories: ['productivity', 'utilities'],
    // Icônes pour l'écran d'accueil et le splash screen
    icons: [
      {
        // Icône générée dynamiquement via /api/pwa-icon?size=192
        src: '/api/pwa-icon?size=192',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        // Icône générée dynamiquement via /api/pwa-icon?size=512
        src: '/api/pwa-icon?size=512',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Captures d'écran optionnelles (améliore l'install prompt sur Chrome Android)
    screenshots: [],
  };
}
