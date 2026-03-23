import { requireWorkspaceId } from '@/src/backend/auth/session';
import { getFoldersForWorkspace, createFolder } from '@/src/backend/services/folders.service';
import { createFolderSchema } from '@/src/backend/validators/folder.schemas';

export async function GET() {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const folders = await getFoldersForWorkspace(workspaceId);
    return Response.json({ data: folders });
  } catch (err) {
    console.error('[GET /api/folders]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body   = await req.json().catch(() => ({}));
    const parsed = createFolderSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const folder = await createFolder({ workspaceId, ...parsed.data });
    return Response.json({ data: folder }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/folders]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
