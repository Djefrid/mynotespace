import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireWorkspaceId } from '@/src/backend/auth/session';
import { prisma } from '@/src/backend/db/prisma';
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/src/backend/integrations/r2/client';
import { presignSchema } from '@/src/backend/validators/upload.schemas';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';

/** Durée de validité de l'URL signée (secondes). */
const PRESIGN_TTL_SECONDS = 300; // 5 minutes

// ─── POST /api/upload/presign ─────────────────────────────────────────────────

export async function POST(req: Request) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = await checkRateLimit('presign', workspaceId);
  if (!limit.success) return rateLimitResponse(limit.reset);

  try {
    const body   = await req.json().catch(() => ({}));
    const parsed = presignSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { noteId, filename, mimeType, size } = parsed.data;

    // Vérifie que la note appartient bien au workspace de l'utilisateur
    const note = await prisma.note.findFirst({
      where: { id: noteId, workspaceId },
      select: { id: true },
    });
    if (!note) {
      return Response.json({ error: 'Note introuvable' }, { status: 404 });
    }

    // Clé R2 : prefix workspace + note + uuid pour éviter les collisions
    // Le prefix workspaceId est la garde de sécurité à l'enregistrement
    const ext = filename.split('.').pop()?.toLowerCase().replace(/[^a-z0-9]/g, '') ?? 'bin';
    const key = `workspaces/${workspaceId}/notes/${noteId}/${randomUUID()}.${ext}`;

    const command = new PutObjectCommand({
      Bucket:        R2_BUCKET,
      Key:           key,
      ContentType:   mimeType,
      ContentLength: size,
    });

    const uploadUrl = await getSignedUrl(r2, command, { expiresIn: PRESIGN_TTL_SECONDS });
    const publicUrl = `${R2_PUBLIC_URL}/${key}`;

    return Response.json({ data: { uploadUrl, key, publicUrl } });
  } catch (err) {
    console.error('[POST /api/upload/presign]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
