import { prisma } from '@/src/backend/db/prisma';
import { requireSession } from '@/src/backend/auth/session';
import { updateProfileSchema } from '@/src/backend/validators/auth.schemas';

// ─── PATCH /api/auth/profile ──────────────────────────────────────────────────

export async function PATCH(req: Request) {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await req.json().catch(() => ({}));

    const parsed = updateProfileSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { name } = parsed.data;

    await prisma.user.update({ where: { id: userId }, data: { name } });

    return Response.json({ data: { name } });
  } catch (err) {
    console.error('[PATCH /api/auth/profile]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
