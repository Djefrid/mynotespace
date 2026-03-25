import { requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { restoreNote } from '@/src/backend/services/notes-pg.service';
import { indexNoteById } from '@/src/backend/services/search.service';

type Params = { params: Promise<{ id: string }> };

// ─── POST /api/notes/[id]/restore ────────────────────────────────────────────
// Restauration depuis la corbeille : OWNER, ADMIN, MEMBER

export async function POST(_req: Request, { params }: Params) {
  let workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'notes:restore')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await restoreNote(id, workspaceId);
    indexNoteById(id, workspaceId).catch(console.error); // met à jour status=ACTIVE
    return Response.json({ success: true });
  } catch (err) {
    console.error('[POST /api/notes/[id]/restore]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
