import { headers } from 'next/headers';
import { prisma } from '@/src/backend/db/prisma';
import { registerSchema } from '@/src/backend/validators/auth.schemas';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';
import { provisionPersonalWorkspace } from '@/src/backend/services/user-bootstrap.service';
import { hashPassword } from '@/src/backend/lib/password';

// ─── POST /api/auth/register ──────────────────────────────────────────────────

export async function POST(req: Request) {
  const headersList = await headers();
  const ip = headersList.get('x-forwarded-for')?.split(',')[0]?.trim() ?? 'unknown';

  const limit = await checkRateLimit('auth', `register:${ip}`);
  if (!limit.success) return rateLimitResponse(limit.reset);

  try {
    const body = await req.json().catch(() => ({}));

    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { email, password } = parsed.data;

    // Vérification unicité email
    const existing = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
      select: { id: true },
    });
    if (existing) {
      return Response.json(
        { error: 'Un compte avec cet email existe déjà.' },
        { status: 409 },
      );
    }

    const passwordHash = await hashPassword(password);

    const user = await prisma.user.create({
      data: {
        email:        email.toLowerCase(),
        passwordHash,
      },
      select: { id: true },
    });

    await provisionPersonalWorkspace(user.id);

    return Response.json({ data: { success: true } }, { status: 201 });
  } catch (err) {
    console.error('[POST /api/auth/register]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
