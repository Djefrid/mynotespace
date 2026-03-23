import { requireWorkspaceId } from '@/src/backend/auth/session';
import { searchNotes } from '@/src/backend/services/search.service';
import { searchNotesSchema } from '@/src/backend/validators/note.schemas';
import { checkRateLimit, rateLimitResponse } from '@/src/backend/lib/rate-limit';

// ─── GET /api/search ──────────────────────────────────────────────────────────
// Paramètres : ?q=texte&status=ACTIVE&folderId=xxx&limit=20&page=1
//
// workspace_id est toujours injecté côté serveur depuis la session.
// Le client ne le fournit jamais — isolation garantie.

export async function GET(req: Request) {
  let workspaceId: string;
  try {
    workspaceId = await requireWorkspaceId();
  } catch {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const limit = await checkRateLimit('search', workspaceId);
  if (!limit.success) return rateLimitResponse(limit.reset);

  try {
    const { searchParams } = new URL(req.url);

    const parsed = searchNotesSchema.safeParse({
      q:        searchParams.get('q')        ?? '',
      status:   searchParams.get('status')   ?? undefined,
      folderId: searchParams.get('folderId') ?? undefined,
      limit:    searchParams.get('limit')    ?? undefined,
      page:     searchParams.get('page')     ?? undefined,
    });

    if (!parsed.success) {
      return Response.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { q, status, folderId, limit, page } = parsed.data;

    const results = await searchNotes(workspaceId, q, { status, folderId, limit, page });

    return Response.json({ data: results });
  } catch (err) {
    console.error('[GET /api/search]', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}
