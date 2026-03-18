/**
 * ============================================================================
 * LAYOUT RACINE — app/layout.tsx
 * ============================================================================
 *
 * Layout racine Next.js App Router — enveloppe toutes les pages.
 * Applique les métadonnées globales, les polices, et les providers.
 *
 * Accessibilité :
 *   Skip link WCAG 2.4.1 : lien "Aller au contenu principal" pour navigation clavier.
 * ============================================================================
 */

import type { Metadata, Viewport } from 'next';
import { Inter } from 'next/font/google';
import { headers } from 'next/headers';
import Providers from '@/components/Providers';
import './globals.css';

/** Police Inter — auto-hébergée via next/font (aucune requête Google Fonts runtime) */
const inter = Inter({ subsets: ['latin'] });

/** Métadonnées SEO et PWA */
export const metadata: Metadata = {
  title: 'mynotespace',
  description: 'Éditeur de notes riche — dossiers, tags, dessin, LaTeX, import/export DOCX/PDF',
  applicationName: 'mynotespace',
  keywords: ['notes', 'éditeur', 'markdown', 'tiptap', 'pwa'],
  authors: [{ name: 'djefrid' }],
  // OpenGraph
  openGraph: {
    title: 'mynotespace',
    description: 'Éditeur de notes riche personnel',
    type: 'website',
  },
};

/** Configuration du viewport et de la couleur de thème */
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#eab308', // Jaune accent mynotespace
};

/**
 * Layout racine — enveloppe tout avec les providers globaux.
 * @param children - Le contenu des pages enfants
 */
export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Force le rendu dynamique (par requête) — REQUIS pour la CSP nonce-based.
  // Sans ça, Next.js sert un HTML statique en cache dont les scripts n'ont pas
  // le nonce de la requête courante → CSP bloque tous les scripts en prod.
  // Le nonce lui-même est injecté automatiquement par Next.js via le header x-nonce
  // que le middleware a posé sur la requête. (headers() est synchrone en Next.js 14)
  headers();

  return (
    <html lang="fr" suppressHydrationWarning>
      {/*
        suppressHydrationWarning sur <html> est requis par next-themes :
        next-themes ajoute la classe "dark" sur <html> côté client,
        ce qui crée une différence entre le HTML serveur et le HTML client.
        suppressHydrationWarning évite les warnings React pour ce cas précis.
      */}
      <body className={inter.className}>
        {/* Skip link WCAG 2.4.1 : accessible au clavier (Tab → visible) */}
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-blue-600 focus:text-white focus:rounded-lg focus:shadow-lg"
        >
          Aller au contenu principal
        </a>

        {/* Providers globaux : ThemeProvider + enregistrement SW */}
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
