"use client";

import { useSession } from 'next-auth/react';
import { can as canFn, type Permission } from '@/src/shared/permissions';

/**
 * Hook RBAC côté client.
 * Lit le rôle depuis la session JWT (mis en cache au login).
 *
 * Usage :
 *   const { can, cannot } = usePermissions();
 *   if (can('notes:create')) { ... }
 */
export function usePermissions() {
  const { data: session } = useSession();
  // Fallback VIEWER : protège si le rôle n'est pas encore dans la session
  const role = (session?.user as { workspaceRole?: string })?.workspaceRole ?? 'VIEWER';

  return {
    role,
    can:    (permission: Permission) =>  canFn(role, permission),
    cannot: (permission: Permission) => !canFn(role, permission),
  };
}
