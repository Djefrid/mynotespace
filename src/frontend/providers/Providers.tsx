/**
 * ============================================================================
 * PROVIDERS GLOBAUX — components/Providers.tsx
 * ============================================================================
 *
 * Composant Client qui enveloppe toute l'application mynotespace avec les
 * providers de contexte nécessaires.
 *
 * Ordre des providers (de l'extérieur vers l'intérieur) :
 *   ThemeProvider  — gestion du thème clair/sombre (next-themes)
 *     {children}   — contenu de l'application (pages)
 *
 * Service Worker PWA :
 *   Enregistré au montage côté client pour activer l'installation mobile.
 *   Silencieux si navigateur ne supporte pas les SW (ex: Safari <= 11.1).
 * ============================================================================
 */

'use client';

import { ReactNode, useEffect } from 'react';
import { ThemeProvider } from 'next-themes';
import { SessionProvider } from 'next-auth/react';

/**
 * Enveloppe l'application avec ThemeProvider.
 * @param children - Le contenu de l'application (pages, layouts)
 */
export default function Providers({ children }: { children: ReactNode }) {

  /**
   * Enregistre le Service Worker PWA au montage (côté client uniquement).
   * Requis par Chrome pour afficher le bouton d'installation de la PWA.
   * Silencieux en cas d'erreur.
   */
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .catch(() => { /* silencieux — SW optionnel */ });
    }
  }, []);

  return (
    // ThemeProvider : gestion du mode sombre/clair via next-themes
    // defaultTheme="system" : respecte la préférence de l'OS par défaut
    // enableSystem={true} : suit prefers-color-scheme si aucun choix explicite
    <SessionProvider>
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem={true}>
        {children}
      </ThemeProvider>
    </SessionProvider>
  );
}
