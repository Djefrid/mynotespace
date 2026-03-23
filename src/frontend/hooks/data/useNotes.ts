"use client";

import { useCallback, useEffect, useState } from 'react';
import { useNotesApi }  from './useNotesApi';
import type { Folder }  from '@/lib/notes-service';

type ApiFolderItem = {
  id:          string;
  name:        string;
  parentId:    string | null;
  workspaceId: string;
  createdAt:   string;
  updatedAt:   string;
};

type ApiTagItem = {
  id:   string;
  name: string;
};

/**
 * Charge notes, dossiers et tags depuis les routes API PostgreSQL.
 */
export function useNotes() {
  const { notes, deletedNotes, loading: notesLoading, refresh: refreshNotes } = useNotesApi();

  const [folders,    setFolders]    = useState<Folder[]>([]);
  const [manualTags, setManualTags] = useState<string[]>([]);
  const [metaReady,  setMetaReady]  = useState(false);
  const [metaKey,    setMetaKey]    = useState(0);

  const refreshMeta = useCallback(() => setMetaKey(k => k + 1), []);

  useEffect(() => {
    let cancelled = false;

    async function fetchMeta() {
      try {
        const [fRes, tRes] = await Promise.all([
          fetch('/api/folders'),
          fetch('/api/tags'),
        ]);

        if (cancelled) return;

        if (fRes.ok) {
          const { data } = await fRes.json() as { data: ApiFolderItem[] };
          setFolders(data.map((f, i) => ({
            id:        f.id,
            name:      f.name,
            order:     i,
            parentId:  f.parentId,
            isSmart:   false,
            createdAt: new Date(f.createdAt),
            updatedAt: new Date(f.updatedAt),
          })));
        }

        if (tRes.ok) {
          const { data } = await tRes.json() as { data: ApiTagItem[] };
          setManualTags(
            data.map(t => t.name).sort((a, b) => a.localeCompare(b, 'fr'))
          );
        }
      } catch (err) {
        console.error('[useNotes]', err);
      } finally {
        if (!cancelled) setMetaReady(true);
      }
    }

    fetchMeta();
    return () => { cancelled = true; };
  }, [metaKey]);

  return {
    notes,
    deletedNotes,
    folders,
    manualTags,
    loading:      notesLoading || !metaReady,
    refreshNotes,
    refreshMeta,
  };
}
