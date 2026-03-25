import { requireWorkspaceId } from '@/src/backend/auth/session';
import { prisma } from '@/src/backend/db/prisma';
import type { Prisma } from '@prisma/client';

type Params = { params: Promise<{ id: string; revisionId: string }> };

// ─── POST /api/notes/[id]/revisions/[revisionId]/restore ──────────────────────
// Restaure une note à l'état d'une révision passée.
// Écrase NoteContent.json + plainText avec les données de la révision.
// Retourne le JSON restauré pour que le frontend charge immédiatement l'éditeur.

export async function POST(_req: Request, { params }: Params) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id, revisionId } = await params;

    // Vérifie que la note appartient au workspace
    const note = await prisma.note.findFirst({
      where:  { id, workspaceId },
      select: { id: true },
    });
    if (!note) return Response.json({ error: 'Not found' }, { status: 404 });

    // Récupère la révision
    const revision = await prisma.noteRevision.findFirst({
      where:  { id: revisionId, noteId: id },
      select: { json: true, plainText: true, wordCount: true },
    });
    if (!revision) return Response.json({ error: 'Revision not found' }, { status: 404 });

    // Restaure NoteContent avec le JSON de la révision
    await prisma.noteContent.upsert({
      where:  { noteId: id },
      create: { noteId: id, html: '', json: revision.json as Prisma.InputJsonValue, plainText: revision.plainText, wordCount: revision.wordCount },
      update: { json: revision.json as Prisma.InputJsonValue, plainText: revision.plainText, wordCount: revision.wordCount },
    });

    // Met à jour Note.updatedAt — updateMany avec workspaceId : défense en profondeur
    await prisma.note.updateMany({ where: { id, workspaceId }, data: { updatedAt: new Date() } });

    return Response.json({ data: { json: revision.json } });
  } catch (err) {
    console.error('[POST /api/notes/[id]/revisions/[revisionId]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
