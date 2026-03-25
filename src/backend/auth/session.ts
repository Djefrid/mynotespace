import 'server-only';

import { MemberRole } from '@prisma/client';
import { auth } from './auth';
import { prisma } from '@/src/backend/db/prisma';

/**
 * Retourne la session Auth.js côté serveur (Server Components, Route Handlers).
 * Retourne null si non authentifié.
 */
export async function getServerSession() {
  return auth();
}

/**
 * Retourne le workspaceId de l'utilisateur connecté.
 * Lance une erreur si non authentifié — à utiliser dans des contextes protégés.
 */
export async function requireWorkspaceId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.workspaceId) {
    throw new Error('Unauthorized');
  }
  return session.user.workspaceId;
}

/**
 * Retourne { userId, workspaceId } de l'utilisateur connecté.
 * Lance une erreur si non authentifié.
 */
export async function requireSession(): Promise<{ userId: string; workspaceId: string }> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.workspaceId) {
    throw new Error('Unauthorized');
  }
  return { userId: session.user.id, workspaceId: session.user.workspaceId };
}

/**
 * Retourne { userId, workspaceId, role } en chargeant le rôle depuis WorkspaceMember.
 *
 * À utiliser dans les routes qui nécessitent un contrôle de rôle (mutations sensibles).
 * Charge le rôle depuis la DB à chaque appel — les changements de rôle sont donc
 * effectifs immédiatement sans attendre l'expiration du JWT.
 *
 * Lance une erreur si non authentifié ou si l'utilisateur n'est pas membre du workspace.
 */
export async function requireRole(): Promise<{
  userId:      string;
  workspaceId: string;
  role:        MemberRole;
}> {
  const session = await auth();
  if (!session?.user?.id || !session?.user?.workspaceId) {
    throw new Error('Unauthorized');
  }

  const { id: userId, workspaceId } = session.user;

  const member = await prisma.workspaceMember.findUnique({
    where:  { workspaceId_userId: { workspaceId, userId } },
    select: { role: true },
  });

  if (!member) throw new Error('Forbidden');

  return { userId, workspaceId, role: member.role };
}