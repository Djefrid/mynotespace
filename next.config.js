// ============================================================================
// CONFIGURATION NEXT.JS — next.config.js
// ============================================================================
//
// Configuration de l'application mynotespace.
//
// Headers de sécurité :
//   Le CSP nonce-based est géré dans middleware.ts.
//   Ici : HSTS, COOP, Referrer-Policy, Permissions-Policy.
// ============================================================================

/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'standalone',

  // Retire le header "X-Powered-By: Next.js" — évite de révéler la stack aux attaquants
  poweredByHeader: false,

  experimental: {
    // Restreint les Server Actions au domaine de production uniquement (anti-CSRF)
    serverActions: {
      allowedOrigins: ['notes.djefrid.ca', 'localhost:3000'],
    },
    // Tree-shaking agressif — réduit le bundle JS client
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      // 'sharp' est un module natif Node.js — il ne peut pas être bundlé pour le browser.
      // @turbodocx/html-to-docx l'importe conditionnellement mais webpack essaie quand même
      // de le résoudre côté client. On le déclare externe (false = module vide).
      config.resolve.fallback = { ...config.resolve.fallback, sharp: false };
    }
    return config;
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
          // Autorise les popups Google OAuth
          { key: 'Cross-Origin-Opener-Policy', value: 'same-origin-allow-popups' },
          // Anti-clickjacking (complément défense en profondeur au CSP frame-ancestors)
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

module.exports = nextConfig;
