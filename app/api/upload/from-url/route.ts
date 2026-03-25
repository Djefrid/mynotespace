/**
 * POST /api/upload/from-url
 * ─────────────────────────
 * Fetch une image externe côté serveur (évite le CORS navigateur),
 * puis l'upload directement dans R2 sous le chemin du workspace.
 *
 * Sécurités :
 *   - Auth obligatoire (session NextAuth)
 *   - La note doit appartenir au workspace de l'utilisateur
 *   - Validation SSRF : refuse localhost / IPs privées / link-local
 *   - Taille max 10 Mo
 *   - Type MIME restreint aux images
 *   - Rate-limit partagé avec presign
 */

import { randomUUID } from 'crypto';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { prisma } from '@/src/backend/db/prisma';
import { r2, R2_BUCKET, R2_PUBLIC_URL } from '@/src/backend/integrations/r2/client';
import { fromUrlSchema } from '@/src/backend/validators/upload.schemas';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';

const MAX_BYTES = 10 * 1024 * 1024; // 10 Mo

const ALLOWED_MIME = new Set([
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
]);

// POST : OWNER, ADMIN, MEMBER — interdit aux VIEWER
export async function POST(req: Request) {
  // ── Auth + rôle ───────────────────────────────────────────────────────────────
  let workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'uploads:create')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const limit = await checkRateLimit('from-url', workspaceId);
  if (!limit.success) return rateLimitResponse(limit.reset);

  // ── Validation du body ────────────────────────────────────────────────────────
  const body   = await req.json().catch(() => ({}));
  const parsed = fromUrlSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { noteId, url } = parsed.data;

  // ── Vérification appartenance note ────────────────────────────────────────────
  const note = await prisma.note.findFirst({
    where: { id: noteId, workspaceId },
    select: { id: true },
  });
  if (!note) {
    return Response.json({ error: 'Note introuvable' }, { status: 404 });
  }

  // ── Fetch de l'image externe côté serveur ─────────────────────────────────────
  let imageBuffer: Buffer;
  let mimeType: string;

  try {
    const response = await fetch(url, {
      signal: AbortSignal.timeout(10_000), // 10s max
      headers: { 'User-Agent': 'MyNoteSpace/1.0 (image-reupload)' },
    });

    if (!response.ok) {
      return Response.json({ error: `Source inaccessible (${response.status})` }, { status: 422 });
    }

    // Vérification type MIME depuis Content-Type
    const ct = response.headers.get('content-type') ?? '';
    mimeType  = ct.split(';')[0].trim();
    if (!ALLOWED_MIME.has(mimeType)) {
      // Fallback : essaie de deviner depuis l'URL
      const ext = url.split('?')[0].split('.').pop()?.toLowerCase();
      const fallback: Record<string, string> = {
        jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png',
        gif: 'image/gif',  webp: 'image/webp', svg: 'image/svg+xml',
      };
      mimeType = fallback[ext ?? ''] ?? '';
      if (!mimeType) {
        return Response.json({ error: 'Type de fichier non autorisé' }, { status: 415 });
      }
    }

    // Vérification taille depuis Content-Length (rapide)
    const contentLength = parseInt(response.headers.get('content-length') ?? '0', 10);
    if (contentLength > MAX_BYTES) {
      return Response.json({ error: 'Image trop grande (max 10 Mo)' }, { status: 413 });
    }

    const arrayBuffer = await response.arrayBuffer();
    imageBuffer = Buffer.from(arrayBuffer);

    // Vérification taille réelle (au cas où Content-Length était absent)
    if (imageBuffer.byteLength > MAX_BYTES) {
      return Response.json({ error: 'Image trop grande (max 10 Mo)' }, { status: 413 });
    }
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[from-url] fetch échoué:', url, msg);
    return Response.json({ error: 'Impossible de récupérer l\'image' }, { status: 422 });
  }

  // ── Upload vers R2 ────────────────────────────────────────────────────────────
  try {
    const ext = mimeType.split('/')[1]?.replace('jpeg', 'jpg').replace('svg+xml', 'svg') ?? 'bin';
    const key = `workspaces/${workspaceId}/notes/${noteId}/${randomUUID()}.${ext}`;

    await r2.send(new PutObjectCommand({
      Bucket:      R2_BUCKET,
      Key:         key,
      Body:        imageBuffer,
      ContentType: mimeType,
    }));

    const publicUrl = `${R2_PUBLIC_URL}/${key}`;
    return Response.json({ data: { publicUrl } });
  } catch (err) {
    console.error('[from-url] upload R2 échoué:', err);
    return Response.json({ error: 'Erreur lors de l\'upload' }, { status: 500 });
  }
}
