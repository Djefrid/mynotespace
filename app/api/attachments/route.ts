import { requireWorkspaceId } from '@/src/backend/auth/session';
import { prisma } from '@/src/backend/db/prisma';
import { registerAttachmentSchema } from '@/src/backend/validators/upload.schemas';

// ─── POST /api/attachments ────────────────────────────────────────────────────
// Enregistre les métadonnées d'un fichier après que le client l'a uploadé sur R2.

export async function POST(req: Request) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body   = await req.json().catch(() => ({}));
    const parsed = registerAttachmentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { noteId, key, filename, mimeType, size } = parsed.data;

    // Sécurité : la clé doit commencer par le prefix du workspace de l'utilisateur.
    // Empêche d'enregistrer un objet appartenant à un autre workspace.
    const expectedPrefix = `workspaces/${workspaceId}/`;
    if (!key.startsWith(expectedPrefix)) {
      return Response.json({ error: 'Clé R2 invalide' }, { status: 403 });
    }

    // Vérifie que la note appartient au workspace
    const note = await prisma.note.findFirst({
      where: { id: noteId, workspaceId },
      select: { id: true },
    });
    if (!note) {
      return Response.json({ error: 'Note introuvable' }, { status: 404 });
    }

    const publicUrl = `${(process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '')}/${key}`;

    const attachment = await prisma.attachment.upsert({
      where:  { key },
      create: { workspaceId, noteId, key, filename, mimeType, size, publicUrl },
      update: { filename, mimeType, size, publicUrl },
    });

    return Response.json({ data: attachment }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/attachments]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── GET /api/attachments?noteId=xxx ─────────────────────────────────────────
// Liste les pièces jointes d'une note.

export async function GET(req: Request) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const noteId = new URL(req.url).searchParams.get('noteId');
    if (!noteId) {
      return Response.json({ error: 'noteId requis' }, { status: 400 });
    }

    const attachments = await prisma.attachment.findMany({
      where:   { noteId, workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    return Response.json({ data: attachments });
  } catch (err) {
    console.error('[GET /api/attachments]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
