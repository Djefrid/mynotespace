import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/src/backend/db/prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

export type CreateFolderInput = {
  workspaceId: string;
  name: string;
  parentId?: string;
};

export type UpdateFolderInput = {
  name?: string;
  parentId?: string | null;
};

const folderSelect = {
  id:          true,
  name:        true,
  parentId:    true,
  workspaceId: true,
  createdAt:   true,
  updatedAt:   true,
} satisfies Prisma.FolderSelect;

export type FolderItem = Prisma.FolderGetPayload<{ select: typeof folderSelect }>;

// ─── Fonctions ────────────────────────────────────────────────────────────────

/**
 * Retourne tous les dossiers d'un workspace (liste plate).
 * L'arbre est construit côté frontend.
 */
export async function getFoldersForWorkspace(
  workspaceId: string
): Promise<FolderItem[]> {
  return prisma.folder.findMany({
    where: { workspaceId },
    select: folderSelect,
    orderBy: { name: 'asc' },
  });
}

/**
 * Crée un dossier.
 * parentId optionnel — null = dossier racine.
 */
export async function createFolder(input: CreateFolderInput): Promise<FolderItem> {
  const { workspaceId, name, parentId } = input;

  if (parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: parentId, workspaceId },
      select: { id: true },
    });
    if (!parent) throw new Error('Parent folder not found');
  }

  return prisma.folder.create({
    data: { workspaceId, name, parentId: parentId ?? null },
    select: folderSelect,
  });
}

/**
 * Met à jour le nom et/ou le parent d'un dossier.
 * Retourne null si le dossier n'appartient pas au workspace.
 */
export async function updateFolder(
  id: string,
  workspaceId: string,
  input: UpdateFolderInput
): Promise<FolderItem | null> {
  const exists = await prisma.folder.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });
  if (!exists) return null;

  if (input.parentId) {
    const parent = await prisma.folder.findFirst({
      where: { id: input.parentId, workspaceId },
      select: { id: true },
    });
    if (!parent) throw new Error('Parent folder not found');
  }

  return prisma.folder.update({
    where: { id },
    data: input,
    select: folderSelect,
  });
}

/**
 * Supprime un dossier.
 * Cascade Prisma (SetNull) :
 *   - notes du dossier → inbox (folderId = null)
 *   - sous-dossiers   → racine (parentId = null)
 */
export async function deleteFolder(
  id: string,
  workspaceId: string
): Promise<void> {
  await prisma.folder.deleteMany({
    where: { id, workspaceId },
  });
}