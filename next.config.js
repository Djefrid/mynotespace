// ============================================================================
// CONFIGURATION NEXT.JS — next.config.js
// ============================================================================
//
// Configuration de l'application mynotespace.
//
// Proxy Firebase Auth :
//   Redirige /__/auth/* vers firebaseapp.com pour que signInWithRedirect
//   fonctionne en same-origin sur mobile (Safari iOS, Chrome Android).
//   Prérequis : ajouter https://notes.djefrid.ca/__/auth/handler dans les
//   Authorized redirect URIs du client OAuth dans Google Cloud Console.
//
// Headers de sécurité :
//   Le CSP nonce-based est géré dans middleware.ts.
//   Ici : HSTS, COOP, Referrer-Policy, Permissions-Policy.
// ============================================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  /**
   * optimizePackageImports : Next.js analyse les imports des packages listés et
   * n'inclut que les exports réellement utilisés dans le bundle (tree-shaking agressif).
   * Réduit le bundle JS client, notamment pour lucide-react (600+ icônes non utilisées).
   */
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  /**
   * Proxy transparent pour Firebase Auth redirect flow.
   * Same-origin cookies → getRedirectResult() fonctionne sur mobile.
   */
  async rewrites() {
    const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'portfolio-8d07b';
    return {
      beforeFiles: [
        {
          source: '/__/auth/:path*',
          destination: `https://${projectId}.firebaseapp.com/__/auth/:path*`,
        },
      ],
    };
  },

  async headers() {
    return [
      {
        source: '/(.*)',
        headers: [
          // Empêche le MIME-sniffing
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          // Force HTTPS 2 ans
          { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
          // Contrôle les informations Referer
          { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
          // Désactive les API matérielles non utilisées
          { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=(), interest-cohort=()' },
          // DNS prefetch
          { key: 'X-DNS-Prefetch-Control', value: 'on' },
          // Autorise les popups Firebase OAuth (signInWithPopup desktop)
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
