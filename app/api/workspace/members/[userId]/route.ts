import { requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { prisma } from '@/src/backend/db/prisma';
import { MemberRole } from '@prisma/client';
import { z } from 'zod';

type Params = { params: Promise<{ userId: string }> };

const patchSchema = z.object({
  role: z.nativeEnum(MemberRole),
});

// ─── PATCH /api/workspace/members/[userId] ────────────────────────────────────
// Modifie le rôle d'un membre. Réservé au OWNER.
// Le OWNER ne peut pas modifier son propre rôle.

export async function PATCH(req: Request, { params }: Params) {
  let workspaceId: string, userId: string, role: MemberRole;
  try {
    ({ workspaceId, userId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'members:manage')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId: targetId } = await params;

  if (targetId === userId) {
    return Response.json({ error: 'Vous ne pouvez pas modifier votre propre rôle.' }, { status: 400 });
  }

  const body = await req.json().catch(() => ({}));
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  // Empêche de nommer un second OWNER (1 seul OWNER par workspace)
  if (parsed.data.role === MemberRole.OWNER) {
    return Response.json({ error: 'Il ne peut y avoir qu\'un seul propriétaire.' }, { status: 400 });
  }

  try {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetId } },
    });
    if (!member) return Response.json({ error: 'Membre introuvable.' }, { status: 404 });

    await prisma.workspaceMember.update({
      where: { workspaceId_userId: { workspaceId, userId: targetId } },
      data: { role: parsed.data.role },
    });

    return Response.json({ ok: true });
  } catch (err) {
    console.error('[PATCH /api/workspace/members/[userId]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── DELETE /api/workspace/members/[userId] ───────────────────────────────────
// Retire un membre du workspace. Réservé au OWNER.
// Le OWNER ne peut pas se retirer lui-même.

export async function DELETE(_req: Request, { params }: Params) {
  let workspaceId: string, userId: string, role: MemberRole;
  try {
    ({ workspaceId, userId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'members:manage')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { userId: targetId } = await params;

  if (targetId === userId) {
    return Response.json({ error: 'Vous ne pouvez pas vous retirer vous-même.' }, { status: 400 });
  }

  try {
    const member = await prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId: targetId } },
    });
    if (!member) return Response.json({ error: 'Membre introuvable.' }, { status: 404 });

    await prisma.workspaceMember.delete({
      where: { workspaceId_userId: { workspaceId, userId: targetId } },
    });

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[DELETE /api/workspace/members/[userId]]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
