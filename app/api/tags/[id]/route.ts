import { requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { deleteTag } from '@/src/backend/services/tags.service';

// DELETE : OWNER, ADMIN, MEMBER — interdit aux VIEWER
export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'tags:manage')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
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
