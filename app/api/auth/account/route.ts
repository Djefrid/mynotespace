import { prisma } from '@/src/backend/db/prisma';
import { requireSession } from '@/src/backend/auth/session';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';

// ─── DELETE /api/auth/account ─────────────────────────────────────────────────
// Supprime le compte, les workspaces (cascade → notes, dossiers, tags, fichiers),
// puis l'utilisateur.

export async function DELETE() {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = await checkRateLimit('auth', userId);
  if (!limit.success) return rateLimitResponse(limit.reset);

  try {
    // Les workspaces cascadent vers Note, Folder, Tag, Attachment, WorkspaceMember
    await prisma.workspace.deleteMany({ where: { ownerUserId: userId } });
    await prisma.user.delete({ where: { id: userId } });

    return Response.json({ data: { success: true } });
  } catch (err) {
    console.error('[DELETE /api/auth/account]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
