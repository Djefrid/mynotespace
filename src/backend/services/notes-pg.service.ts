import 'server-only';

/**
 * Service notes — couche Prisma/PostgreSQL.
 *
 * Règle fondamentale : toute opération filtre par workspaceId.
 * Jamais d'accès à une note par son seul id sans contrôle de workspace.
 *
 * Ce fichier remplacera notes.service.ts (Firebase) lors de la migration frontend.
 */

import { NoteStatus, Prisma } from '@prisma/client';
import { prisma } from '@/src/backend/db/prisma';

// ─── Types entrée ─────────────────────────────────────────────────────────────

export type CreateNoteInput = {
  workspaceId: string;
  userId: string;
  title?: string;
  html?: string;
  folderId?: string;
};

/** Métadonnées uniquement — le contenu va dans saveNoteContent. */
export type UpdateNoteInput = {
  userId:    string;
  title?:    string;
  folderId?: string | null;
  isPinned?: boolean;
};

// ─── Select partagés ──────────────────────────────────────────────────────────

/** Métadonnées + tags + extrait texte — utilisé pour les listes. */
const noteListSelect = {
  id: true,
  title: true,
  status: true,
  isPinned: true,
  folderId: true,
  version: true,
  trashedAt: true,
  createdAt: true,
  updatedAt: true,
  tags: {
    select: {
      tag: { select: { id: true, name: true } },
    },
  },
  content: { select: { plainText: true } },
} satisfies Prisma.NoteSelect;

/** Note complète avec contenu — utilisé pour la vue détail. */
const noteDetailSelect = {
  ...noteListSelect,
  content: { select: { html: true, json: true, plainText: true, updatedAt: true } },
} satisfies Prisma.NoteSelect;

// ─── Types inférés ────────────────────────────────────────────────────────────

export type NoteListItem  = Prisma.NoteGetPayload<{ select: typeof noteListSelect }>;
export type NoteDetail    = Prisma.NoteGetPayload<{ select: typeof noteDetailSelect }>;

// ─── Fonctions ────────────────────────────────────────────────────────────────

/**
 * Crée une note avec son contenu en une seule transaction.
 */
export async function createNote(input: CreateNoteInput): Promise<NoteListItem> {
  const { workspaceId, userId, title = '', html = '', folderId } = input;

  return prisma.$transaction(async (tx) => {
    const note = await tx.note.create({
      data: {
        workspaceId,
        folderId: folderId ?? null,
        title,
        updatedByUserId: userId,
        content: { create: { html } },
      },
      select: noteListSelect,
    });
    return note;
  });
}

/**
 * Liste les notes d'un workspace.
 * Par défaut : notes ACTIVE, triées par updatedAt DESC.
 */
export async function getNotesForWorkspace(
  workspaceId: string,
  options: {
    status?: NoteStatus;
    folderId?: string | null;
    limit?: number;
    cursor?: string;
  } = {}
): Promise<NoteListItem[]> {
  const { status = NoteStatus.ACTIVE, folderId, limit = 200, cursor } = options;

  return prisma.note.findMany({
    where: {
      workspaceId,
      status,
      ...(folderId !== undefined && { folderId }),
    },
    select: noteListSelect,
    orderBy: { updatedAt: 'desc' },
    take: limit,
    ...(cursor && { cursor: { id: cursor }, skip: 1 }),
  });
}

/**
 * Retourne une note avec son contenu.
 * Vérifie obligatoirement l'appartenance au workspace.
 */
export async function getNoteByIdForWorkspace(
  id: string,
  workspaceId: string
): Promise<NoteDetail | null> {
  return prisma.note.findFirst({
    where: { id, workspaceId },
    select: noteDetailSelect,
  });
}

/**
 * Met à jour titre, contenu, dossier ou épinglage.
 * Incrémente la version à chaque appel.
 * Crée NoteContent si absent (upsert).
 */
/**
 * Met à jour les métadonnées d'une note (titre, dossier, épingle).
 * Le version s'incrémente uniquement sur les changements structurels
 * (isPinned, folderId) — pas sur la frappe du titre.
 * Le contenu HTML se sauvegarde via saveNoteContent.
 */
export async function updateNote(
  id: string,
  workspaceId: string,
  input: UpdateNoteInput
): Promise<NoteDetail | null> {
  const { userId, title, folderId, isPinned } = input;

  // Version++ uniquement si on change l'organisation (pin/dossier),
  // pas à chaque frappe dans le titre.
  const bumpVersion = isPinned !== undefined || folderId !== undefined;

  return prisma.$transaction(async (tx) => {
    const exists = await tx.note.findFirst({
      where: { id, workspaceId },
      select: { id: true },
    });
    if (!exists) return null;

    return tx.note.update({
      where: { id },
      data: {
        ...(title    !== undefined && { title }),
        ...(folderId !== undefined && { folderId }),
        ...(isPinned !== undefined && { isPinned }),
        updatedByUserId: userId,
        ...(bumpVersion && { version: { increment: 1 } }),
      },
      select: noteDetailSelect,
    });
  });
}

/**
 * Sauvegarde le contenu d'une note (NoteContent).
 * json      = source de vérité (structure ProseMirror native)
 * html      = dérivé cache (exports DOCX/PDF/Markdown)
 * plainText = dérivé recherche (Typesense, préview)
 * N'incrémente pas version — c'est de l'édition continue, pas un changement structurel.
 * Touche Note.updatedAt via updatedByUserId pour que les listes restent triées.
 */
/** Délai minimum entre deux révisions d'une même note (5 minutes). */
const REVISION_THROTTLE_MS = 5 * 60 * 1000;

export async function saveNoteContent(
  id: string,
  workspaceId: string,
  userId: string,
  data: {
    html:            string;
    json?:           Record<string, unknown>;
    plainText?:      string;
    wordCount?:      number;
    characterCount?: number;
  }
): Promise<boolean> {
  const exists = await prisma.note.findFirst({
    where: { id, workspaceId },
    select: { id: true },
  });
  if (!exists) return false;

  const contentData = {
    html:           data.html,
    plainText:      data.plainText ?? '',
    wordCount:      data.wordCount ?? 0,
    characterCount: data.characterCount ?? 0,
    ...(data.json !== undefined && { json: data.json as Prisma.InputJsonValue }),
  };

  await prisma.$transaction([
    prisma.noteContent.upsert({
      where:  { noteId: id },
      create: { noteId: id, ...contentData },
      update: contentData,
    }),
    prisma.note.update({
      where: { id },
      data:  { updatedByUserId: userId },
    }),
  ]);

  // ── Révision automatique (throttle 5 min) ──────────────────────────────────
  // Crée un snapshot JSON uniquement si data.json est présent et si la dernière
  // révision date de plus de REVISION_THROTTLE_MS.
  if (data.json) {
    const lastRevision = await prisma.noteRevision.findFirst({
      where:   { noteId: id },
      orderBy: { createdAt: 'desc' },
      select:  { createdAt: true },
    });
    const shouldRevise =
      !lastRevision ||
      Date.now() - lastRevision.createdAt.getTime() > REVISION_THROTTLE_MS;

    if (shouldRevise) {
      await prisma.noteRevision.create({
        data: {
          noteId:    id,
          json:      data.json as Prisma.InputJsonValue,
          plainText: data.plainText ?? '',
          wordCount: data.wordCount ?? 0,
        },
      });

      // Purge : garde les 50 révisions les plus récentes, supprime le reste
      const all = await prisma.noteRevision.findMany({
        where:   { noteId: id },
        orderBy: { createdAt: 'asc' },
        select:  { id: true },
      });
      if (all.length > 50) {
        const toDelete = all.slice(0, all.length - 50).map(r => r.id);
        await prisma.noteRevision.deleteMany({ where: { id: { in: toDelete } } });
      }
    }
  }

  return true;
}

/**
 * Déplace la note dans la corbeille (soft delete).
 * La note reste récupérable jusqu'à purge (30 jours).
 */
export async function softDeleteNote(
  id: string,
  workspaceId: string
): Promise<void> {
  await prisma.note.updateMany({
    where: { id, workspaceId },
    data: {
      status: NoteStatus.TRASHED,
      isPinned: false,
      trashedAt: new Date(),
    },
  });
}

/**
 * Restaure une note depuis la corbeille.
 */
export async function restoreNote(
  id: string,
  workspaceId: string
): Promise<void> {
  await prisma.note.updateMany({
    where: { id, workspaceId, status: NoteStatus.TRASHED },
    data: {
      status: NoteStatus.ACTIVE,
      trashedAt: null,
    },
  });
}

/**
 * Suppression définitive — supprime la ligne en base.
 * La suppression des fichiers R2 sera ajoutée dans une itération ultérieure.
 */
export async function deleteNotePermanently(
  id: string,
  workspaceId: string
): Promise<void> {
  await prisma.note.deleteMany({ where: { id, workspaceId } });
}

/**
 * Purge les notes en corbeille depuis plus de `retentionDays` jours.
 * Opération globale intentionnelle — pas de filtre workspaceId.
 * Appelée uniquement par le cron Inngest `fnPurgeTrash` (pas par les routes API).
 * Retourne les ids supprimés (pour permettre le nettoyage R2 + Typesense en aval).
 */
export async function purgeOldTrashedNotes(
  retentionDays: number = 30
): Promise<string[]> {
  const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000);

  // Récupère les ids avant suppression pour les passer au cleanup Typesense/R2
  const notes = await prisma.note.findMany({
    where: {
      status:    NoteStatus.TRASHED,
      trashedAt: { lt: cutoff },
    },
    select: { id: true },
  });

  if (notes.length === 0) return [];

  const ids = notes.map((n) => n.id);

  await prisma.note.deleteMany({
    where: { id: { in: ids } },
  });

  return ids;
}