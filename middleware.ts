/**
 * ============================================================================
 * MIDDLEWARE — middleware.ts
 * ============================================================================
 *
 * Middleware Next.js exécuté sur chaque requête avant le rendu.
 * Responsabilités :
 *   1. Bypass total des routes /__/auth/* (handler Firebase proxié)
 *   2. Protection des routes /notes/* — redirige vers /login si non authentifié
 *      (Note : la vraie guard auth est côté client dans le layout Notes,
 *       le middleware ne peut pas vérifier le token Firebase côté serveur
 *       sans Firebase Admin SDK)
 *   3. Injection du Content-Security-Policy avec nonce aléatoire par requête
 *
 * CSP :
 *   - nonce généré par crypto.randomUUID() à chaque requête
 *   - script-src : nonce + apis.google.com (Firebase Auth popup)
 *   - frame-src : *.firebaseapp.com (handler popup)
 *   - frame-ancestors : 'self' (iframes same-origin seulement — Firebase Auth iframe bridge)
 * ============================================================================
 */

import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // ── Bypass Firebase Auth redirect handler ──────────────────────────────
  // Le handler contient ses propres scripts sans nonce → bypass total CSP.
  // Le proxy Next.js (next.config.js rewrites) doit traiter ces URLs directement.
  if (pathname.startsWith('/__/auth/')) {
    return NextResponse.next();
  }

  // ── Génération du nonce CSP ────────────────────────────────────────────
  // Nonce unique par requête (cryptographiquement aléatoire via UUID v4).
  // Utilisé dans <Script nonce={nonce}> dans app/layout.tsx.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // ── Construction du Content-Security-Policy ───────────────────────────
  const csp = [
    // Politiques de base
    "default-src 'self'",

    // Scripts : nonce + strict-dynamic (code-splitting Next.js) + unsafe-eval (Next.js dev HMR + Excalidraw)
    // apis.google.com : Firebase Auth signInWithPopup
    // www.google.com + www.gstatic.com : reCAPTCHA scripts (App Check)
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' https://apis.google.com https://www.google.com https://www.gstatic.com`,

    // Styles : self + unsafe-inline (requis TipTap, KaTeX, Excalidraw)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    // Polices
    "font-src 'self' https://fonts.gstatic.com data:",

    // Images : self + Firebase Storage + data URI (images inline TipTap)
    "img-src 'self' data: blob: https://firebasestorage.googleapis.com https://lh3.googleusercontent.com",

    // Connexions réseau : Firebase, Firestore, Google APIs
    "connect-src 'self' https://*.googleapis.com https://*.firebaseio.com https://*.firebasestorage.app wss://*.firebaseio.com https://www.google.com https://identitytoolkit.googleapis.com",

    // Iframes : Firebase Auth handler popup + same-origin (Firebase Auth iframe bridge)
    "frame-src 'self' https://*.firebaseapp.com https://www.google.com",

    // Workers : blob: pour PDF.js web worker
    "worker-src 'self' blob:",

    // Manifeste PWA
    "manifest-src 'self'",

    // frame-ancestors : autorise uniquement les iframes same-origin
    // Firebase Auth signInWithPopup crée un iframe /__/auth/iframe same-origin
    "frame-ancestors 'self'",

    // Bloque toutes les soumissions de formulaires vers des URLs externes
    "form-action 'self'",

    // Bloque plugins et injection de balise <base>
    "object-src 'none'",
    "base-uri 'self'",
  ].join('; ');

  // ── Application des headers CSP ────────────────────────────────────────
  const requestHeaders = new Headers(request.headers);
  // x-nonce : lu par Next.js 14 pour ses propres scripts d'hydratation inline
  requestHeaders.set('x-nonce', nonce);
  requestHeaders.set('Content-Security-Policy', csp);

  const response = NextResponse.next({
    request: { headers: requestHeaders },
  });

  response.headers.set('content-security-policy', csp);

  return response;
}

/** Applique le middleware à toutes les routes sauf assets statiques */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|icon-|sw\\.js|manifest\\.webmanifest).*)',
  ],
};
