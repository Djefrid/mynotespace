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
import type { NextRequest } from 'next/server';
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

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

export async function middleware(request: NextRequest) {
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
  const csp = [
    // Politiques de base
    "default-src 'self'",

    // Scripts : nonce + strict-dynamic (code-splitting Next.js) + unsafe-eval (Next.js dev HMR + Excalidraw)
    // apis.google.com : Google OAuth popup
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval' 'sha256-c5Gm1Iytmxlbm7sLzBSUu/dpFv9EWweQTfDc8mG3PME=' 'sha256-rbbnijHn7DZ6ps39myQ3cVQF1H+U/PJfHh5ei/Q2kb8=' https://apis.google.com https://www.google.com https://www.gstatic.com`,

    // Styles : self + unsafe-inline (requis TipTap, KaTeX, Excalidraw)
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",

    // Polices
    "font-src 'self' https://fonts.gstatic.com data:",

    // Images : self + R2 (assets) + Google avatar + data URI
    "img-src 'self' data: blob: https://assets.djefrid.ca https://lh3.googleusercontent.com",

    // Connexions réseau : Auth.js, R2 (upload presigned PUT direct depuis le browser)
    "connect-src 'self' https://www.google.com https://*.r2.cloudflarestorage.com",

    // Iframes : Google OAuth
    "frame-src 'self' https://www.google.com",

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
}

/** Applique le middleware à toutes les routes sauf assets statiques */
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|icon-|sw\\.js|manifest\\.webmanifest).*)',
  ],
};
