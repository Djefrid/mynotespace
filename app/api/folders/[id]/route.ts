import { requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { updateFolder, deleteFolder } from '@/src/backend/services/folders.service';
import { updateFolderSchema } from '@/src/backend/validators/folder.schemas';

// PATCH/DELETE : OWNER, ADMIN, MEMBER — interdit aux VIEWER

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'folders:manage')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    const body   = await req.json().catch(() => ({}));
    const parsed = updateFolderSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const folder = await updateFolder(id, workspaceId, parsed.data);
    if (!folder) {
      return Response.json({ error: 'Folder not found' }, { status: 404 });
    }
    return Response.json({ data: folder });
  } catch (err) {
    console.error('[PATCH /api/folders/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  let workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'folders:manage')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    const { id } = await params;
    await deleteFolder(id, workspaceId);
    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/folders/[id]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
