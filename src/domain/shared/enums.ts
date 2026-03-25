// Valeurs des rôles sous forme de constante — utilisable côté client
// sans importer @prisma/client (server-only).
export const MemberRoleValues = ['OWNER', 'ADMIN', 'MEMBER', 'VIEWER'] as const;
export type MemberRoleValue = (typeof MemberRoleValues)[number];
