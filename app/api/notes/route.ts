import { NoteStatus } from '@prisma/client';
import { requireWorkspaceId, requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { createNote, getNotesForWorkspace } from '@/src/backend/services/notes-pg.service';
import { createNoteSchema, listNotesSchema } from '@/src/backend/validators/note.schemas';
import { inngest, noteWritten } from '@/src/backend/integrations/inngest/client';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';

// ─── GET /api/notes ───────────────────────────────────────────────────────────

export async function GET(req: Request) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = await checkRateLimit('list', workspaceId);
  if (!limit.success) return rateLimitResponse(limit.reset);

  try {
    const { searchParams } = new URL(req.url);

    const parsed = listNotesSchema.safeParse({
      status:   searchParams.get('status')   ?? undefined,
      folderId: searchParams.get('folderId') ?? undefined,
      cursor:   searchParams.get('cursor')   ?? undefined,
      limit:    searchParams.get('limit')    ?? undefined,
    });

    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { status, folderId, cursor, limit } = parsed.data;

    const notes = await getNotesForWorkspace(workspaceId, {
      status:   status as NoteStatus | undefined,
      folderId: folderId === 'null' ? null : folderId,
      cursor,
      limit,
    });

    return Response.json({ data: notes });
  } catch (err) {
    console.error('[GET /api/notes]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── POST /api/notes ──────────────────────────────────────────────────────────
// Création : OWNER, ADMIN, MEMBER — interdit aux VIEWER

export async function POST(req: Request) {
  let userId: string, workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ userId, workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'notes:create')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = await checkRateLimit('create', workspaceId);
  if (!limit.success) return rateLimitResponse(limit.reset);

  try {
    const body = await req.json().catch(() => ({}));

    const parsed = createNoteSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const note = await createNote({ workspaceId, userId, ...parsed.data });

    // Indexation asynchrone fiable via Inngest (avec retry)
    inngest.send(noteWritten.create({ noteId: note.id, workspaceId })).catch(() => {});

    return Response.json({ data: note }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/notes]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
