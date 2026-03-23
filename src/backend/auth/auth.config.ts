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
