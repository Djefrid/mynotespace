/**
 * ============================================================================
 * TYPES ET CONSTANTES NOTES — lib/notes-types.ts
 * ============================================================================
 *
 * Types TypeScript, constantes et fonctions helpers partagés entre tous les
 * sous-composants de l'éditeur de notes.
 *
 * Séparés de NotesEditor.tsx pour :
 *   - Éliminer les redéfinitions croisées entre sous-composants
 *   - Permettre l'import sélectif (tree-shaking)
 *   - Faciliter les tests unitaires des helpers
 *
 * Contenu :
 *   Types    : ViewFilter, SortBy, SaveStatus, MobilePanel
 *   Helpers  : viewEq, viewLabel
 *   Constantes : AUTOSAVE_DELAY_MS, SLASH_CMDS, LANGUAGES
 * ============================================================================
 */

import type { Editor } from '@tiptap/core';
import type { Folder } from '@/lib/notes-service';

// ── Types de vue et d'état ────────────────────────────────────────────────────

/**
 * Filtre de vue actif dans la sidebar.
 * - Chaînes prédéfinies : 'all' | 'pinned' | 'inbox' | 'trash'
 * - Objets dynamiques   : { type: 'folder', id } | { type: 'tag', tag }
 */
export type ViewFilter =
  | 'all'
  | 'pinned'
  | 'inbox'
  | 'trash'
  | { type: 'folder'; id: string }
  | { type: 'tag';    tag: string };

/** Critère de tri de la liste des notes */
export type SortBy = 'dateModified' | 'dateCreated' | 'title';

/** Statut de la dernière sauvegarde Firestore */
export type SaveStatus = 'saved' | 'saving' | 'unsaved' | 'error';

/** Panneau visible sur mobile (une seule colonne à la fois) */
export type MobilePanel = 'sidebar' | 'list' | 'editor';

// ── Helpers purs ──────────────────────────────────────────────────────────────

/**
 * Compare deux ViewFilter par valeur (JSON.stringify pour les objets).
 * Utilisé pour éviter les re-renders inutiles lors du changement de vue.
 */
export function viewEq(a: ViewFilter, b: ViewFilter): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/**
 * Retourne le libellé lisible d'une vue (pour le header de la liste).
 * - 'all'    → "Toutes les notes"
 * - 'pinned' → "Épinglées"
 * - 'inbox'  → "Toutes mes notes"
 * - 'trash'  → "Corbeille"
 * - folder   → nom du dossier (lookup dans la liste)
 * - tag      → "#nomDuTag"
 */
export function viewLabel(view: ViewFilter, folders: Folder[]): string {
  if (view === 'all')    return 'Toutes les notes';
  if (view === 'pinned') return 'Épinglées';
  if (view === 'inbox')  return 'Toutes mes notes';
  if (view === 'trash')  return 'Corbeille';
  if (typeof view === 'object' && view.type === 'folder')
    return folders.find(f => f.id === view.id)?.name ?? 'Dossier';
  if (typeof view === 'object' && view.type === 'tag')
    return `#${view.tag}`;
  return '';
}

// ── Constantes ────────────────────────────────────────────────────────────────

/** Délai d'autosave en ms après la dernière frappe (1 seconde) */
export const AUTOSAVE_DELAY_MS = 1000;

/**
 * Commandes slash disponibles dans l'éditeur.
 * Déclenchées par "/" en début de paragraphe.
 * Chaque commande a : id unique, libellé affiché, description, fonction apply(editor).
 */
export const SLASH_CMDS = [
  { id: 'h1',    label: 'Titre 1',         desc: 'Grand titre',          apply: (e: Editor) => e.chain().focus().toggleHeading({ level: 1 }).run() },
  { id: 'h2',    label: 'Titre 2',         desc: 'Titre moyen',          apply: (e: Editor) => e.chain().focus().toggleHeading({ level: 2 }).run() },
  { id: 'h3',    label: 'Titre 3',         desc: 'Sous-titre',           apply: (e: Editor) => e.chain().focus().toggleHeading({ level: 3 }).run() },
  { id: 'ul',    label: 'Liste à puces',   desc: 'Liste non ordonnée',   apply: (e: Editor) => e.chain().focus().toggleBulletList().run() },
  { id: 'ol',    label: 'Liste numérotée', desc: 'Liste ordonnée',       apply: (e: Editor) => e.chain().focus().toggleOrderedList().run() },
  { id: 'todo',  label: 'Tâches',          desc: 'Cases à cocher',       apply: (e: Editor) => e.chain().focus().toggleTaskList().run() },
  { id: 'quote', label: 'Citation',        desc: 'Bloc de citation',     apply: (e: Editor) => e.chain().focus().toggleBlockquote().run() },
  { id: 'code',  label: 'Bloc de code',    desc: 'Code avec coloration', apply: (e: Editor) => e.chain().focus().toggleCodeBlock().run() },
  { id: 'table', label: 'Tableau',         desc: 'Tableau 3×3',          apply: (e: Editor) => e.chain().focus().insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run() },
  { id: 'hr',    label: 'Séparateur',      desc: 'Ligne horizontale',    apply: (e: Editor) => e.chain().focus().setHorizontalRule().run() },
] as const;

/**
 * Langages disponibles pour les blocs de code.
 * Haskell est exclu — sa grammar highlight.js contient une regex invalide
 * que Next.js corrompt au build (crash prod : "Invalid regular expression").
 * 'auto' utilise defaultLanguage: 'plaintext' (pas d'auto-détection).
 */
export const LANGUAGES = [
  { value: 'auto',       label: 'Auto' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python',     label: 'Python' },
  { value: 'java',       label: 'Java' },
  { value: 'c',          label: 'C' },
  { value: 'cpp',        label: 'C++' },
  { value: 'csharp',     label: 'C#' },
  { value: 'go',         label: 'Go' },
  { value: 'rust',       label: 'Rust' },
  { value: 'php',        label: 'PHP' },
  { value: 'ruby',       label: 'Ruby' },
  { value: 'swift',      label: 'Swift' },
  { value: 'kotlin',     label: 'Kotlin' },
  { value: 'html',       label: 'HTML' },
  { value: 'css',        label: 'CSS' },
  { value: 'json',       label: 'JSON' },
  { value: 'yaml',       label: 'YAML' },
  { value: 'sql',        label: 'SQL' },
  { value: 'bash',       label: 'Bash' },
  { value: 'markdown',   label: 'Markdown' },
] as const;
