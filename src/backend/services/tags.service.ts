import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/src/backend/db/prisma';

// ─── Types ────────────────────────────────────────────────────────────────────

const tagSelect = {
  id:          true,
  name:        true,
  workspaceId: true,
  createdAt:   true,
  _count: { select: { notes: true } },
} satisfies Prisma.TagSelect;

export type TagItem = Prisma.TagGetPayload<{ select: typeof tagSelect }>;

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalise un nom de tag : minuscules + trim. */
function normalizeTagName(name: string): string {
  return name.toLowerCase().trim();
}

// ─── Fonctions ────────────────────────────────────────────────────────────────

/**
 * Retourne tous les tags d'un workspace avec le nombre de notes associées.
 */
export async function getTagsForWorkspace(
  workspaceId: string
): Promise<TagItem[]> {
  return prisma.tag.findMany({
    where: { workspaceId },
    select: tagSelect,
    orderBy: { name: 'asc' },
  });
}

/**
 * Crée un tag normalisé ou retourne l'existant (upsert).
 * La contrainte @@unique([workspaceId, name]) garantit l'unicité en base.
 */
export async function createTag(
  workspaceId: string,
  name: string
): Promise<TagItem> {
  const normalized = normalizeTagName(name);
  if (!normalized) throw new Error('Tag name cannot be empty');

  return prisma.tag.upsert({
    where: {
      workspaceId_name: { workspaceId, name: normalized },
    },
    create: { workspaceId, name: normalized },
    update: {},
    select: tagSelect,
  });
}

/**
 * Supprime un tag.
 * Cascade Prisma (via NoteTag) : retire le tag de toutes les notes associées.
 */
export async function deleteTag(
  id: string,
  workspaceId: string
): Promise<void> {
  await prisma.tag.deleteMany({
    where: { id, workspaceId },
  });
}