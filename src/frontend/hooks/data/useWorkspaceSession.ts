"use client";

import useSWR from 'swr';

export interface WorkspaceSessionConfig {
  sessionMaxAgeDays: number;
}

const fetcher = (url: string) => fetch(url).then(r => r.json());

const SWR_CONFIG = {
  revalidateOnFocus:    true,
  revalidateOnReconnect: true,
  refreshInterval:      60_000,
  refreshWhenHidden:    false,
  refreshWhenOffline:   false,
  dedupingInterval:     5_000,
};

export function useWorkspaceSession(enabled: boolean) {
  const { data, error, isLoading, mutate } = useSWR<{ data: WorkspaceSessionConfig }>(
    enabled ? '/api/workspace/session' : null,
    fetcher,
    SWR_CONFIG,
  );

  return {
    sessionConfig:        data?.data ?? null,
    sessionConfigLoading: isLoading,
    sessionConfigError:   error,
    mutateSessionConfig:  mutate,
  };
}
