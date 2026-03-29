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
    // Packages Node natifs (binaires .node) — ne pas bundler, require() au runtime
    serverComponentsExternalPackages: ['@node-rs/argon2', 'bcryptjs'],

    // Restreint les Server Actions au domaine de production uniquement (anti-CSRF)
    serverActions: {
      allowedOrigins: [
        process.env.NEXT_PUBLIC_SITE_URL?.replace(/^https?:\/\//, '') ?? '',
        'localhost:3000',
      ].filter(Boolean),
    },
    // Tree-shaking agressif — réduit le bundle JS client
    optimizePackageImports: ['lucide-react', 'framer-motion'],
  },

  webpack(config, { isServer }) {
    if (!isServer) {
      // 'sharp' et ses dépendances Node natives ne peuvent pas être bundlés pour le browser.
      // html-to-docx n'en a pas besoin pour l'usage client de base, on les remplace donc par
      // des modules vides pour éviter que webpack tente de suivre ces imports.
      config.resolve.alias = {
        ...(config.resolve.alias || {}),
        sharp: false,
        'detect-libc': false,
        'node:child_process': false,
        'node:crypto': false,
        'node:events': false,
      };
      config.resolve.fallback = {
        ...config.resolve.fallback,
        sharp: false,
        'detect-libc': false,
        child_process: false,
        crypto: false,
        events: false,
        fs: false,
        os: false,
        path: false,
        stream: false,
        util: false,
        zlib: false,
      };
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
