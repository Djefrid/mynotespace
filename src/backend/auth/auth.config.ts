import type { NextAuthConfig } from 'next-auth';

/**
 * Config edge-safe : pas d'import Prisma ici.
 * Utilisée par le middleware et étendue dans auth.ts.
 */
export const authConfig = {
  pages: {
    signIn: '/login',
    error: '/login',
  },
  session: {
    strategy:  'jwt',
    maxAge:    30 * 24 * 60 * 60, // 30 jours (valeur par défaut ; l'expiry absolue est gérée dans le callback jwt)
    updateAge:  1 * 60 * 60,      // re-signe le cookie au maximum toutes les heures (délai max avant force-logout)
  },
  // trustHost : Auth.js v5 utilise le header x-forwarded-host (envoyé par Vercel/Cloudflare)
  // pour construire les URLs de redirection. Sans ça, Auth.js tombe en fallback sur
  // NEXTAUTH_URL (localhost:3000) et redirige vers localhost en production.
  trustHost: true,
  providers: [],
  callbacks: {
    jwt({ token, user }) {
      if (user?.id) token.id = user.id;
      return token;
    },
    session({ session, token }) {
      if (token.id) session.user.id = token.id as string;
      return session;
    },
  },
} satisfies NextAuthConfig;
