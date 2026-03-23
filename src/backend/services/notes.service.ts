/**
 * Types partagés et utilitaires purs de l'éditeur de notes.
 * Les opérations CRUD sont dans notes-mutations-api.ts (frontend) et notes-pg.service.ts (backend).
 */

// ── Types ─────────────────────────────────────────────────────────────────────

/** Représente une note dans l'UI */
export interface Note {
  id: string;
  title: string;
  content: string;           // HTML TipTap
  pinned: boolean;
  folderId: string | null;   // null = Inbox
  tags: string[];
  deletedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/** Filtres d'un dossier intelligent (évalués côté client) */
export interface SmartFolderFilter {
  tags?: string[];
  tagLogic?: 'and' | 'or';
  pinned?: boolean;
  createdWithinDays?: number;
  modifiedWithinDays?: number;
}

/** Représente un dossier dans l'UI */
export interface Folder {
  id: string;
  name: string;
  order: number;
  parentId: string | null;
  isSmart?: boolean;
  filters?: SmartFolderFilter;
  createdAt: Date;
  updatedAt: Date;
}

/** Un tag dans la bibliothèque */
export interface Tag {
  name: string;
  createdAt: Date;
}

// ── Utilitaires purs ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<\/?(p|div|br|h[1-6]|li|ul|ol)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Extrait tous les hashtags (#tag) depuis le contenu HTML d'une note.
 */
export function extractHashtags(content: string): string[] {
  const text  = stripHtml(content);
  const regex = /(?<![/#\w])#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)/g;
  const tags  = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}
