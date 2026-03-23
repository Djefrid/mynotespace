import { requireWorkspaceId } from '@/src/backend/auth/session';
import { restoreNote } from '@/src/backend/services/notes-pg.service';
import { indexNoteById } from '@/src/backend/services/search.service';

type Params = { params: Promise<{ id: string }> };

// ─── POST /api/notes/[id]/restore ────────────────────────────────────────────

export async function POST(_req: Request, { params }: Params) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
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
