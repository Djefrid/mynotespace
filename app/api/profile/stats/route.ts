import { prisma } from '@/src/backend/db/prisma';
import { requireSession } from '@/src/backend/auth/session';

// ─── GET /api/profile/stats ───────────────────────────────────────────────────

export async function GET() {
  let userId: string;
  let workspaceId: string;
  try {
    ({ userId, workspaceId } = await requireSession());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [user, workspace, noteStats, folderCount, tagCount, attachmentStats] = await Promise.all([
      prisma.user.findUnique({
        where:  { id: userId },
        select: { createdAt: true, passwordHash: true },
      }),
      prisma.workspace.findUnique({
        where:  { id: workspaceId },
        select: { name: true },
      }),
      prisma.note.groupBy({
        by:    ['status'],
        where: { workspaceId },
        _count: { id: true },
      }),
      prisma.folder.count({ where: { workspaceId } }),
      prisma.tag.count({ where: { workspaceId } }),
      prisma.attachment.aggregate({
        where: { workspaceId },
        _count: { id: true },
        _sum:   { size: true },
      }),
    ]);

    const activeNotes  = noteStats.find((s) => s.status === 'ACTIVE')?._count.id  ?? 0;
    const trashedNotes = noteStats.find((s) => s.status === 'TRASHED')?._count.id ?? 0;

    return Response.json({
      data: {
        createdAt:     user?.createdAt   ?? null,
        authMethod:    user?.passwordHash ? 'credentials' : 'oauth',
        workspaceName: workspace?.name   ?? '',
        activeNotes,
        trashedNotes,
        folderCount,
        tagCount,
        fileCount:    attachmentStats._count.id,
        storageBytes: attachmentStats._sum.size ?? 0,
      },
    });
  } catch (err) {
    console.error('[GET /api/profile/stats]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
