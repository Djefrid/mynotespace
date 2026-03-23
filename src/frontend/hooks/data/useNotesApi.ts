"use client";

import { useCallback, useEffect, useState } from 'react';
import type { Note } from '@/lib/notes-service';

/** Shape retournée par GET /api/notes (NoteListItem PG sérialisé en JSON) */
type ApiNoteItem = {
  id:        string;
  title:     string;
  isPinned:  boolean;
  folderId:  string | null;
  status:    'ACTIVE' | 'TRASHED';
  trashedAt: string | null;
  createdAt: string;
  updatedAt: string;
  tags: { tag: { id: string; name: string } }[];
};

/** Convertit un NoteListItem PG en Note Firebase-compatible pour l'UI existante. */
function mapApiNote(item: ApiNoteItem): Note {
  return {
    id:        item.id,
    title:     item.title,
    content:   '',                                           // contenu chargé séparément à l'ouverture
    pinned:    item.isPinned,
    folderId:  item.folderId ?? null,
    tags:      item.tags.map(t => t.tag.name),
    deletedAt: item.trashedAt ? new Date(item.trashedAt) : null,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

/**
 * Charge les notes actives et en corbeille depuis les routes API PostgreSQL.
 * Retourne le même shape que les listeners Firestore du hook useAdminNotes.
 */
export function useNotesApi() {
  const [notes,        setNotes]        = useState<Note[]>([]);
  const [deletedNotes, setDeletedNotes] = useState<Note[]>([]);
  const [loading,      setLoading]      = useState(true);
  const [refreshKey,   setRefreshKey]   = useState(0);

  /** Déclenche un re-fetch de la liste (appeler après chaque mutation). */
  const refresh = useCallback(() => setRefreshKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchNotes() {
      try {
        const [activeRes, trashedRes] = await Promise.all([
          fetch('/api/notes?status=ACTIVE'),
          fetch('/api/notes?status=TRASHED'),
        ]);

        if (cancelled) return;

        if (activeRes.ok) {
          const { data } = await activeRes.json() as { data: ApiNoteItem[] };
          setNotes(data.map(mapApiNote));
        }
        if (trashedRes.ok) {
          const { data } = await trashedRes.json() as { data: ApiNoteItem[] };
          setDeletedNotes(data.map(mapApiNote));
        }
      } catch (err) {
        console.error('[useNotesApi]', err);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    fetchNotes();
    return () => { cancelled = true; };
  }, [refreshKey]);

  return { notes, deletedNotes, loading, refresh };
}
