/**
 * POST /api/upload/multipart/complete
 * ─────────────────────────────────────
 * Finalise un upload multipart R2 après que le client a uploadé tous les chunks.
 *
 * Le client doit fournir :
 *   - key      : clé R2 retournée par /start
 *   - uploadId : ID retourné par /start
 *   - parts    : tableau { partNumber, etag } — ETags collectés lors des PUT chunks
 *
 * R2/S3 assemble les chunks dans l'ordre des partNumbers.
 */

import { CompleteMultipartUploadCommand, AbortMultipartUploadCommand } from '@aws-sdk/client-s3';
import { requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/src/backend/integrations/r2/client';
import { multipartCompleteSchema } from '@/src/backend/validators/upload.schemas';
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
  const parsed = multipartCompleteSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { key, uploadId, parts } = parsed.data;

  // ── Validation de la clé R2 : doit appartenir à ce workspace ──────────────
  if (!key.startsWith(`workspaces/${workspaceId}/`)) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  try {
    await r2.send(new CompleteMultipartUploadCommand({
      Bucket:          R2_BUCKET,
      Key:             key,
      UploadId:        uploadId,
      MultipartUpload: {
        Parts: parts
          .slice()
          .sort((a, b) => a.partNumber - b.partNumber)
          .map(p => ({ PartNumber: p.partNumber, ETag: p.etag })),
      },
    }));

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return Response.json({ data: { publicUrl, key } });
  } catch (err) {
    console.error('[POST /api/upload/multipart/complete]', err);

    // Annule le multipart upload si complete échoue — évite les frais de stockage
    // pour des fichiers incomplets (R2 facture les chunks non finalisés).
    r2.send(new AbortMultipartUploadCommand({
      Bucket:   R2_BUCKET,
      Key:      key,
      UploadId: uploadId,
    })).catch(() => {});

    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
