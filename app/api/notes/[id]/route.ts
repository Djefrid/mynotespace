import { requireWorkspaceId, requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
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
// Lecture autorisée à tous les membres (y compris VIEWER)

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
// Modification : OWNER, ADMIN, MEMBER — interdit aux VIEWER

export async function PATCH(req: Request, { params }: Params) {
  let userId: string, workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ userId, workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'notes:update')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body   = await req.json().catch(() => ({}));

    const parsed = updateNoteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

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
// Soft delete : OWNER, ADMIN, MEMBER
// Permanent   : OWNER, ADMIN seulement (?permanent=true)

export async function DELETE(req: Request, { params }: Params) {
  let workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id }    = await params;
    const permanent = new URL(req.url).searchParams.get('permanent') === 'true';

    const permission = permanent ? 'notes:purge' : 'notes:delete';
    if (!can(role, permission)) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }

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
