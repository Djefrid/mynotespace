import { describe, it, expect } from 'vitest';
import { MemberRole } from '@prisma/client';
import { can, atLeast, PERMISSIONS, ROLE_HIERARCHY } from '@/src/backend/policies/permissions';

// ─── Tests de la matrice de permissions ──────────────────────────────────────

describe('can()', () => {
  // Notes — lecture
  it('VIEWER peut lire les notes', () => {
    expect(can(MemberRole.VIEWER, 'notes:read')).toBe(true);
  });

  // Notes — création
  it('MEMBER peut créer une note', () => {
    expect(can(MemberRole.MEMBER, 'notes:create')).toBe(true);
  });
  it('VIEWER ne peut pas créer une note', () => {
    expect(can(MemberRole.VIEWER, 'notes:create')).toBe(false);
  });

  // Notes — modification
  it('MEMBER peut modifier une note', () => {
    expect(can(MemberRole.MEMBER, 'notes:update')).toBe(true);
  });
  it('VIEWER ne peut pas modifier une note', () => {
    expect(can(MemberRole.VIEWER, 'notes:update')).toBe(false);
  });

  // Notes — suppression soft
  it('MEMBER peut mettre une note à la corbeille', () => {
    expect(can(MemberRole.MEMBER, 'notes:delete')).toBe(true);
  });
  it('VIEWER ne peut pas mettre une note à la corbeille', () => {
    expect(can(MemberRole.VIEWER, 'notes:delete')).toBe(false);
  });

  // Notes — purge (suppression permanente)
  it('OWNER peut purger la corbeille', () => {
    expect(can(MemberRole.OWNER, 'notes:purge')).toBe(true);
  });
  it('ADMIN peut purger la corbeille', () => {
    expect(can(MemberRole.ADMIN, 'notes:purge')).toBe(true);
  });
  it('MEMBER ne peut pas purger la corbeille', () => {
    expect(can(MemberRole.MEMBER, 'notes:purge')).toBe(false);
  });
  it('VIEWER ne peut pas purger la corbeille', () => {
    expect(can(MemberRole.VIEWER, 'notes:purge')).toBe(false);
  });

  // Dossiers / tags
  it('MEMBER peut gérer les dossiers', () => {
    expect(can(MemberRole.MEMBER, 'folders:manage')).toBe(true);
  });
  it('VIEWER ne peut pas gérer les dossiers', () => {
    expect(can(MemberRole.VIEWER, 'folders:manage')).toBe(false);
  });
  it('MEMBER peut gérer les tags', () => {
    expect(can(MemberRole.MEMBER, 'tags:manage')).toBe(true);
  });

  // Uploads
  it('MEMBER peut uploader des fichiers', () => {
    expect(can(MemberRole.MEMBER, 'uploads:create')).toBe(true);
  });
  it('VIEWER ne peut pas uploader', () => {
    expect(can(MemberRole.VIEWER, 'uploads:create')).toBe(false);
  });

  // Workspace — actions sensibles
  it('seul OWNER peut supprimer le workspace', () => {
    expect(can(MemberRole.OWNER,  'workspace:delete')).toBe(true);
    expect(can(MemberRole.ADMIN,  'workspace:delete')).toBe(false);
    expect(can(MemberRole.MEMBER, 'workspace:delete')).toBe(false);
    expect(can(MemberRole.VIEWER, 'workspace:delete')).toBe(false);
  });
  it('OWNER et ADMIN peuvent accéder aux paramètres workspace', () => {
    expect(can(MemberRole.OWNER,  'workspace:settings')).toBe(true);
    expect(can(MemberRole.ADMIN,  'workspace:settings')).toBe(true);
    expect(can(MemberRole.MEMBER, 'workspace:settings')).toBe(false);
  });

  // Membres
  it('OWNER et ADMIN peuvent inviter des membres', () => {
    expect(can(MemberRole.OWNER,  'members:invite')).toBe(true);
    expect(can(MemberRole.ADMIN,  'members:invite')).toBe(true);
    expect(can(MemberRole.MEMBER, 'members:invite')).toBe(false);
  });
  it('seul OWNER peut gérer les rôles', () => {
    expect(can(MemberRole.OWNER,  'members:manage')).toBe(true);
    expect(can(MemberRole.ADMIN,  'members:manage')).toBe(false);
  });
});

// ─── Tests de atLeast() ───────────────────────────────────────────────────────

describe('atLeast()', () => {
  it('OWNER est au moins ADMIN', () => {
    expect(atLeast(MemberRole.OWNER, MemberRole.ADMIN)).toBe(true);
  });
  it('ADMIN est au moins MEMBER', () => {
    expect(atLeast(MemberRole.ADMIN, MemberRole.MEMBER)).toBe(true);
  });
  it('MEMBER est au moins MEMBER', () => {
    expect(atLeast(MemberRole.MEMBER, MemberRole.MEMBER)).toBe(true);
  });
  it('MEMBER n\'est pas au moins ADMIN', () => {
    expect(atLeast(MemberRole.MEMBER, MemberRole.ADMIN)).toBe(false);
  });
  it('VIEWER n\'est pas au moins MEMBER', () => {
    expect(atLeast(MemberRole.VIEWER, MemberRole.MEMBER)).toBe(false);
  });
});

// ─── Invariants de la matrice ─────────────────────────────────────────────────

describe('invariants PERMISSIONS', () => {
  it('toutes les permissions ont au moins OWNER autorisé', () => {
    const permissions = Object.keys(PERMISSIONS) as (keyof typeof PERMISSIONS)[];
    for (const p of permissions) {
      expect(can(MemberRole.OWNER, p)).toBe(true);
    }
  });

  it('la hiérarchie OWNER > ADMIN > MEMBER > VIEWER est correcte', () => {
    expect(ROLE_HIERARCHY[MemberRole.OWNER]).toBeGreaterThan(ROLE_HIERARCHY[MemberRole.ADMIN]);
    expect(ROLE_HIERARCHY[MemberRole.ADMIN]).toBeGreaterThan(ROLE_HIERARCHY[MemberRole.MEMBER]);
    expect(ROLE_HIERARCHY[MemberRole.MEMBER]).toBeGreaterThan(ROLE_HIERARCHY[MemberRole.VIEWER]);
  });
});
