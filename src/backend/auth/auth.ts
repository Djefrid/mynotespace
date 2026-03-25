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
      /** Rôle dans le workspace — mis en cache dans le JWT au moment du login */
      workspaceRole: string;
      /** Timestamp Unix (secondes) d'expiry absolue de la session */
      sessionExpiresAt: number;
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
      // ── 1. Premier appel post-login ────────────────────────────────────────
      if (user?.id) {
        token.id = user.id;
        const workspaceId = await provisionPersonalWorkspace(user.id);
        token.workspaceId = workspaceId;

        // Charge le rôle depuis la DB
        const member = await prisma.workspaceMember.findUnique({
          where: { workspaceId_userId: { workspaceId, userId: user.id } },
          select: { role: true },
        });
        token.workspaceRole = member?.role ?? 'OWNER';

        // Expiry absolue : durée configurable par workspace (1–180 jours)
        const workspace = await prisma.workspace.findUnique({
          where:  { id: workspaceId },
          select: { sessionMaxAgeDays: true },
        });
        const maxAgeDays = workspace?.sessionMaxAgeDays ?? 30;
        token.sessionExpiresAt = Math.floor(Date.now() / 1000) + maxAgeDays * 86_400;
      }

      // ── 2. Appels suivants (rafraîchissement du cookie) ────────────────────
      if (!user?.id) {
        // Vérifier force-logout : si sessionsInvalidatedAt > token.iat → session révoquée
        const dbUser = await prisma.user.findUnique({
          where:  { id: token.id as string },
          select: { sessionsInvalidatedAt: true },
        });
        if (
          dbUser?.sessionsInvalidatedAt &&
          dbUser.sessionsInvalidatedAt.getTime() / 1000 > (token.iat as number)
        ) {
          return null; // Détruit la session côté serveur
        }

        // Vérifier expiry absolue
        if (
          token.sessionExpiresAt &&
          Date.now() / 1000 > (token.sessionExpiresAt as number)
        ) {
          return null;
        }
      }

      // ── 3. Mise à jour du nom (useSession().update()) ──────────────────────
      if (trigger === 'update' && session?.name !== undefined) {
        token.name = session.name;
      }

      return token;
    },
    async session({ session, token }) {
      if (token.id)               session.user.id               = token.id as string;
      if (token.workspaceId)      session.user.workspaceId      = token.workspaceId as string;
      if (token.workspaceRole)    session.user.workspaceRole    = token.workspaceRole as string;
      if (token.sessionExpiresAt) session.user.sessionExpiresAt = token.sessionExpiresAt as number;
      return session;
    },
  },
});