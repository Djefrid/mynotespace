import { requireWorkspaceId } from '@/src/backend/auth/session';
import { saveNoteContent } from '@/src/backend/services/notes-pg.service';
import { saveContentSchema } from '@/src/backend/validators/note.schemas';
import { auth } from '@/src/backend/auth/auth';
import { inngest, noteWritten } from '@/src/backend/integrations/inngest/client';

type Params = { params: Promise<{ id: string }> };

// ─── PATCH /api/notes/[id]/content ────────────────────────────────────────────
// Sauvegarde json (source de vérité) + html (cache exports) + plainText (search).

export async function PATCH(req: Request, { params }: Params) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id }   = await params;
    const body     = await req.json().catch(() => ({}));
    const parsed   = saveContentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const session = await auth();
    const userId  = session!.user.id;

    const ok = await saveNoteContent(id, workspaceId, userId, {
      html:      parsed.data.html,
      json:      parsed.data.json as Record<string, unknown> | undefined,
      plainText: parsed.data.plainText,
    });
    if (!ok) return Response.json({ error: 'Not found' }, { status: 404 });

    // Réindexe titre + contenu après chaque autosave via Inngest (avec retry)
    inngest.send(noteWritten.create({ noteId: id, workspaceId })).catch(() => {});

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[PATCH /api/notes/[id]/content]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
