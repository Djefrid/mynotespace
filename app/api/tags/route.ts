import { requireWorkspaceId, requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { getTagsForWorkspace, createTag } from '@/src/backend/services/tags.service';
import { createTagSchema } from '@/src/backend/validators/tag.schemas';

export async function GET() {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tags = await getTagsForWorkspace(workspaceId);
    return Response.json({ data: tags });
  } catch (err) {
    console.error('[GET /api/tags]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// POST : OWNER, ADMIN, MEMBER — interdit aux VIEWER
export async function POST(req: Request) {
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
    const body   = await req.json().catch(() => ({}));
    const parsed = createTagSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const tag = await createTag(workspaceId, parsed.data.name);
    return Response.json({ data: tag }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/tags]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
