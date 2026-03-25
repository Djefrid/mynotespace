import { requireWorkspaceId } from '@/src/backend/auth/session';
import { prisma } from '@/src/backend/db/prisma';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/notes/[id]/revisions ────────────────────────────────────────────
// Retourne les 50 dernières révisions d'une note (json + plainText + wordCount).

export async function GET(_req: Request, { params }: Params) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;

    // Vérifie que la note appartient au workspace
    const note = await prisma.note.findFirst({
      where:  { id, workspaceId },
      select: { id: true },
    });
    if (!note) return Response.json({ error: 'Not found' }, { status: 404 });

    const revisions = await prisma.noteRevision.findMany({
      where:   { noteId: id },
      orderBy: { createdAt: 'desc' },
      take:    50,
      select:  { id: true, json: true, plainText: true, wordCount: true, createdAt: true },
    });

    return Response.json({ data: revisions });
  } catch (err) {
    console.error('[GET /api/notes/[id]/revisions]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
