// Re-export du type Prisma — évite les imports directs de @prisma/client
// dans les couches domain/frontend.
export { MemberRole } from '@prisma/client';

export type WorkspaceRole = import('@prisma/client').MemberRole;
