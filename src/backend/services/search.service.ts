import 'server-only';

/**
 * Service de recherche Typesense.
 *
 * Règle fondamentale : workspace_id est TOUJOURS injecté par ce service.
 * Aucun appelant extérieur ne peut bypasser ce filtre.
 *
 * Indexation : fire-and-forget — ne bloque jamais la réponse HTTP.
 * Toute erreur Typesense est loguée et ignorée côté métier.
 */

import { prisma } from '@/src/backend/db/prisma';
import { stripHtml } from '@/src/domain/notes/note.utils';
import {
  getTsClient,
  ensureCollection,
  NOTES_COLLECTION,
  type NoteDocument,
} from '@/src/backend/integrations/typesense/client';

// ── Types ─────────────────────────────────────────────────────────────────────

export interface SearchResult {
  id:          string;
  title:       string;
  plain_text:  string;
  status:      string;
  is_pinned:   boolean;
  folder_id:   string;
  updated_at:  number;
  highlights?: { field: string; snippet: string }[];
}

export interface SearchOptions {
  status?:   string;
  folderId?: string;
  limit?:    number;
  page?:     number;
}

// ── Indexation ────────────────────────────────────────────────────────────────

async function indexDocument(doc: NoteDocument): Promise<void> {
  await ensureCollection();
  await getTsClient().collections(NOTES_COLLECTION).documents().upsert(doc);
}

/**
 * Relit la note depuis la DB et la réindexe.
 * Fire-and-forget : appelez sans await + .catch(console.error).
 */
export async function indexNoteById(noteId: string, workspaceId: string): Promise<void> {
  const note = await prisma.note.findFirst({
    where:  { id: noteId, workspaceId },
    select: {
      id: true, title: true, status: true,
      isPinned: true, folderId: true, updatedAt: true,
      content: { select: { html: true } },
    },
  });
  if (!note) return;

  await indexDocument({
    id:           note.id,
    workspace_id: workspaceId,
    title:        note.title,
    plain_text:   stripHtml(note.content?.html ?? ''),
    status:       note.status,
    is_pinned:    note.isPinned,
    folder_id:    note.folderId ?? '',
    updated_at:   Math.floor(note.updatedAt.getTime() / 1000),
  });
}

/**
 * Indexe depuis les données déjà en mémoire (évite une relecture DB).
 * Utile juste après createNote.
 */
export async function indexNoteFromData(data: {
  id: string; workspaceId: string; title: string;
  status: string; isPinned: boolean; folderId: string | null;
  updatedAt: Date; html?: string;
}): Promise<void> {
  await indexDocument({
    id:           data.id,
    workspace_id: data.workspaceId,
    title:        data.title,
    plain_text:   stripHtml(data.html ?? ''),
    status:       data.status,
    is_pinned:    data.isPinned,
    folder_id:    data.folderId ?? '',
    updated_at:   Math.floor(data.updatedAt.getTime() / 1000),
  });
}

/** Supprime un document de l'index (suppression définitive). */
export async function removeFromIndex(noteId: string): Promise<void> {
  await ensureCollection();
  await getTsClient().collections(NOTES_COLLECTION).documents(noteId).delete();
}

// ── Fallback PostgreSQL ────────────────────────────────────────────────────────

/**
 * Recherche ILIKE dans PostgreSQL — utilisé quand Typesense n'est pas configuré
 * ou qu'il renvoie une erreur.
 */
async function searchNotesPg(
  workspaceId: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const q     = query.trim();
  const limit = options.limit ?? 20;
  const skip  = ((options.page ?? 1) - 1) * limit;

  const where: Record<string, unknown> = {
    workspaceId,
    ...(options.status   ? { status:   options.status }   : {}),
    ...(options.folderId ? { folderId: options.folderId } : {}),
    ...(q ? {
      OR: [
        { title:   { contains: q, mode: 'insensitive' } },
        { content: { html: { contains: q, mode: 'insensitive' } } },
      ],
    } : {}),
  };

  const notes = await prisma.note.findMany({
    where,
    select: {
      id: true, title: true, status: true,
      isPinned: true, folderId: true, updatedAt: true,
      content: { select: { html: true } },
    },
    orderBy: { updatedAt: 'desc' },
    take:    limit,
    skip,
  });

  return notes.map((note) => ({
    id:         note.id,
    title:      note.title,
    plain_text: stripHtml(note.content?.html ?? ''),
    status:     note.status,
    is_pinned:  note.isPinned,
    folder_id:  note.folderId ?? '',
    updated_at: Math.floor(note.updatedAt.getTime() / 1000),
  }));
}

// ── Recherche ─────────────────────────────────────────────────────────────────

const typesenseEnabled = () =>
  !!(process.env.TYPESENSE_HOST && process.env.TYPESENSE_API_KEY);

/**
 * Recherche des notes.
 * - Si Typesense est configuré → Typesense (recherche full-text avancée).
 * - Sinon (ou si Typesense échoue) → PostgreSQL ILIKE (fallback immédiat).
 * workspace_id est TOUJOURS injecté — isolation garantie côté serveur.
 */
export async function searchNotes(
  workspaceId: string,
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  if (!typesenseEnabled()) {
    return searchNotesPg(workspaceId, query, options);
  }

  try {
    await ensureCollection();

    const filterParts = [`workspace_id:=${workspaceId}`];
    if (options.status)   filterParts.push(`status:=${options.status}`);
    if (options.folderId) filterParts.push(`folder_id:=${options.folderId}`);

    const results = await getTsClient().collections(NOTES_COLLECTION).documents().search({
      q:                     query.trim() || '*',
      query_by:              'title,plain_text',
      query_by_weights:      '3,1',
      filter_by:             filterParts.join(' && '),
      sort_by:               'updated_at:desc',
      per_page:              options.limit ?? 20,
      page:                  options.page  ?? 1,
      highlight_full_fields: 'title,plain_text',
      snippet_threshold:     30,
    });

    return (results.hits ?? []).map((hit) => {
      const doc = hit.document as NoteDocument;
      return {
        id:         doc.id,
        title:      doc.title,
        plain_text: doc.plain_text,
        status:     doc.status,
        is_pinned:  doc.is_pinned,
        folder_id:  doc.folder_id,
        updated_at: doc.updated_at,
        highlights: (hit.highlights ?? []).map((h) => ({
          field:   h.field,
          snippet: (h.snippet ?? '') as string,
        })),
      };
    });
  } catch (err) {
    console.warn('[search] Typesense error, falling back to PostgreSQL:', err);
    return searchNotesPg(workspaceId, query, options);
  }
}