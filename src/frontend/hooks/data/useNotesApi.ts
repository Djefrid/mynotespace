"use client";

import { useCallback } from 'react';
import useSWR from 'swr';
import type { Note } from '@/lib/notes-service';
import {
  deleteNote,
  permanentlyDeleteNote,
  recoverNote,
} from '@/src/frontend/services/notes-mutations-api';

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
  tags:      { tag: { id: string; name: string } }[];
  content?:  { plainText?: string | null } | null;
};

const fetcher = (url: string) => fetch(url).then(r => r.json());

/** SWR config partagée pour toutes les requêtes de liste */
const SWR_CONFIG = {
  revalidateOnFocus:    true,   // rafraîchit quand l'onglet reprend le focus
  revalidateOnReconnect: true,  // rafraîchit après une coupure réseau
  refreshInterval:      30_000, // polling toutes les 30s en arrière-plan
  refreshWhenHidden:    false,  // pas de polling si l'onglet est caché
  refreshWhenOffline:   false,  // pas de polling hors-ligne
  dedupingInterval:     2_000,  // déduplique les requêtes dans la même fenêtre de 2s
};

/** Convertit un NoteListItem PG en Note pour l'UI. */
function mapApiNote(item: ApiNoteItem): Note {
  return {
    id:        item.id,
    title:     item.title,
    content:   item.content?.plainText ?? '',
    pinned:    item.isPinned,
    folderId:  item.folderId ?? null,
    tags:      item.tags.map(t => t.tag.name),
    deletedAt: item.trashedAt ? new Date(item.trashedAt) : null,
    createdAt: new Date(item.createdAt),
    updatedAt: new Date(item.updatedAt),
  };
}

/**
 * Charge les notes actives et supprimées via SWR.
 * - Rafraîchissement automatique au focus de l'onglet
 * - Polling toutes les 30s
 * - `refresh()` pour forcer un re-fetch immédiat après une mutation
 */
export function useNotesApi() {
  const {
    data:    activeData,
    isLoading: activeLoading,
    mutate:  mutateActive,
  } = useSWR<{ data: ApiNoteItem[] }>('/api/notes?status=ACTIVE', fetcher, SWR_CONFIG);

  const {
    data:    trashedData,
    isLoading: trashedLoading,
    mutate:  mutateTrashed,
  } = useSWR<{ data: ApiNoteItem[] }>('/api/notes?status=TRASHED', fetcher, SWR_CONFIG);

  const notes        = (activeData?.data  ?? []).map(mapApiNote);
  const deletedNotes = (trashedData?.data ?? []).map(mapApiNote);
  const loading      = activeLoading || trashedLoading;

  /** Force un re-fetch immédiat des deux listes (après create/update/delete). */
  const refresh = useCallback(() => {
    mutateActive();
    mutateTrashed();
  }, [mutateActive, mutateTrashed]);

  /**
   * Suppression douce optimiste (active → corbeille).
   * La note disparaît instantanément de la liste. Rollback automatique si le serveur échoue.
   */
  const deleteNoteOptimistic = useCallback(async (id: string) => {
    await mutateActive(
      async () => { await deleteNote(id); return undefined; },
      {
        optimisticData: (current) => ({ data: (current?.data ?? []).filter(n => n.id !== id) }),
        rollbackOnError: true,
        populateCache:   false,
        revalidate:      true,
      },
    );
  }, [mutateActive]);

  /**
   * Suppression définitive optimiste (corbeille → supprimée).
   * La note disparaît instantanément de la corbeille. Rollback si erreur serveur.
   */
  const permanentlyDeleteNoteOptimistic = useCallback(async (id: string) => {
    await mutateTrashed(
      async () => { await permanentlyDeleteNote(id); return undefined; },
      {
        optimisticData: (current) => ({ data: (current?.data ?? []).filter(n => n.id !== id) }),
        rollbackOnError: true,
        populateCache:   false,
        revalidate:      true,
      },
    );
  }, [mutateTrashed]);

  /**
   * Restauration optimiste (corbeille → active).
   * La note disparaît instantanément de la corbeille. Revalide les deux listes après.
   */
  const recoverNoteOptimistic = useCallback(async (id: string) => {
    await mutateTrashed(
      async () => { await recoverNote(id); return undefined; },
      {
        optimisticData: (current) => ({ data: (current?.data ?? []).filter(n => n.id !== id) }),
        rollbackOnError: true,
        populateCache:   false,
        revalidate:      true,
      },
    );
    mutateActive(); // refetch la liste active pour y afficher la note restaurée
  }, [mutateTrashed, mutateActive]);

  return {
    notes, deletedNotes, loading, refresh,
    deleteNoteOptimistic,
    permanentlyDeleteNoteOptimistic,
    recoverNoteOptimistic,
  };
}
