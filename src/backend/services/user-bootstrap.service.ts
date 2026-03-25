import 'server-only';

import { MemberRole } from '@prisma/client';
import { prisma } from '@/src/backend/db/prisma';

/**
 * Provisionne un workspace personnel pour un utilisateur.
 *
 * Idempotent : si le workspace existe déjà, retourne son id sans rien créer.
 * Utilisé au premier login — safe à rappeler sur chaque connexion.
 *
 * @returns L'id du workspace personnel de l'utilisateur.
 */
export async function provisionPersonalWorkspace(userId: string): Promise<string> {
  const existing = await prisma.workspace.findFirst({
    where: { ownerUserId: userId },
    select: { id: true },
  });

  if (existing) {
    // Garantit que le membre OWNER existe même si le workspace préexistait (migration)
    await prisma.workspaceMember.upsert({
      where:  { workspaceId_userId: { workspaceId: existing.id, userId } },
      create: { workspaceId: existing.id, userId, role: MemberRole.OWNER },
      update: {},
    });
    return existing.id;
  }

  const workspace = await prisma.$transaction(async (tx) => {
    const ws = await tx.workspace.create({
      data: {
        name: 'Mon espace',
        ownerUserId: userId,
      },
    });

    await tx.workspaceMember.create({
      data: {
        workspaceId: ws.id,
        userId,
        role: MemberRole.OWNER,
      },
    });

    return ws;
  });

  return workspace.id;
}