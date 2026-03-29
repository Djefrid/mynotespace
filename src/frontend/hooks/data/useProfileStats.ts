"use client";

import useSWR from 'swr';

export interface ProfileStats {
  createdAt:     string | null;
  authMethod:    'credentials' | 'oauth';
  workspaceName: string;
  activeNotes:   number;
  trashedNotes:  number;
  folderCount:   number;
  tagCount:      number;
  fileCount:     number;
  storageBytes:  number;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

const SWR_CONFIG = {
  revalidateOnFocus:    true,
  revalidateOnReconnect: true,
  refreshInterval:      30_000,
  refreshWhenHidden:    false,
  refreshWhenOffline:   false,
  dedupingInterval:     2_000,
};

export function useProfileStats() {
  const { data, error, isLoading, mutate } = useSWR<{ data: ProfileStats }>(
    '/api/profile/stats',
    fetcher,
    SWR_CONFIG,
  );

  return {
    stats:        data?.data ?? null,
    statsLoading: isLoading,
    statsError:   error,
    mutateStats:  mutate,
  };
}
