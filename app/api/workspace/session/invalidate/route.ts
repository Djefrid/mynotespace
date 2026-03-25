import { requireRole } from '@/src/backend/auth/session';
import { prisma } from '@/src/backend/db/prisma';
import { MemberRole } from '@prisma/client';

// ─── POST /api/workspace/session/invalidate ───────────────────────────────────
// Force la déconnexion de tous les membres du workspace en mettant à jour
// sessionsInvalidatedAt sur leur compte utilisateur.
// Le callback jwt vérifie ce champ à chaque rafraîchissement de session.
// Réservé au OWNER.

export async function POST() {
  let workspaceId: string;
  let role: MemberRole;
  let userId: string;
  try {
    ({ workspaceId, role, userId } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (role !== MemberRole.OWNER) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    // Récupère tous les membres du workspace sauf l'OWNER qui fait la requête
    const members = await prisma.workspaceMember.findMany({
      where:  { workspaceId, userId: { not: userId } },
      select: { userId: true },
    });

    const memberIds = members.map(m => m.userId);
    if (memberIds.length > 0) {
      await prisma.user.updateMany({
        where: { id: { in: memberIds } },
        data:  { sessionsInvalidatedAt: new Date() },
      });
    }

    return Response.json({ data: { invalidated: memberIds.length } });
  } catch (err) {
    console.error('[POST /api/workspace/session/invalidate]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
