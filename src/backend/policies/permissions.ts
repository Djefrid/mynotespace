import { MemberRole } from '@prisma/client';

// ─── Hiérarchie des rôles ─────────────────────────────────────────────────────
// Permet des comparaisons ordinales : OWNER > ADMIN > MEMBER > VIEWER

export const ROLE_HIERARCHY: Record<MemberRole, number> = {
  [MemberRole.OWNER]:  4,
  [MemberRole.ADMIN]:  3,
  [MemberRole.MEMBER]: 2,
  [MemberRole.VIEWER]: 1,
};

// ─── Matrice des permissions ──────────────────────────────────────────────────
// Source de vérité unique. Toute logique "qui peut faire quoi" passe ici.
// Ne jamais écrire `if (role === 'ADMIN')` dans une route — utiliser `can()`.

export const PERMISSIONS = {
  // Notes
  'notes:read':    [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER, MemberRole.VIEWER],
  'notes:create':  [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],
  'notes:update':  [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],
  'notes:delete':  [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],
  'notes:restore': [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],
  'notes:purge':   [MemberRole.OWNER, MemberRole.ADMIN],   // vider la corbeille

  // Dossiers
  'folders:read':   [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER, MemberRole.VIEWER],
  'folders:manage': [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],

  // Tags
  'tags:read':   [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER, MemberRole.VIEWER],
  'tags:manage': [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],

  // Uploads / attachments
  'uploads:create': [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER],

  // Recherche
  'search:read': [MemberRole.OWNER, MemberRole.ADMIN, MemberRole.MEMBER, MemberRole.VIEWER],

  // Workspace
  'workspace:settings': [MemberRole.OWNER, MemberRole.ADMIN],
  'workspace:delete':   [MemberRole.OWNER],

  // Membres
  'members:invite': [MemberRole.OWNER, MemberRole.ADMIN],
  'members:manage': [MemberRole.OWNER],   // changer les rôles, retirer des membres
} as const;

export type Permission = keyof typeof PERMISSIONS;

// ─── Fonction centrale d'autorisation ────────────────────────────────────────

/**
 * Vérifie si un rôle donné dispose d'une permission.
 *
 * Usage dans les route handlers :
 *   const { role } = await requireRole();
 *   if (!can(role, 'notes:delete')) return Response.json(..., { status: 403 });
 */
export function can(role: MemberRole, permission: Permission): boolean {
  return (PERMISSIONS[permission] as readonly MemberRole[]).includes(role);
}

/**
 * Vérifie qu'un rôle est au moins aussi élevé qu'un rôle minimum.
 * Utile pour des checks ordinaux ("au moins ADMIN").
 *
 * Usage : atLeast(role, MemberRole.ADMIN)
 */
export function atLeast(role: MemberRole, minimum: MemberRole): boolean {
  return ROLE_HIERARCHY[role] >= ROLE_HIERARCHY[minimum];
}
