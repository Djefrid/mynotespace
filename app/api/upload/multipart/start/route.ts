/**
 * POST /api/upload/multipart/start
 * ─────────────────────────────────
 * Initie un upload multipart R2 et génère les URLs présignées pour chaque chunk.
 *
 * Flux :
 *   1. Valide la requête (noteId, filename, mimeType, totalSize, partCount)
 *   2. CreateMultipartUpload → uploadId + clé R2
 *   3. Génère une URL présignée UploadPart pour chaque numéro de chunk (1-indexed)
 *   4. Retourne { key, uploadId, presignedUrls[] }
 *
 * Le client upload chaque chunk directement vers R2, collecte les ETags,
 * puis appelle POST /api/upload/multipart/complete.
 *
 * Seuil recommandé : utiliser ce endpoint uniquement pour les fichiers >= 5 Mo
 * (taille minimale d'un chunk R2/S3 = 5 MiB, sauf le dernier).
 */

import { randomUUID } from 'crypto';
import {
  CreateMultipartUploadCommand,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { prisma } from '@/src/backend/db/prisma';
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/src/backend/integrations/r2/client';
import { multipartStartSchema } from '@/src/backend/validators/upload.schemas';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';

// POST : OWNER, ADMIN, MEMBER — interdit aux VIEWER
export async function POST(req: Request) {
  // ── Auth + rôle ────────────────────────────────────────────────────────────
  let workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'uploads:create')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = await checkRateLimit('presign', workspaceId);
  if (!limit.success) return rateLimitResponse(limit.reset);

  // ── Validation body ────────────────────────────────────────────────────────
  const body   = await req.json().catch(() => ({}));
  const parsed = multipartStartSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { noteId, filename, mimeType, partCount } = parsed.data;

  // ── Vérification appartenance note ─────────────────────────────────────────
  const note = await prisma.note.findFirst({
    where:  { id: noteId, workspaceId },
    select: { id: true },
  });
  if (!note) {
    return Response.json({ error: 'Note introuvable' }, { status: 404 });
  }

  try {
    // ── Clé R2 ────────────────────────────────────────────────────────────────
    const ext = filename.split('.').pop()?.toLowerCase() ?? 'bin';
    const key = `workspaces/${workspaceId}/notes/${noteId}/${randomUUID()}.${ext}`;

    // ── Initie le multipart upload ─────────────────────────────────────────────
    const createCmd = new CreateMultipartUploadCommand({
      Bucket:      R2_BUCKET,
      Key:         key,
      ContentType: mimeType,
    });
    const { UploadId: uploadId } = await r2.send(createCmd);
    if (!uploadId) {
      return Response.json({ error: 'Impossible d\'initier le multipart upload' }, { status: 500 });
    }

    // ── Génère une URL présignée par chunk (expire dans 1h) ───────────────────
    const presignedUrls = await Promise.all(
      Array.from({ length: partCount }, (_, i) =>
        getSignedUrl(
          r2,
          new UploadPartCommand({
            Bucket:     R2_BUCKET,
            Key:        key,
            UploadId:   uploadId,
            PartNumber: i + 1,
          }),
          { expiresIn: 3_600 }, // 1 heure
        )
      )
    );

    return Response.json({
      data: {
        key,
        uploadId,
        publicUrl:    `${R2_PUBLIC_URL}/${key}`,
        presignedUrls,
      },
    });
  } catch (err) {
    console.error('[POST /api/upload/multipart/start]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
