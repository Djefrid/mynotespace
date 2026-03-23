import { requireWorkspaceId } from '@/src/backend/auth/session';
import {
  getNoteByIdForWorkspace,
  updateNote,
  softDeleteNote,
  deleteNotePermanently,
} from '@/src/backend/services/notes-pg.service';
import { inngest, noteWritten, noteTrashed, noteDeleted } from '@/src/backend/integrations/inngest/client';
import { updateNoteSchema } from '@/src/backend/validators/note.schemas';

type Params = { params: Promise<{ id: string }> };

// ─── GET /api/notes/[id] ──────────────────────────────────────────────────────

export async function GET(_req: Request, { params }: Params) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    const note = await getNoteByIdForWorkspace(id, workspaceId);
    if (!note) return Response.json({ error: 'Not found' }, { status: 404 });
    return Response.json({ data: note });
  } catch (err) {
    console.error('[GET /api/notes/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/notes/[id] ────────────────────────────────────────────────────

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

    const parsed = updateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { auth } = await import('@/src/backend/auth/auth');
    const session  = await auth();
    const userId   = session!.user.id;

    const note = await updateNote(id, workspaceId, { userId, ...parsed.data });
    if (!note) return Response.json({ error: 'Not found' }, { status: 404 });

    inngest.send(noteWritten.create({ noteId: id, workspaceId })).catch(() => {});

    return Response.json({ data: note });
  } catch (err) {
    console.error('[PATCH /api/notes/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/notes/[id] ───────────────────────────────────────────────────

export async function DELETE(req: Request, { params }: Params) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id }  = await params;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';
    if (permanent) {
      await deleteNotePermanently(id, workspaceId);
      inngest.send(noteDeleted.create({ noteId: id, workspaceId })).catch(() => {});
    } else {
      await softDeleteNote(id, workspaceId);
      inngest.send(noteTrashed.create({ noteId: id, workspaceId })).catch(() => {});
    }
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/notes/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
