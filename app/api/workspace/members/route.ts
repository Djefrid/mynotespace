import { requireRole } from '@/src/backend/auth/session';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';
import { prisma } from '@/src/backend/db/prisma';

// ─── GET /api/workspace/members ───────────────────────────────────────────────
// Liste les membres du workspace courant.
// Accessible à tous les rôles (VIEWER inclus — ils peuvent voir l'équipe).

export async function GET() {
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const rl = await checkRateLimit('list', workspaceId);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const members = await prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: {
        user: { select: { id: true, name: true, email: true } },
      },
      orderBy: { joinedAt: 'asc' },
    });

    return Response.json({
      data: members.map(m => ({
        userId:   m.userId,
        name:     m.user.name,
        email:    m.user.email,
        role:     m.role,
        joinedAt: m.joinedAt,
      })),
    });
  } catch (err) {
    console.error('[GET /api/workspace/members]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
