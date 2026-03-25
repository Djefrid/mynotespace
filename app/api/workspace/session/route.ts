import { requireRole } from '@/src/backend/auth/session';
import { prisma } from '@/src/backend/db/prisma';
import { MemberRole } from '@prisma/client';
import { z } from 'zod';

// ─── GET /api/workspace/session ───────────────────────────────────────────────
// Retourne la durée de session configurée pour le workspace courant.

export async function GET() {
  let workspaceId: string;
  try {
    ({ workspaceId } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const workspace = await prisma.workspace.findUnique({
      where:  { id: workspaceId },
      select: { sessionMaxAgeDays: true },
    });
    return Response.json({ data: { sessionMaxAgeDays: workspace?.sessionMaxAgeDays ?? 30 } });
  } catch (err) {
    console.error('[GET /api/workspace/session]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

// ─── PATCH /api/workspace/session ─────────────────────────────────────────────
// Met à jour la durée de session du workspace. Réservé au OWNER.

const patchSchema = z.object({
  sessionMaxAgeDays: z.number().int().min(1).max(180),
});

export async function PATCH(req: Request) {
  let workspaceId: string;
  let role: MemberRole;
  try {
    ({ workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (role !== MemberRole.OWNER) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  let body: unknown;
  try { body = await req.json(); }
  catch { return Response.json({ error: 'Invalid JSON' }, { status: 400 }); }

  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Validation error', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    await prisma.workspace.update({
      where: { id: workspaceId },
      data:  { sessionMaxAgeDays: parsed.data.sessionMaxAgeDays },
    });
    return Response.json({ data: { sessionMaxAgeDays: parsed.data.sessionMaxAgeDays } });
  } catch (err) {
    console.error('[PATCH /api/workspace/session]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
