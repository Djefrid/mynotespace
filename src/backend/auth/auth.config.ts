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
  session: { strategy: 'jwt' },
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
