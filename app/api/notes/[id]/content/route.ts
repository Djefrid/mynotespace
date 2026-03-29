import { requireRole } from '@/src/backend/auth/session';
import { can } from '@/src/backend/policies/permissions';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';
import { saveNoteContent } from '@/src/backend/services/notes-pg.service';
import { saveContentSchema } from '@/src/backend/validators/note.schemas';
import { auth } from '@/src/backend/auth/auth';
import { inngest, noteWritten, noteImagesOrphaned } from '@/src/backend/integrations/inngest/client';
import { prisma } from '@/src/backend/db/prisma';
import { extractR2Keys, diffR2Keys } from '@/src/domain/notes/note-content.utils';

type Params = { params: Promise<{ id: string }> };

// ─── PATCH /api/notes/[id]/content ────────────────────────────────────────────
// Sauvegarde json (source de vérité) + html (cache exports) + plainText (search).
// Autosave : OWNER, ADMIN, MEMBER — interdit aux VIEWER

export async function PATCH(req: Request, { params }: Params) {
  let workspaceId: string, role: import('@prisma/client').MemberRole;
  try {
    ({ workspaceId, role } = await requireRole());
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!can(role, 'notes:update')) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  const rl = await checkRateLimit('autosave', workspaceId);
  if (!rl.success) return rateLimitResponse(rl.reset);

  try {
    const { id }   = await params;
    const body     = await req.json().catch(() => ({}));
    const parsed   = saveContentSchema.safeParse(body);
    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const session = await auth();
    const userId  = session!.user.id;

    // ── Détection d'images orphelines ─────────────────────────────────────────
    // Lit l'ancien JSON avant l'upsert pour comparer les clés R2 présentes.
    // Fire-and-forget : ne bloque pas la sauvegarde en cas d'erreur.
    const r2PublicUrl = (process.env.R2_PUBLIC_URL ?? '').replace(/\/$/, '');
    let orphanedKeys: string[] = [];

    if (r2PublicUrl && parsed.data.json) {
      try {
        const oldContent = await prisma.noteContent.findUnique({
          where:  { noteId: id },
          select: { json: true },
        });

        if (oldContent?.json) {
          const oldKeys = extractR2Keys(oldContent.json as Record<string, unknown>, r2PublicUrl);
          const newKeys = extractR2Keys(parsed.data.json as Record<string, unknown>, r2PublicUrl);
          orphanedKeys  = diffR2Keys(oldKeys, newKeys);
        }
      } catch {
        // Fail-open : ne bloque pas la sauvegarde
      }
    }

    const ok = await saveNoteContent(id, workspaceId, userId, {
      html:           parsed.data.html,
      json:           parsed.data.json as Record<string, unknown> | undefined,
      plainText:      parsed.data.plainText,
      wordCount:      parsed.data.wordCount,
      characterCount: parsed.data.characterCount,
    });
    if (!ok) return Response.json({ error: 'Not found' }, { status: 404 });

    // Réindexe titre + contenu après chaque autosave via Inngest (avec retry)
    inngest.send(noteWritten.create({ noteId: id, workspaceId })).catch(() => {});

    // Déclenche la suppression R2 des images orphelines (si nécessaire)
    if (orphanedKeys.length > 0) {
      inngest.send(noteImagesOrphaned.create({ noteId: id, workspaceId, keys: orphanedKeys })).catch(() => {});
    }

    return new Response(null, { status: 204 });
  } catch (err) {
    console.error('[PATCH /api/notes/[id]/content]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
