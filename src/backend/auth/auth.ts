import 'server-only';

import NextAuth from 'next-auth';
import Credentials from 'next-auth/providers/credentials';
import Google from 'next-auth/providers/google';
import { PrismaAdapter } from '@auth/prisma-adapter';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import type { DefaultSession } from 'next-auth';
import { prisma } from '@/src/backend/db/prisma';
import { authConfig } from './auth.config';
import { provisionPersonalWorkspace } from '@/src/backend/services/user-bootstrap.service';

// ── Validation des credentials (protection operator injection Prisma) ─────────
const loginSchema = z.object({
  email:    z.string().email(),
  password: z.string().min(1).max(128),
});

// ─── Type augmentation ────────────────────────────────────────────────────────

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      workspaceId: string;
    } & DefaultSession['user'];
  }
}

// ─── NextAuth instance ────────────────────────────────────────────────────────

export const { auth, signIn, signOut, handlers } = NextAuth({
  adapter: PrismaAdapter(prisma),
  ...authConfig,
  providers: [
    Google({
      clientId:     process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      credentials: {
        email:    { label: 'Email',    type: 'email'    },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const parsed = loginSchema.safeParse(credentials);
        if (!parsed.success) return null;

        const { email, password } = parsed.data;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user?.passwordHash) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        return { id: user.id, email: user.email, name: user.name ?? undefined };
      },
    }),
  ],
  callbacks: {
    /**
     * Garantit que les redirections post-signIn/signOut pointent toujours
     * vers le bon domaine — même si NEXTAUTH_URL/AUTH_URL est mal configuré.
     * baseUrl est inféré depuis les headers HTTP réels (x-forwarded-host sur Vercel).
     */
    async redirect({ url, baseUrl }) {
      if (url.startsWith('/')) return `${baseUrl}${url}`;
      if (new URL(url).origin === new URL(baseUrl).origin) return url;
      return baseUrl;
    },
    async jwt({ token, user, trigger, session }) {
      // `user` est présent uniquement lors du premier appel post-login
      if (user?.id) {
        token.id = user.id;
        token.workspaceId = await provisionPersonalWorkspace(user.id);
      }
      // Mise à jour du nom sans re-login (appellé via useSession().update())
      if (trigger === 'update' && session?.name !== undefined) {
        token.name = session.name;
      }
      return token;
    },
    async session({ session, token }) {
      if (token.id)          session.user.id          = token.id as string;
      if (token.workspaceId) session.user.workspaceId = token.workspaceId as string;
      return session;
    },
  },
});