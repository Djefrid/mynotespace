import bcrypt from 'bcryptjs';
import { prisma } from '@/src/backend/db/prisma';
import { requireSession } from '@/src/backend/auth/session';
import { changePasswordSchema } from '@/src/backend/validators/auth.schemas';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';

// ─── POST /api/auth/change-password ──────────────────────────────────────────

export async function POST(req: Request) {
  let userId: string;
  try {
    ({ userId } = await requireSession());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = await checkRateLimit('auth', userId);
  if (!limit.success) return rateLimitResponse(limit.reset);

  try {
    const body = await req.json().catch(() => ({}));

    const parsed = changePasswordSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { currentPassword, newPassword } = parsed.data;

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { passwordHash: true } });
    if (!user?.passwordHash) {
      return Response.json(
        { error: 'Ce compte utilise une connexion OAuth — le changement de mot de passe n\'est pas disponible.' },
        { status: 400 },
      );
    }

    const valid = await bcrypt.compare(currentPassword, user.passwordHash);
    if (!valid) {
      return Response.json({ error: 'Mot de passe actuel incorrect.' }, { status: 400 });
    }

    const newHash = await bcrypt.hash(newPassword, 12);
    await prisma.user.update({ where: { id: userId }, data: { passwordHash: newHash } });

    return Response.json({ data: { success: true } });
  } catch (err) {
    console.error('[POST /api/auth/change-password]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
