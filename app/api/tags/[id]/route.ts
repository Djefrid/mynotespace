import { requireWorkspaceId } from '@/src/backend/auth/session';
import { deleteTag } from '@/src/backend/services/tags.service';

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { id } = await params;
    await deleteTag(id, workspaceId);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/tags/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
