// ─── Permissions partagées (client-safe) ─────────────────────────────────────
// Version sans @prisma/client — importable côté client (React components, hooks).
// La source de vérité backend reste src/backend/policies/permissions.ts.
// Les deux fichiers doivent rester synchronisés manuellement.

export const ROLE_HIERARCHY: Record<string, number> = {
  OWNER:  4,
  ADMIN:  3,
  MEMBER: 2,
  VIEWER: 1,
};

export const PERMISSIONS = {
  // Notes
  'notes:read':    ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  'notes:create':  ['OWNER', 'ADMIN', 'MEMBER'],
  'notes:update':  ['OWNER', 'ADMIN', 'MEMBER'],
  'notes:delete':  ['OWNER', 'ADMIN', 'MEMBER'],
  'notes:restore': ['OWNER', 'ADMIN', 'MEMBER'],
  'notes:purge':   ['OWNER', 'ADMIN'],

  // Dossiers
  'folders:read':   ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  'folders:manage': ['OWNER', 'ADMIN', 'MEMBER'],

  // Tags
  'tags:read':   ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],
  'tags:manage': ['OWNER', 'ADMIN', 'MEMBER'],

  // Uploads
  'uploads:create': ['OWNER', 'ADMIN', 'MEMBER'],

  // Recherche
  'search:read': ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'],

  // Workspace
  'workspace:settings': ['OWNER', 'ADMIN'],
  'workspace:delete':   ['OWNER'],

  // Membres
  'members:invite': ['OWNER', 'ADMIN'],
  'members:manage': ['OWNER'],
} as const;

export type Permission = keyof typeof PERMISSIONS;

export function can(role: string, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly string[]).includes(role);
}

export function atLeast(role: string, minimum: string): boolean {
  return (ROLE_HIERARCHY[role] ?? 0) >= (ROLE_HIERARCHY[minimum] ?? 0);
}
