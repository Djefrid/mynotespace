import 'server-only';

import { auth } from './auth';

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