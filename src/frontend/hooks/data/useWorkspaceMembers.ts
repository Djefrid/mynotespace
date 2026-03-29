"use client";

import useSWR from 'swr';

export interface WorkspaceMember {
  userId:   string;
  name:     string | null;
  email:    string | null;
  role:     'OWNER' | 'ADMIN' | 'MEMBER' | 'VIEWER';
  joinedAt: string;
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

export function useWorkspaceMembers() {
  const { data, error, isLoading, mutate } = useSWR<{ data: WorkspaceMember[] }>(
    '/api/workspace/members',
    fetcher,
    SWR_CONFIG,
  );

  return {
    members:        data?.data ?? [],
    membersLoading: isLoading,
    membersError:   error,
    mutateMembers:  mutate,
  };
}
