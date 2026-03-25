"use client";

import { useCallback } from 'react';
import useSWR from 'swr';
import { useNotesApi } from './useNotesApi';
import type { Folder } from '@/lib/notes-service';

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

const fetcher = (url: string) => fetch(url).then(r => r.json());

const SWR_CONFIG = {
  revalidateOnFocus:     true,
  revalidateOnReconnect: true,
  refreshInterval:       30_000,
  refreshWhenHidden:     false,
  refreshWhenOffline:    false,
  dedupingInterval:      2_000,
};

/**
 * Charge notes, dossiers et tags depuis les routes API PostgreSQL via SWR.
 * Tout se rafraîchit automatiquement au focus de l'onglet et toutes les 30s.
 */
export function useNotes() {
  const {
    notes, deletedNotes,
    loading: notesLoading,
    refresh: refreshNotes,
    deleteNoteOptimistic,
    permanentlyDeleteNoteOptimistic,
    recoverNoteOptimistic,
  } = useNotesApi();

  const {
    data:    foldersData,
    isLoading: foldersLoading,
    mutate:  mutateFolders,
  } = useSWR<{ data: ApiFolderItem[] }>('/api/folders', fetcher, SWR_CONFIG);

  const {
    data:    tagsData,
    isLoading: tagsLoading,
    mutate:  mutateTags,
  } = useSWR<{ data: ApiTagItem[] }>('/api/tags', fetcher, SWR_CONFIG);

  const folders: Folder[] = (foldersData?.data ?? []).map((f, i) => ({
    id:        f.id,
    name:      f.name,
    order:     i,
    parentId:  f.parentId,
    isSmart:   false,
    createdAt: new Date(f.createdAt),
    updatedAt: new Date(f.updatedAt),
  }));

  const manualTags = (tagsData?.data ?? [])
    .map(t => t.name)
    .sort((a, b) => a.localeCompare(b, 'fr'));

  /** Force un re-fetch des dossiers et tags (après rename/create/delete dossier ou tag). */
  const refreshMeta = useCallback(() => {
    mutateFolders();
    mutateTags();
  }, [mutateFolders, mutateTags]);

  return {
    notes,
    deletedNotes,
    folders,
    manualTags,
    loading:      notesLoading || foldersLoading || tagsLoading,
    refreshNotes,
    refreshMeta,
    deleteNoteOptimistic,
    permanentlyDeleteNoteOptimistic,
    recoverNoteOptimistic,
  };
}
