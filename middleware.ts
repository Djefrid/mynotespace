/**
 * ============================================================================
 * MIDDLEWARE — middleware.ts
 * ============================================================================
 *
 * Middleware Next.js exécuté sur chaque requête avant le rendu.
 * Responsabilités :
 *   1. Rate-limit brute-force sur POST /api/auth/signin (10 req / 15 min par IP)
 *   2. Injection du Content-Security-Policy avec nonce aléatoire par requête
 *
 * CSP :
 *   - nonce généré par crypto.randomUUID() à chaque requête
 *   - script-src : nonce + apis.google.com (Google OAuth popup)
 *   - frame-src : www.google.com (Google OAuth)
 *   - frame-ancestors : 'self' (iframes same-origin seulement)
 * ============================================================================
 */

import { NextResponse } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';
import NextAuth from 'next-auth';
import { authConfig } from '@/src/backend/auth/auth.config';

// ── Routes protégées (pages authentifiées) ────────────────────────────────────
const PROTECTED_PATHS = ['/notes', '/profile'];
const { auth } = NextAuth(authConfig);

// ── Rate-limit login : 10 tentatives / 15 min par IP ──────────────────────────
// Instancié une seule fois au niveau module (edge singleton par invocation froide).
// Fail-open si les vars d'env sont absentes (dev local sans Redis).
function getLoginRatelimit(): Ratelimit | null {
  const url   = process.env.UPSTASH_REDIS_REST_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN;
  if (!url || !token) return null;
  return new Ratelimit({
    redis:   new Redis({ url, token }),
    limiter: Ratelimit.slidingWindow(10, '15 m'),
    prefix:  'rl:login',
  });
}

export default auth(async function middleware(request) {
  const { pathname } = request.nextUrl;

  // ── Protection SSR des routes authentifiées ───────────────────────────
  // Redirige vers /login avant tout rendu si le JWT est absent ou expiré.
  if (PROTECTED_PATHS.some(p => pathname.startsWith(p)) && !request.auth) {
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // ── Rate-limit brute-force sur le login ───────────────────────────────
  if (request.method === 'POST' && request.nextUrl.pathname === '/api/auth/signin') {
    try {
      const limiter = getLoginRatelimit();
      if (limiter) {
        const ip = request.ip
          ?? request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
          ?? 'unknown';
        const { success, reset } = await limiter.limit(ip);
        if (!success) {
          const retryAfter = Math.max(0, Math.ceil((reset - Date.now()) / 1000));
          return new NextResponse(
            JSON.stringify({ error: 'Trop de tentatives — réessayez dans quelques minutes.' }),
            {
              status: 429,
              headers: {
                'Content-Type':  'application/json',
                'Retry-After':   String(retryAfter),
              },
            },
          );
        }
      }
    } catch {
      // Fail-open : Redis indisponible → on laisse passer
    }
  }

  // ── Génération du nonce CSP ────────────────────────────────────────────
  // Nonce unique par requête (cryptographiquement aléatoire via UUID v4).
  // Utilisé dans <Script nonce={nonce}> dans app/layout.tsx.
  const nonce = Buffer.from(crypto.randomUUID()).toString('base64');

  // ── Construction du Content-Security-Policy ───────────────────────────
  // R2_PUBLIC_URL : domaine custom R2 (ex: https://assets.djefrid.ca)
  // Fallback sur *.r2.cloudflarestorage.com si la variable est absente (dev sans config)
  const r2PublicUrl = process.env.R2_PUBLIC_URL?.replace(/\/$/, '') ?? '';
  const r2ImgSrc   = r2PublicUrl || 'https://*.r2.cloudflarestorage.com';

  const csp = [
    // Politiques de base
    "default-src 'self'",

    // Scripts : nonce + strict-dynamic (code-splitting Next.js) + unsafe-eval (Next.js dev HMR + Excalidraw)
    // apis.google.com : Google OAuth popup
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' 'sha256-c5Gm1Iytmxlbm7sLzBSUu/dpFv9EWweQTfDc8mG3PME=' 'sha256-rbbnijHn7DZ6ps39myQ3cVQF1H+U/PJfHh5ei/Q2kb8=' 'sha256-/KN0/03EYPY1SuWz9KFP9s36ubZrjCFj1IsX7zorIL0=' https://apis.google.com https://www.google.com https://www.gstatic.com https://vercel.live`,

    // Styles : self + unsafe-inline (requis TipTap, KaTeX, Excalidraw)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    // Polices
    "font-src 'self' https://fonts.gstatic.com data:",

    // Images : self + R2 (domaine dynamique depuis R2_PUBLIC_URL) + Google avatar + data URI
    `img-src 'self' data: blob: ${r2ImgSrc} https://lh3.googleusercontent.com`,

    // Connexions réseau : Auth.js, R2 (upload presigned PUT direct depuis le browser), Vercel toolbar
    "connect-src 'self' https://www.google.com https://*.r2.cloudflarestorage.com https://vercel.live wss://ws-us3.pusher.com",

    // Iframes : Google OAuth + Vercel toolbar
    "frame-src 'self' https://www.google.com https://vercel.live",

    // Workers : blob: pour PDF.js web worker
    "worker-src 'self' blob:",

    // Manifeste PWA
    "manifest-src 'self'",

    // frame-ancestors : autorise uniquement les iframes same-origin
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
});

/** Applique le middleware à toutes les routes sauf assets statiques */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|icon-|sw\\.js|manifest\\.webmanifest).*)',
  ],
};
