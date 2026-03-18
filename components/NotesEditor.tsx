/**
 * ============================================================================
 * ÉDITEUR DE NOTES — components/admin/NotesEditor.tsx
 * ============================================================================
 *
 * Éditeur de notes riche style Apple Notes/Notion pour le panneau admin.
 * 3 colonnes : sidebar (dossiers/tags) · liste des notes · éditeur TipTap.
 *
 * ── Composants internes ────────────────────────────────────────────────────
 *
 * SmartFolderModal   : modal de création/édition des dossiers intelligents
 *                      (filtres par tags, épinglées, dates)
 * FolderTreeItem     : item récursif de l'arbre de dossiers (depth-first)
 * EditorToolbar      : barre d'outils Ribbon style Word (4 onglets)
 *                      Accueil    : police, taille, style, formatage, couleurs
 *                      Insertion  : tableau, lien, image, fichier, dessin, LaTeX, symboles
 *                      Paragraphe : alignement, retrait, interligne, listes, blocs
 *                      Outils     : recherche/remplace, import/export, imprimer
 * NotesSidebar       : panneau gauche avec vues, dossiers, dossiers intelligents,
 *                      tags et corbeille
 * NotesEditor        : composant principal (export default)
 * NoteCard           : carte de note dans la liste (framer-motion + layout)
 *
 * ── TipTap Editor (useEditor) ──────────────────────────────────────────────
 *
 * 26 extensions configurées :
 *   StarterKit (sans codeBlock), CodeBlockLowlight (lowlight v3, tous langages),
 *   ImageExtension, Placeholder, Underline, Link, Table+Row+Header+Cell,
 *   TextAlign, Highlight (multicolor), TextStyle, Color, TaskList, TaskItem,
 *   Superscript, Subscript, CharacterCount, FontFamily, FontSize, LineHeight,
 *   Indent (custom), Mathematics (LaTeX inline via KaTeX)
 *
 * Options critiques :
 *   - `immediatelyRender: false` → obligatoire TipTap 3 + Next.js SSR
 *   - `spellcheck: 'true'` → correcteur natif du navigateur
 *   - `transformPastedHTML` → normalise le wrapper VS Code
 *   - `handlePaste` → détecte image pure vs texte (Chrome ajoute image/png
 *     même sur du texte copié, on ne l'intercepete que si pas de text/*)
 *   - `handleDrop` → images inline ou fichiers joints via Firebase Storage
 *   - `handleKeyDown` → navigation dans slash commands + autocomplétion tags
 *
 * ── Autosave ───────────────────────────────────────────────────────────────
 *
 * Délai : AUTOSAVE_DELAY_MS = 1000ms après la dernière frappe.
 * Ctrl+S : sauvegarde immédiate (bypass du délai).
 * Guard : si `isReadOnly` (note dans la corbeille) → pas de sauvegarde.
 *
 * ── Sync Firestore multi-appareils ─────────────────────────────────────────
 *
 * Un useEffect surveille `notes` (onSnapshot Firestore via useAdminNotes).
 * Si la note ouverte a changé sur un autre appareil ET que l'éditeur n'a
 * pas le focus → met à jour l'éditeur sans écraser la frappe locale.
 * Si l'éditeur a le focus (`editor.view.hasFocus()`) → ignore la mise à jour.
 *
 * ── Autocomplétion ─────────────────────────────────────────────────────────
 *
 * Contenu : détectAtCursor() analyse le texte avant le curseur.
 *   - "/" ou "/partial" en début de paragraphe → menu slash commands (SLASH_CMDS)
 *   - "#" ou "#partial" → popup de tags (allTags filtré par fuzzy match)
 * Titre  : même logique dans handleTitleChange
 * Navigation popup : ↑↓ · Tab/Enter (accepte) · Escape (ferme)
 *
 * ── Refs anti-stale-closure ────────────────────────────────────────────────
 *
 * Les callbacks utilisés dans `editorProps` de `useEditor` sont créés une seule
 * fois (pas de recréation sur rerenders). Pour qu'ils accèdent aux valeurs les
 * plus récentes de state/callbacks, on utilise des refs "proxy" :
 *   suggestionsRef, suggestionIdxRef, applySuggestionRef,
 *   handleImageInsertRef, scheduleAutoSaveRef, applySlashRef, detectAtCursorRef
 *
 * ── Slash Commands ─────────────────────────────────────────────────────────
 *
 * Tapez "/" en début de paragraphe → menu contextuel SLASH_CMDS.
 * Enter/Tab → applique la commande sélectionnée.
 * La commande supprime d'abord le texte "/" + filtre avant d'insérer le nœud.
 *
 * ── Persistance localStorage ───────────────────────────────────────────────
 *
 * `notes_view`       : dernier filtre actif (inbox, dossier, tag...)
 * `notes_selectedId` : dernière note ouverte
 * Restauration au montage, après que Firestore ET l'éditeur soient prêts
 * (`hasRestoredRef` garantit l'exécution unique).
 *
 * ── Suppression douce des notes vides ──────────────────────────────────────
 *
 * Quand l'utilisateur change de note, si l'ancienne était vide (titre vide
 * ET contenu vide après strip HTML), elle est supprimée silencieusement.
 * Comportement Apple Notes : pas de note vide qui traîne dans la liste.
 *
 * ── Animation "fly to trash" ───────────────────────────────────────────────
 *
 * Quand une note est supprimée, une copie fantôme de la carte de note
 * vole vers le bouton Corbeille (framer-motion), puis le bouton tremble.
 * Position calculée via getBoundingClientRect().
 *
 * ── Modes mobile ───────────────────────────────────────────────────────────
 *
 * `mobilePanel` : 'sidebar' | 'list' | 'editor'
 * Sur mobile, une seule colonne est visible à la fois.
 * `focusMode`   : plein écran de l'éditeur (masque sidebar + liste).
 * ============================================================================
 */

"use client";

import {
  useState, useEffect, useRef, useCallback, useMemo, forwardRef,
} from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Plus, Pin, Trash2, Search, StickyNote, FolderPlus,
  Hash, MoreHorizontal, FolderOpen, Folder, ArrowLeft,
  ChevronRight, X, RotateCcw, ArrowUpDown, Zap, Image as ImageIcon,
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks,
  Quote, Minus, Code2, Link as LinkIcon,
  Table as TableIcon, Highlighter,
  Subscript as SubIcon, Superscript as SupIcon,
  Undo2, Redo2, FileUp, Maximize2, Minimize2, Download, FileText, Pencil,
  FileDown, FilePlus, BookOpen,
  Eraser, IndentIncrease, IndentDecrease, CaseSensitive, Sigma, SearchCode,
  ChevronDown, Replace, LogOut, User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/hooks';
import dynamic from 'next/dynamic';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { importDocx, exportDocx } from '@/lib/docx-utils';
import { extractTextFromPdf } from '@/lib/pdf-utils';
import { Indent } from '@/lib/tiptap-extensions/indent';
import Mathematics from '@tiptap/extension-mathematics';
import { useEditor, EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
// Langages importés individuellement — Haskell exclu (bug regex Next.js prod)
// highlightAuto() n'est jamais appelé grâce à defaultLanguage: 'plaintext'
import langJs         from 'highlight.js/lib/languages/javascript';
import langTs         from 'highlight.js/lib/languages/typescript';
import langPy         from 'highlight.js/lib/languages/python';
import langCss        from 'highlight.js/lib/languages/css';
import langHtml       from 'highlight.js/lib/languages/xml';
import langBash       from 'highlight.js/lib/languages/bash';
import langJson       from 'highlight.js/lib/languages/json';
import langSql        from 'highlight.js/lib/languages/sql';
import langGo         from 'highlight.js/lib/languages/go';
import langRust       from 'highlight.js/lib/languages/rust';
import langJava       from 'highlight.js/lib/languages/java';
import langPhp        from 'highlight.js/lib/languages/php';
import langCsharp     from 'highlight.js/lib/languages/csharp';
import langCpp        from 'highlight.js/lib/languages/cpp';
import langMarkdown   from 'highlight.js/lib/languages/markdown';
import langPlaintext  from 'highlight.js/lib/languages/plaintext';
import ImageExtension from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, FontFamily, FontSize, LineHeight } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import CharacterCount from '@tiptap/extension-character-count';
import { uploadNoteImage, uploadNoteFile } from '@/lib/upload-image';
import { useAdminNotes } from '@/hooks/useAdminNotes';
import {
  createNote, updateNote, deleteNote, moveNote,
  permanentlyDeleteNote, recoverNote, silentlyDeleteNote,
  createFolder, createSmartFolder, updateFolder, updateSmartFolderFilters, deleteFolder,
  createTag, deleteTag,
  Note, Folder as FolderType, SmartFolderFilter,
} from '@/lib/notes-service';

// ── Lowlight instance (module-level pour éviter recréation) ───────────────────
// Liste sélective de langages — Haskell exclu (crash Next.js prod : regex invalide)
// defaultLanguage: 'plaintext' → les blocs sans langage explicite (paste, etc.)
// utilisent plaintext au lieu de highlightAuto() qui crashait
const lowlight = createLowlight();
lowlight.register({
  javascript: langJs,
  typescript: langTs,
  python:     langPy,
  css:        langCss,
  xml:        langHtml,   // html est un alias de xml dans highlight.js
  bash:       langBash,
  json:       langJson,
  sql:        langSql,
  go:         langGo,
  rust:       langRust,
  java:       langJava,
  php:        langPhp,
  csharp:     langCsharp,
  cpp:        langCpp,
  markdown:   langMarkdown,
  plaintext:  langPlaintext,
});

// ── Constantes ────────────────────────────────────────────────────────────────
const AUTOSAVE_DELAY_MS = 1000;

// ── Slash commands ────────────────────────────────────────────────────────────
const SLASH_CMDS = [
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

// ── Langages pour code blocks ─────────────────────────────────────────────────
const LANGUAGES = [
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

// ── Types ────────────────────────────────────────────────────────────────────

type ViewFilter =
  | 'all'
  | 'pinned'
  | 'inbox'
  | 'trash'
  | { type: 'folder'; id: string }
  | { type: 'tag';    tag: string };

type SortBy      = 'dateModified' | 'dateCreated' | 'title';
type SaveStatus  = 'saved' | 'saving' | 'unsaved' | 'error';
type MobilePanel = 'sidebar' | 'list' | 'editor';

// ── Helpers ──────────────────────────────────────────────────────────────────

function viewEq(a: ViewFilter, b: ViewFilter) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function fmtDate(d: Date): string {
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Auj.';
  if (days === 1) return 'Hier';
  if (days < 7)   return `${days}j`;
  return d.toLocaleDateString('fr-CA', { day: 'numeric', month: 'short' });
}

function daysUntilPurge(deletedAt: Date): number {
  const diff = 30 - Math.floor((Date.now() - deletedAt.getTime()) / 86400000);
  return Math.max(0, diff);
}

/** Retire les balises HTML — compatible plain text ET contenu HTML de TipTap. */
function stripHtml(html: string): string {
  return html
    .replace(/<\/?(p|div|br|h[1-6]|li|ul|ol)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

function viewLabel(view: ViewFilter, folders: FolderType[]): string {
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

function applySmartFilters(notes: Note[], filters: SmartFolderFilter): Note[] {
  let result = [...notes];
  if (filters.tags && filters.tags.length > 0) {
    result = filters.tagLogic === 'and'
      ? result.filter(n => filters.tags!.every(t => n.tags.includes(t)))
      : result.filter(n => filters.tags!.some(t => n.tags.includes(t)));
  }
  if (filters.pinned !== undefined) {
    result = result.filter(n => n.pinned === filters.pinned);
  }
  if (filters.createdWithinDays) {
    const cutoff = new Date(Date.now() - filters.createdWithinDays * 86400000);
    result = result.filter(n => n.createdAt >= cutoff);
  }
  if (filters.modifiedWithinDays) {
    const cutoff = new Date(Date.now() - filters.modifiedWithinDays * 86400000);
    result = result.filter(n => n.updatedAt >= cutoff);
  }
  return result;
}

// ── Arbre de dossiers ─────────────────────────────────────────────────────────

interface FolderNode extends FolderType { children: FolderNode[]; }

function buildFolderTree(folders: FolderType[]): FolderNode[] {
  const regular = folders.filter(f => !f.isSmart);
  const map = new Map<string, FolderNode>();
  regular.forEach(f => map.set(f.id, { ...f, children: [] }));
  const roots: FolderNode[] = [];
  regular.forEach(f => {
    const node = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) map.get(f.parentId)!.children.push(node);
    else roots.push(node);
  });
  const sort = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach(n => sort(n.children));
  };
  sort(roots);
  return roots;
}

// ── SmartFolderModal ──────────────────────────────────────────────────────────

function SmartFolderModal({
  allTags,
  initial,
  onConfirm,
  onCancel,
}: {
  allTags:   string[];
  initial?:  { name: string; filters: SmartFolderFilter };
  onConfirm: (name: string, filters: SmartFolderFilter) => void;
  onCancel:  () => void;
}) {
  const [name,            setName]            = useState(initial?.name ?? 'Dossier intelligent');
  const [useTags,         setUseTags]         = useState(!!(initial?.filters?.tags?.length));
  const [selectedTags,    setSelectedTags]    = useState<string[]>(initial?.filters?.tags ?? []);
  const [tagLogic,        setTagLogic]        = useState<'and' | 'or'>(initial?.filters?.tagLogic ?? 'or');
  const [usePinned,       setUsePinned]       = useState(initial?.filters?.pinned !== undefined);
  const [useCreatedDays,  setUseCreatedDays]  = useState(!!(initial?.filters?.createdWithinDays));
  const [createdDays,     setCreatedDays]     = useState(initial?.filters?.createdWithinDays ?? 7);
  const [useModifiedDays, setUseModifiedDays] = useState(!!(initial?.filters?.modifiedWithinDays));
  const [modifiedDays,    setModifiedDays]    = useState(initial?.filters?.modifiedWithinDays ?? 7);

  const handleSubmit = () => {
    const filters: SmartFolderFilter = {};
    if (useTags && selectedTags.length > 0) {
      filters.tags     = selectedTags;
      filters.tagLogic = tagLogic;
    }
    if (usePinned) filters.pinned = true;
    if (useCreatedDays  && createdDays  > 0) filters.createdWithinDays  = createdDays;
    if (useModifiedDays && modifiedDays > 0) filters.modifiedWithinDays = modifiedDays;
    onConfirm(name.trim() || 'Dossier intelligent', filters);
  };

  const toggleTag = (t: string) =>
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
    >
      <div
        className="bg-dark-900 border border-dark-700 rounded-xl w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
      >
        <div className="px-5 py-4 border-b border-dark-700 flex items-center gap-2">
          <Zap size={15} className="text-yellow-400" />
          <h2 className="text-sm font-semibold text-white">
            {initial ? 'Modifier le dossier intelligent' : 'Nouveau dossier intelligent'}
          </h2>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          <div>
            <label className="text-xs text-gray-400 mb-1.5 block">Nom</label>
            <input
              type="text"
              title="Nom du dossier"
              placeholder="Nom du dossier"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              className="w-full px-3 py-2 bg-dark-800 border border-dark-700 rounded-lg text-sm text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
              autoFocus
            />
          </div>
          <div className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest pt-1">Filtres</div>
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
              <input type="checkbox" checked={useTags} onChange={e => setUseTags(e.target.checked)} className="accent-yellow-500 w-3.5 h-3.5" />
              Par tags
            </label>
            {useTags && (
              <div className="ml-5 space-y-2">
                {allTags.length === 0 ? (
                  <p className="text-xs text-gray-500">Aucun tag existant dans tes notes</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {allTags.map(t => (
                      <button key={t} type="button" onClick={() => toggleTag(t)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          selectedTags.includes(t)
                            ? 'bg-yellow-500/25 text-yellow-300 border-yellow-500/50'
                            : 'bg-dark-800 text-gray-400 border-dark-600 hover:border-yellow-500/30 hover:text-gray-300'
                        }`}
                      >#{t}</button>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                    <input type="radio" name="tagLogic" checked={tagLogic === 'or'}  onChange={() => setTagLogic('or')}  className="accent-yellow-500" />Au moins un
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-400 cursor-pointer">
                    <input type="radio" name="tagLogic" checked={tagLogic === 'and'} onChange={() => setTagLogic('and')} className="accent-yellow-500" />Tous les tags
                  </label>
                </div>
              </div>
            )}
          </div>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={usePinned} onChange={e => setUsePinned(e.target.checked)} className="accent-yellow-500 w-3.5 h-3.5" />
            Épinglées uniquement
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none flex-wrap">
            <input type="checkbox" checked={useCreatedDays} onChange={e => setUseCreatedDays(e.target.checked)} className="accent-yellow-500 w-3.5 h-3.5" />
            Créées dans les
            {useCreatedDays && (
              <input type="number" min={1} max={365} value={createdDays}
                onChange={e => setCreatedDays(Math.max(1, Number(e.target.value)))}
                onClick={e => e.stopPropagation()}
                className="w-14 px-2 py-0.5 bg-dark-700 border border-dark-600 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50 text-center"
              />
            )}
            derniers jours
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer select-none flex-wrap">
            <input type="checkbox" checked={useModifiedDays} onChange={e => setUseModifiedDays(e.target.checked)} className="accent-yellow-500 w-3.5 h-3.5" />
            Modifiées dans les
            {useModifiedDays && (
              <input type="number" min={1} max={365} value={modifiedDays}
                onChange={e => setModifiedDays(Math.max(1, Number(e.target.value)))}
                onClick={e => e.stopPropagation()}
                className="w-14 px-2 py-0.5 bg-dark-700 border border-dark-600 rounded text-xs text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50 text-center"
              />
            )}
            derniers jours
          </label>
        </div>
        <div className="px-5 py-3 border-t border-dark-700 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-400 hover:text-white transition-colors">Annuler</button>
          <button type="button" onClick={handleSubmit} className="px-4 py-1.5 text-sm bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg transition-colors flex items-center gap-1.5">
            <Zap size={12} />{initial ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── FolderTreeItem ────────────────────────────────────────────────────────────

function FolderTreeItem({
  node, depth, view, onSelectView,
  editingId, editingName, setEditingId, setEditingName, commitRename,
  menuId, setMenuId, counts,
  onDeleteFolder, onCreateSubfolder,
  expandedIds, toggleExpand,
}: {
  node:              FolderNode;
  depth:             number;
  view:              ViewFilter;
  onSelectView:      (v: ViewFilter) => void;
  editingId:         string | null;
  editingName:       string;
  setEditingId:      (id: string | null) => void;
  setEditingName:    (name: string) => void;
  commitRename:      (id: string) => void;
  menuId:            string | null;
  setMenuId:         (id: string | null) => void;
  counts:            { byFolder: Record<string, number> };
  onDeleteFolder:    (id: string) => void;
  onCreateSubfolder: (parentId: string) => void;
  expandedIds:       Record<string, boolean>;
  toggleExpand:      (id: string) => void;
}) {
  const isActive    = viewEq(view, { type: 'folder', id: node.id });
  const hasChildren = node.children.length > 0;
  const isExpanded  = expandedIds[node.id] ?? true;

  const rowCls = `w-full flex items-center justify-between rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-yellow-500/15 text-yellow-300 font-medium'
      : 'text-gray-400 hover:text-white hover:bg-dark-700'
  }`;

  return (
    <div>
      <div className="relative group px-2" style={{ paddingLeft: 8 + depth * 12 }}>
        {editingId === node.id ? (
          <input
            aria-label="Nom du dossier"
            autoFocus
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onBlur={() => commitRename(node.id)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitRename(node.id);
              if (e.key === 'Escape') setEditingId(null);
            }}
            className="w-full px-2 py-1.5 text-sm bg-dark-700 border border-yellow-500/50 rounded-lg text-white focus:outline-none my-0.5"
          />
        ) : (
          /* div role="button" — évite le nesting <button>/<button> invalide en HTML */
          <div
            role="button"
            tabIndex={0}
            title={node.name}
            className={`${rowCls} px-1.5 py-1.5 cursor-pointer`}
            onClick={() => onSelectView({ type: 'folder', id: node.id })}
            onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectView({ type: 'folder', id: node.id }); } }}
          >
            <span className="flex items-center gap-1 truncate min-w-0">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); if (hasChildren) toggleExpand(node.id); }}
                className={`shrink-0 transition-transform ${hasChildren ? 'opacity-60 hover:opacity-100' : 'opacity-0 pointer-events-none'}`}
                style={{ width: 12 }}
              >
                <ChevronRight size={10} className={`transition-transform duration-150 ${isExpanded ? 'rotate-90' : ''}`} />
              </button>
              <FolderOpen size={13} className="shrink-0" />
              <span className="truncate">{node.name}</span>
            </span>
            <span className="flex items-center gap-1 shrink-0">
              <span className="text-xs opacity-50">{counts.byFolder[node.id] ?? 0}</span>
              <button
                type="button"
                title="Options"
                onClick={e => { e.stopPropagation(); setMenuId(menuId === node.id ? null : node.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-dark-600 transition-opacity"
              >
                <MoreHorizontal size={11} />
              </button>
            </span>
          </div>
        )}

        {menuId === node.id && (
          <div
            className="absolute right-0 top-full z-50 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden w-48"
            onClick={e => e.stopPropagation()}
          >
            <button type="button" onClick={() => { setEditingId(node.id); setEditingName(node.name); setMenuId(null); }}
              className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-dark-700">
              Renommer
            </button>
            <button type="button" onClick={() => { onCreateSubfolder(node.id); setMenuId(null); }}
              className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-dark-700 flex items-center gap-2">
              <FolderPlus size={12} /> Nouveau sous-dossier
            </button>
            <button type="button" onClick={() => { onDeleteFolder(node.id); setMenuId(null); }}
              className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-dark-700">
              Supprimer
            </button>
          </div>
        )}
      </div>

      {hasChildren && isExpanded && (
        <div>
          {node.children.map(child => (
            <FolderTreeItem
              key={child.id}
              node={child}
              depth={depth + 1}
              view={view}
              onSelectView={onSelectView}
              editingId={editingId}
              editingName={editingName}
              setEditingId={setEditingId}
              setEditingName={setEditingName}
              commitRename={commitRename}
              menuId={menuId}
              setMenuId={setMenuId}
              counts={counts}
              onDeleteFolder={onDeleteFolder}
              onCreateSubfolder={onCreateSubfolder}
              expandedIds={expandedIds}
              toggleExpand={toggleExpand}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── EditorToolbar — Ribbon style Word (4 onglets) ────────────────────────────

// Polices disponibles (style Word)
const FONT_FAMILIES = [
  { value: '',                  label: 'Par défaut' },
  { value: 'Arial, sans-serif',                    label: 'Arial' },
  { value: '"Times New Roman", serif',             label: 'Times New Roman' },
  { value: '"Courier New", monospace',             label: 'Courier New' },
  { value: 'Georgia, serif',                       label: 'Georgia' },
  { value: 'Verdana, sans-serif',                  label: 'Verdana' },
  { value: '"Trebuchet MS", sans-serif',           label: 'Trebuchet MS' },
  { value: 'Impact, sans-serif',                   label: 'Impact' },
  { value: '"Comic Sans MS", cursive',             label: 'Comic Sans MS' },
  { value: '"Palatino Linotype", serif',           label: 'Palatino' },
  { value: '"Lucida Console", monospace',          label: 'Lucida Console' },
];

// Tailles de police standard (comme Word)
const FONT_SIZES = ['8','9','10','11','12','14','16','18','20','24','28','32','36','48','60','72'];

// Symboles spéciaux organisés par catégorie
const SPECIAL_SYMBOLS = [
  // Typographie
  '\u00A9','\u00AE','\u2122','\u00B0','\u00B7','\u2022','\u2023','\u25E6',
  '\u2014','\u2013','\u2026','\u00AB','\u00BB','\u201C','\u201D','\u2018','\u2019',
  // Mathématiques
  '\u00B1','\u00D7','\u00F7','\u2260','\u2264','\u2265','\u2248','\u221E',
  '\u221A','\u2211','\u222B','\u2202','\u0394','\u2207','\u220F','\u2208','\u2209','\u2229','\u222A','\u2282','\u2283',
  // Flèches
  '\u2190','\u2192','\u2191','\u2193','\u2194','\u2195','\u21D0','\u21D2','\u21D1','\u21D3','\u21D4',
  // Monnaie
  '\u20AC','\u00A3','\u00A5','\u00A2','\u20B9','\u20BF','\u20A9',
  // Divers
  '\u00BD','\u00BC','\u00BE','\u00B9','\u00B2','\u00B3','\u2020','\u2021',
  '\u00A7','\u00B6','\u2116','\u2605','\u2606','\u2665','\u2666','\u2663','\u2660','\u2713','\u2717','\u2726',
];

// Interlignes disponibles
const LINE_SPACINGS = [
  { value: 'normal', label: 'Normal' },
  { value: '1',      label: '1.0' },
  { value: '1.15',   label: '1.15' },
  { value: '1.5',    label: '1.5' },
  { value: '2',      label: '2.0' },
  { value: '2.5',    label: '2.5' },
  { value: '3',      label: '3.0' },
];

function EditorToolbar({ editor, onImageClick, onFileClick, uploadProgress, focusMode, onFocusToggle, onExportMd, onExportPdf, onCodeBlockClick, onDrawClick, onImportDocxClick, onExportDocxClick, onImportPdfClick }: {
  editor:             Editor | null;
  onImageClick:       () => void;
  onFileClick:        () => void;
  uploadProgress:     number | null;
  focusMode:          boolean;
  onFocusToggle:      () => void;
  onExportMd:         () => void;
  onExportPdf:        () => void;
  onCodeBlockClick:   () => void;
  onDrawClick:        () => void;
  onImportDocxClick:  () => void;
  onExportDocxClick:  () => void;
  onImportPdfClick:   () => void;
}) {
  // ── État des onglets du Ribbon ─────────────────────────────────────────────
  type RibbonTab = 'accueil' | 'insertion' | 'paragraphe' | 'outils';
  const [activeTab,      setActiveTab]      = useState<RibbonTab>('accueil');

  // ── État des dropdowns ─────────────────────────────────────────────────────
  const [linkOpen,       setLinkOpen]       = useState(false);
  const [linkVal,        setLinkVal]        = useState('');
  const [textColorOpen,  setTextColorOpen]  = useState(false);
  const [highlightOpen,  setHighlightOpen]  = useState(false);
  const [lastTextColor,  setLastTextColor]  = useState('#f9fafb');
  const [lastHighlight,  setLastHighlight]  = useState('#fef08a');
  const [tableOpen,      setTableOpen]      = useState(false);
  const [tableHover,     setTableHover]     = useState({ r: 0, c: 0 });
  const [symbolsOpen,    setSymbolsOpen]    = useState(false);
  const [findOpen,       setFindOpen]       = useState(false);
  const [findVal,        setFindVal]        = useState('');
  const [replaceVal,     setReplaceVal]     = useState('');
  const [lineSpacing,    setLineSpacing]    = useState('normal');
  const [caseOpen,       setCaseOpen]       = useState(false);

  // ── Refs pour fermeture au clic extérieur ──────────────────────────────────
  const textColorRef = useRef<HTMLDivElement>(null);
  const highlightRef  = useRef<HTMLDivElement>(null);
  const tableRef      = useRef<HTMLDivElement>(null);
  const symbolsRef    = useRef<HTMLDivElement>(null);
  const caseRef       = useRef<HTMLDivElement>(null);

  if (!editor) return null;

  // ── Bouton toolbar générique ───────────────────────────────────────────────
  const TB = (
    active:   boolean,
    title:    string,
    onClick:  () => void,
    icon:     React.ReactNode,
    disabled?: boolean
  ) => (
    <button
      type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >{icon}</button>
  );

  // ── Séparateur vertical ────────────────────────────────────────────────────
  const SEP = () => <div className="w-px h-4 bg-dark-700 mx-0.5 shrink-0" />;

  // ── Fermeture dropdowns au clic extérieur ──────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (textColorRef.current && !textColorRef.current.contains(e.target as Node)) setTextColorOpen(false);
      if (highlightRef.current  && !highlightRef.current.contains(e.target as Node))  setHighlightOpen(false);
      if (tableRef.current      && !tableRef.current.contains(e.target as Node))      { setTableOpen(false); setTableHover({ r: 0, c: 0 }); }
      if (symbolsRef.current    && !symbolsRef.current.contains(e.target as Node))    setSymbolsOpen(false);
      if (caseRef.current       && !caseRef.current.contains(e.target as Node))       setCaseOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Grille de couleurs 6×10 (style Word) ──────────────────────────────────
  const COLOR_GRID = [
    ['#000000','#1a1a1a','#333333','#4d4d4d','#666666','#808080','#999999','#b3b3b3','#cccccc','#ffffff'],
    ['#1e3a5f','#1e40af','#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe','#eff6ff'],
    ['#14532d','#166534','#15803d','#16a34a','#22c55e','#4ade80','#86efac','#bbf7d0','#dcfce7','#f0fdf4'],
    ['#7f1d1d','#991b1b','#b91c1c','#dc2626','#ef4444','#f87171','#fca5a5','#fecaca','#fee2e2','#fff1f2'],
    ['#7c2d12','#c2410c','#ea580c','#f97316','#fb923c','#fdba74','#fcd34d','#fef08a','#fef9c3','#fffbeb'],
    ['#4c1d95','#6d28d9','#7c3aed','#8b5cf6','#a78bfa','#c4b5fd','#be185d','#ec4899','#fbcfe8','#fdf4ff'],
  ];

  // ── Couleurs de surbrillance ───────────────────────────────────────────────
  const HIGHLIGHT_COLORS = [
    '#fef08a','#fde68a','#fcd34d','#fbbf24',
    '#bbf7d0','#86efac','#4ade80','#22c55e',
    '#bfdbfe','#93c5fd','#60a5fa','#3b82f6',
    '#fecaca','#fca5a5','#f87171','#ef4444',
    '#e9d5ff','#c4b5fd','#a78bfa','#8b5cf6',
    '#fbcfe8','#f9a8d4','#f472b6','#ec4899',
    '#fed7aa','#fdba74','#fb923c','#f97316',
  ];

  // ── Appliquer un lien ──────────────────────────────────────────────────────
  const handleSetLink = () => {
    if (!linkVal.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = linkVal.startsWith('http') ? linkVal : `https://${linkVal}`;
      editor.chain().focus().setLink({ href }).run();
    }
    setLinkOpen(false);
    setLinkVal('');
  };

  // ── Taille de police courante ──────────────────────────────────────────────
  const currentFontSize = editor.getAttributes('textStyle').fontSize?.replace('pt','') ?? '';

  // ── Appliquer l'interligne ─────────────────────────────────────────────────
  const applyLineSpacing = (value: string) => {
    setLineSpacing(value);
    if (value === 'normal') {
      editor.chain().focus().unsetLineHeight().run();
    } else {
      editor.chain().focus().setLineHeight(value).run();
    }
  };

  // ── Changer la casse du texte sélectionné ─────────────────────────────────
  const changeCase = (mode: 'upper' | 'lower' | 'title' | 'sentence') => {
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to, ' ');
    let result = text;
    if (mode === 'upper')    result = text.toUpperCase();
    if (mode === 'lower')    result = text.toLowerCase();
    if (mode === 'title')    result = text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    if (mode === 'sentence') result = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    editor.chain().focus().deleteRange({ from, to }).insertContent(result).run();
    setCaseOpen(false);
  };

  // ── Rechercher dans le document ────────────────────────────────────────────
  const doFind = () => {
    if (!findVal) return;
    const content = editor.state.doc.textContent;
    const idx = content.indexOf(findVal);
    if (idx >= 0) {
      editor.chain().focus().setTextSelection({ from: idx + 1, to: idx + 1 + findVal.length }).run();
    }
  };

  // ── Remplacer la première occurrence ──────────────────────────────────────
  const doReplace = () => {
    if (!findVal) return;
    const { doc } = editor.state;
    let found = false;
    doc.descendants((node, pos) => {
      if (found || !node.isText) return;
      const idx = node.text!.indexOf(findVal);
      if (idx >= 0) {
        editor.chain().focus()
          .setTextSelection({ from: pos + idx, to: pos + idx + findVal.length })
          .insertContent(replaceVal)
          .run();
        found = true;
      }
    });
  };

  // ── Remplacer toutes les occurrences ──────────────────────────────────────
  const doReplaceAll = () => {
    if (!findVal) return;
    const html = editor.getHTML();
    const escaped = findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replaced = html.replace(new RegExp(escaped, 'g'), replaceVal);
    editor.commands.setContent(replaced, { emitUpdate: true });
  };

  // ── Style des onglets du Ribbon ────────────────────────────────────────────
  const tabCls = (tab: RibbonTab) =>
    `px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2 -mb-px ${
      activeTab === tab
        ? 'text-yellow-400 border-yellow-500'
        : 'text-gray-500 border-transparent hover:text-gray-300 hover:border-dark-600'
    }`;

  return (
    <div className="border-b border-dark-800 shrink-0 select-none">

      {/* ══ BARRE D'ONGLETS ═══════════════════════════════════════════════════ */}
      <div className="flex items-center border-b border-dark-900 px-1">
        {/* Onglets Ribbon */}
        <button type="button" className={tabCls('accueil')}    onClick={() => setActiveTab('accueil')}>Accueil</button>
        <button type="button" className={tabCls('insertion')}  onClick={() => setActiveTab('insertion')}>Insertion</button>
        <button type="button" className={tabCls('paragraphe')} onClick={() => setActiveTab('paragraphe')}>Paragraphe</button>
        <button type="button" className={tabCls('outils')}     onClick={() => setActiveTab('outils')}>Outils</button>

        {/* Barre de progression upload — toujours visible à droite des onglets */}
        {uploadProgress !== null && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-3">
            <div className="w-16 h-1 bg-dark-700 rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span>{uploadProgress}%</span>
          </div>
        )}

        {/* Bouton Focus — toujours visible, poussé à droite */}
        <div className="ml-auto pr-1">
          {TB(focusMode, focusMode ? 'Quitter le mode focus' : 'Mode focus (plein écran)', onFocusToggle,
            focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />)}
        </div>
      </div>

      {/* ══ CONTENU DE L'ONGLET ACTIF ════════════════════════════════════════ */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 min-h-[36px]">

        {/* ─── Onglet ACCUEIL ──────────────────────────────────────────────── */}
        {activeTab === 'accueil' && <>
          {/* Historique */}
          {TB(false, 'Annuler (Ctrl+Z)', () => editor.chain().focus().undo().run(), <Undo2 size={13} />, !editor.can().undo())}
          {TB(false, 'Refaire (Ctrl+Y)', () => editor.chain().focus().redo().run(), <Redo2 size={13} />, !editor.can().redo())}
          <SEP />

          {/* Famille de police */}
          <select
            title="Famille de police"
            value={editor.getAttributes('textStyle').fontFamily ?? ''}
            onChange={e => {
              if (!e.target.value) editor.chain().focus().unsetFontFamily().run();
              else editor.chain().focus().setFontFamily(e.target.value).run();
            }}
            className="text-[11px] bg-dark-800 border border-dark-700 text-gray-400 rounded px-1.5 py-1 focus:outline-none cursor-pointer max-w-[120px]"
            style={{ fontFamily: editor.getAttributes('textStyle').fontFamily || 'inherit' }}
          >
            {FONT_FAMILIES.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value || 'inherit' }}>{f.label}</option>
            ))}
          </select>

          {/* Taille de police */}
          <select
            title="Taille de police"
            value={currentFontSize}
            onChange={e => {
              if (!e.target.value) editor.chain().focus().unsetFontSize().run();
              else editor.chain().focus().setFontSize(`${e.target.value}pt`).run();
            }}
            className="text-[11px] bg-dark-800 border border-dark-700 text-gray-400 rounded px-1 py-1 focus:outline-none cursor-pointer w-[52px]"
          >
            <option value="">—</option>
            {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Style de paragraphe */}
          <select
            title="Style de paragraphe"
            value={
              editor.isActive('heading', { level: 1 }) ? '1' :
              editor.isActive('heading', { level: 2 }) ? '2' :
              editor.isActive('heading', { level: 3 }) ? '3' : '0'
            }
            onChange={e => {
              const v = Number(e.target.value);
              if (v === 0) editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: v as 1|2|3 }).run();
            }}
            className="text-[11px] bg-dark-800 border border-dark-700 text-gray-400 rounded px-1.5 py-1 focus:outline-none cursor-pointer"
          >
            <option value="0">Normal</option>
            <option value="1">Titre 1</option>
            <option value="2">Titre 2</option>
            <option value="3">Titre 3</option>
          </select>
          <SEP />

          {/* Formatage caractère */}
          {TB(editor.isActive('bold'),        'Gras (Ctrl+B)',      () => editor.chain().focus().toggleBold().run(),        <Bold size={13} />)}
          {TB(editor.isActive('italic'),      'Italique (Ctrl+I)',  () => editor.chain().focus().toggleItalic().run(),      <Italic size={13} />)}
          {TB(editor.isActive('underline'),   'Souligné (Ctrl+U)', () => editor.chain().focus().toggleUnderline().run(),   <UnderlineIcon size={13} />)}
          {TB(editor.isActive('strike'),      'Barré',             () => editor.chain().focus().toggleStrike().run(),      <Strikethrough size={13} />)}
          {TB(editor.isActive('superscript'), 'Exposant',          () => editor.chain().focus().toggleSuperscript().run(), <SupIcon size={13} />)}
          {TB(editor.isActive('subscript'),   'Indice',            () => editor.chain().focus().toggleSubscript().run(),   <SubIcon size={13} />)}
          <SEP />

          {/* Effacer le formatage */}
          {TB(false, 'Effacer le formatage', () => {
            editor.chain().focus().clearNodes().unsetAllMarks().run();
            const { from, to } = editor.state.selection;
            editor.state.doc.nodesBetween(from, to, (node) => {
              if (['paragraph', 'heading', 'blockquote'].includes(node.type.name) && node.attrs.indent) {
                editor.chain().updateAttributes(node.type.name, { indent: 0 }).run();
              }
            });
            editor.chain().focus().unsetLineHeight().run();
          }, <Eraser size={13} />)}

          {/* Changer la casse */}
          <div className="relative shrink-0" ref={caseRef}>
            <button type="button" title="Changer la casse"
              onClick={() => setCaseOpen(o => !o)}
              className={`p-1.5 rounded transition-colors flex items-center gap-0.5 ${caseOpen ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700'}`}>
              <CaseSensitive size={13} />
              <ChevronDown size={9} />
            </button>
            {caseOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl p-1 min-w-[160px]"
                onMouseDown={e => e.stopPropagation()}>
                {[
                  { mode: 'upper'    as const, label: 'MAJUSCULES' },
                  { mode: 'lower'    as const, label: 'minuscules' },
                  { mode: 'title'    as const, label: 'Chaque Mot' },
                  { mode: 'sentence' as const, label: 'Première lettre' },
                ].map(({ mode, label }) => (
                  <button key={mode} type="button" onClick={() => changeCase(mode)}
                    className="w-full text-left text-[11px] text-gray-300 hover:bg-dark-700 px-3 py-1.5 rounded transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <SEP />

          {/* Surbrillance */}
          <div className="relative shrink-0" ref={highlightRef}>
            <button type="button" title="Surbrillance"
              onClick={() => { setHighlightOpen(o => !o); setTextColorOpen(false); }}
              className="flex flex-col items-center p-1 rounded hover:bg-dark-700 transition-colors">
              <Highlighter size={12} className="text-gray-300" />
              <div className="w-3.5 h-[3px] rounded-full mt-0.5 border border-dark-600" style={{ background: lastHighlight }} />
            </button>
            {highlightOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl p-2.5 min-w-max"
                onMouseDown={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Surbrillance</p>
                <div className="grid grid-cols-4 gap-1">
                  {HIGHLIGHT_COLORS.map(c => (
                    <button key={c} type="button" title={c}
                      onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setLastHighlight(c); setHighlightOpen(false); }}
                      style={{ background: c }}
                      className="w-5 h-5 rounded border border-dark-600 hover:scale-110 transition-transform"
                    />
                  ))}
                </div>
                <button type="button"
                  onClick={() => { editor.chain().focus().unsetHighlight().run(); setHighlightOpen(false); }}
                  className="mt-2 w-full text-[10px] text-gray-400 hover:text-gray-200 py-1 border-t border-dark-700 hover:bg-dark-700 rounded transition-colors">
                  ✕ Aucune surbrillance
                </button>
              </div>
            )}
          </div>

          {/* Couleur du texte */}
          <div className="relative shrink-0" ref={textColorRef}>
            <button type="button" title="Couleur du texte"
              onClick={() => { setTextColorOpen(o => !o); setHighlightOpen(false); }}
              className="flex flex-col items-center p-1 rounded hover:bg-dark-700 transition-colors">
              <span className="text-[13px] font-bold text-gray-300 leading-none">A</span>
              <div className="w-3.5 h-[3px] rounded-full mt-0.5 border border-dark-600" style={{ background: lastTextColor }} />
            </button>
            {textColorOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl p-2.5 min-w-max"
                onMouseDown={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Couleur du texte</p>
                <div className="grid grid-cols-10 gap-0.5">
                  {COLOR_GRID.flat().map(c => (
                    <button key={c} type="button" title={c}
                      onClick={() => { editor.chain().focus().setColor(c).run(); setLastTextColor(c); setTextColorOpen(false); }}
                      style={{ background: c }}
                      className="w-5 h-5 rounded-sm border border-dark-600 hover:scale-110 transition-transform hover:border-gray-400"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-dark-700">
                  <label className="flex items-center gap-1.5 text-[10px] text-gray-400 cursor-pointer hover:text-gray-200 transition-colors">
                    <div className="w-5 h-5 rounded-sm border border-dark-500 bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 relative overflow-hidden shrink-0">
                      <input type="color" aria-label="Couleur personnalisée du texte"
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        onChange={e => { editor.chain().focus().setColor(e.target.value).run(); setLastTextColor(e.target.value); }} />
                    </div>
                    Personnalisée
                  </label>
                  <button type="button"
                    onClick={() => { editor.chain().focus().unsetColor().run(); setTextColorOpen(false); }}
                    className="text-[10px] text-gray-400 hover:text-gray-200 px-1.5 py-0.5 rounded hover:bg-dark-700 transition-colors">
                    ✕ Réinitialiser
                  </button>
                </div>
              </div>
            )}
          </div>
        </>}

        {/* ─── Onglet INSERTION ────────────────────────────────────────────── */}
        {activeTab === 'insertion' && <>
          {/* Tableau — grid picker */}
          <div className="relative" ref={tableRef}>
            <button type="button" title="Insérer un tableau"
              onClick={() => setTableOpen(o => !o)}
              className={`p-1.5 rounded transition-colors ${tableOpen ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700'}`}>
              <TableIcon size={13} />
            </button>
            {tableOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-dark-800 border border-dark-700 rounded-lg p-2.5 shadow-2xl select-none"
                onMouseLeave={() => setTableHover({ r: 0, c: 0 })}>
                <div className="flex flex-col gap-0.5 mb-2">
                  {Array.from({ length: 8 }).map((_, ri) => (
                    <div key={ri} className="flex gap-0.5">
                      {Array.from({ length: 8 }).map((_, ci) => (
                        <div key={ci}
                          className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${
                            ri < tableHover.r && ci < tableHover.c
                              ? 'bg-yellow-500/30 border-yellow-500/60'
                              : 'bg-dark-700 border-dark-600 hover:bg-dark-600'
                          }`}
                          onMouseEnter={() => setTableHover({ r: ri + 1, c: ci + 1 })}
                          onClick={() => {
                            editor.chain().focus().insertTable({ rows: tableHover.r, cols: tableHover.c, withHeaderRow: true }).run();
                            setTableOpen(false); setTableHover({ r: 0, c: 0 });
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-gray-400 min-h-[1rem]">
                  {tableHover.r > 0 && tableHover.c > 0
                    ? `${tableHover.r} × ${tableHover.c} tableau`
                    : 'Survoler pour choisir'}
                </p>
              </div>
            )}
          </div>

          {/* Lien */}
          <div className="relative">
            {TB(editor.isActive('link'), 'Lien hypertexte', () => {
              if (editor.isActive('link')) { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }
              else { setLinkVal(editor.getAttributes('link').href || ''); setLinkOpen(o => !o); }
            }, <LinkIcon size={13} />)}
            {linkOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-dark-800 border border-dark-600 rounded-lg p-2 shadow-xl flex gap-1.5 min-w-[210px]"
                onMouseDown={e => e.stopPropagation()}>
                <input autoFocus value={linkVal} onChange={e => setLinkVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSetLink(); if (e.key === 'Escape') setLinkOpen(false); }}
                  placeholder="https://..."
                  className="flex-1 text-xs bg-dark-700 border border-dark-600 rounded px-2 py-1 text-gray-300 focus:outline-none focus:border-yellow-500/50"
                />
                <button type="button" onClick={handleSetLink}
                  className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/30">OK</button>
              </div>
            )}
          </div>
          <SEP />

          {/* Image + Fichier */}
          {TB(false, 'Insérer une image',  onImageClick, <ImageIcon size={13} />)}
          {TB(false, 'Joindre un fichier', onFileClick,  <FileUp size={13} />)}
          <SEP />

          {/* Dessin Excalidraw */}
          {TB(false, 'Dessin (Excalidraw)', onDrawClick, <Pencil size={13} />)}

          {/* Équation LaTeX */}
          {TB(false, 'Équation LaTeX (cliquer puis éditer)', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor.chain().focus() as any).insertInlineMath({ latex: 'E=mc^2' }).run();
          }, <Sigma size={13} />)}

          {/* Symboles spéciaux */}
          <div className="relative shrink-0" ref={symbolsRef}>
            <button type="button" title="Symboles spéciaux"
              onClick={() => setSymbolsOpen(o => !o)}
              className={`p-1.5 rounded transition-colors ${symbolsOpen ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-300 hover:bg-dark-700'}`}>
              <span className="text-[12px] font-semibold leading-none">Ω</span>
            </button>
            {symbolsOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl p-2.5"
                style={{ width: '272px' }}
                onMouseDown={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Symboles spéciaux</p>
                <div className="grid grid-cols-10 gap-0.5">
                  {SPECIAL_SYMBOLS.map(sym => (
                    <button key={sym} type="button" title={sym}
                      onClick={() => { editor.chain().focus().insertContent(sym).run(); setSymbolsOpen(false); }}
                      className="w-6 h-6 text-sm text-gray-300 hover:bg-yellow-500/20 hover:text-yellow-300 rounded transition-colors flex items-center justify-center">
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>}

        {/* ─── Onglet PARAGRAPHE ───────────────────────────────────────────── */}
        {activeTab === 'paragraphe' && <>
          {/* Alignement */}
          {TB(editor.isActive({ textAlign: 'left' }),    'Aligner gauche (Ctrl+L)', () => editor.chain().focus().setTextAlign('left').run(),    <AlignLeft size={13} />)}
          {TB(editor.isActive({ textAlign: 'center' }),  'Centrer (Ctrl+E)',        () => editor.chain().focus().setTextAlign('center').run(),  <AlignCenter size={13} />)}
          {TB(editor.isActive({ textAlign: 'right' }),   'Aligner droite (Ctrl+R)', () => editor.chain().focus().setTextAlign('right').run(),   <AlignRight size={13} />)}
          {TB(editor.isActive({ textAlign: 'justify' }), 'Justifier (Ctrl+J)',      () => editor.chain().focus().setTextAlign('justify').run(), <AlignJustify size={13} />)}
          <SEP />

          {/* Retrait */}
          {TB(false, 'Diminuer le retrait (Shift+Tab)', () => editor.chain().focus().outdent().run(), <IndentDecrease size={13} />)}
          {TB(false, 'Augmenter le retrait (Tab)',      () => editor.chain().focus().indent().run(),  <IndentIncrease size={13} />)}
          <SEP />

          {/* Interligne */}
          <select
            title="Interligne"
            value={lineSpacing}
            onChange={e => applyLineSpacing(e.target.value)}
            className="text-[11px] bg-dark-800 border border-dark-700 text-gray-400 rounded px-1.5 py-1 focus:outline-none cursor-pointer w-[60px]"
          >
            {LINE_SPACINGS.map(ls => (
              <option key={ls.value} value={ls.value}>{ls.label}</option>
            ))}
          </select>
          <SEP />

          {/* Listes */}
          {TB(editor.isActive('bulletList'),  'Liste à puces',   () => editor.chain().focus().toggleBulletList().run(),  <List size={13} />)}
          {TB(editor.isActive('orderedList'), 'Liste numérotée', () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={13} />)}
          {TB(editor.isActive('taskList'),    'Liste de tâches', () => editor.chain().focus().toggleTaskList().run(),    <ListChecks size={13} />)}
          <SEP />

          {/* Blocs */}
          {TB(editor.isActive('blockquote'), 'Citation',              () => editor.chain().focus().toggleBlockquote().run(), <Quote size={13} />)}
          {TB(editor.isActive('codeBlock'),  'Bloc de code',          onCodeBlockClick,  <Code2 size={13} />)}
          {TB(false,                         'Séparateur horizontal', () => editor.chain().focus().setHorizontalRule().run(), <Minus size={13} />)}
        </>}

        {/* ─── Onglet OUTILS ───────────────────────────────────────────────── */}
        {activeTab === 'outils' && <>
          {/* Recherche & Remplacement */}
          <div className="relative shrink-0">
            {TB(findOpen, 'Rechercher & Remplacer (Ctrl+H)', () => setFindOpen(o => !o), <SearchCode size={13} />)}
            {findOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl p-3 min-w-[260px]"
                onMouseDown={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Rechercher & Remplacer</p>
                <div className="flex gap-1.5 mb-1.5">
                  <input value={findVal} onChange={e => setFindVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doFind()}
                    placeholder="Rechercher…"
                    className="flex-1 text-xs bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:border-yellow-500/50"
                  />
                  <button type="button" onClick={doFind}
                    className="text-xs bg-dark-700 text-gray-400 hover:text-gray-200 px-2 py-1 rounded hover:bg-dark-600 transition-colors">
                    Trouver
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input value={replaceVal} onChange={e => setReplaceVal(e.target.value)}
                    placeholder="Remplacer par…"
                    className="flex-1 text-xs bg-dark-700 border border-dark-600 rounded px-2 py-1.5 text-gray-300 focus:outline-none focus:border-yellow-500/50"
                  />
                  <div className="flex flex-col gap-1">
                    <button type="button" title="Remplacer" onClick={doReplace}
                      className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/30 whitespace-nowrap">
                      <Replace size={11} />
                    </button>
                    <button type="button" onClick={doReplaceAll}
                      className="text-[10px] bg-yellow-500/10 text-yellow-500/70 px-2 py-1 rounded hover:bg-yellow-500/20 whitespace-nowrap">
                      Tout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <SEP />

          {/* Import / Export documents */}
          {TB(false, 'Importer un fichier Word (.docx)', onImportDocxClick, <FilePlus size={13} />)}
          {TB(false, 'Exporter en Word (.docx)',         onExportDocxClick, <FileDown size={13} />)}
          {TB(false, 'Importer un PDF (texte)',          onImportPdfClick,  <BookOpen size={13} />)}
          <SEP />
          {TB(false, 'Exporter en Markdown', onExportMd,  <FileText size={13} />)}
          {TB(false, 'Imprimer / PDF',       onExportPdf, <Download size={13} />)}
        </>}

      </div>
    </div>
  );
}

// ── Sidebar ──────────────────────────────────────────────────────────────────

function NotesSidebar({
  notes, deletedNotes, folders, manualTags, view, onSelectView,
  newFolderPendingId, onFolderCreated, onEditSmartFolder,
  onCreateTag, onDeleteTag, trashBtnRef, trashShake, onCreateSubfolder,
}: {
  notes:              Note[];
  deletedNotes:       Note[];
  folders:            FolderType[];
  manualTags:         string[];
  view:               ViewFilter;
  onSelectView:       (v: ViewFilter) => void;
  newFolderPendingId: string | null;
  onFolderCreated:    () => void;
  onEditSmartFolder:  (id: string) => void;
  onCreateTag:        (name: string) => void;
  onDeleteTag:        (name: string) => void;
  trashBtnRef:        React.RefObject<HTMLButtonElement>;
  trashShake:         boolean;
  onCreateSubfolder:  (parentId: string) => void;
}) {
  const [editingId,       setEditingId]       = useState<string | null>(null);
  const [editingName,     setEditingName]     = useState('');
  const [menuId,          setMenuId]          = useState<string | null>(null);
  const [showNewTag,      setShowNewTag]      = useState(false);
  const [newTagInput,     setNewTagInput]     = useState('');
  const [tagInputSuggs,   setTagInputSuggs]   = useState<string[]>([]);
  const [tagInputSuggIdx, setTagInputSuggIdx] = useState(-1);
  const [expandedIds,     setExpandedIds]     = useState<Record<string, boolean>>({});
  /** Terme de recherche interne à la sidebar — filtre dossiers et tags */
  const [folderSearch,    setFolderSearch]    = useState('');
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }, []);
  const folderTree   = useMemo(() => buildFolderTree(folders), [folders]);
  const smartFolders = useMemo(() => folders.filter(f => f.isSmart), [folders]);

  useEffect(() => {
    if (newFolderPendingId && folders.find(f => f.id === newFolderPendingId)) {
      setEditingId(newFolderPendingId);
      setEditingName(folders.find(f => f.id === newFolderPendingId)!.name);
      onFolderCreated();
    }
  }, [newFolderPendingId, folders, onFolderCreated]);

  const counts = useMemo(() => {
    const byFolder: Record<string, number> = {};
    const byTag:    Record<string, number> = {};
    let inbox = 0, pinned = 0;
    notes.forEach(n => {
      if (n.pinned)    pinned++;
      if (!n.folderId) inbox++;
      if (n.folderId)  byFolder[n.folderId] = (byFolder[n.folderId] ?? 0) + 1;
      n.tags.forEach(t => { byTag[t] = (byTag[t] ?? 0) + 1; });
    });
    return { all: notes.length, inbox, pinned, byFolder, byTag };
  }, [notes]);

  // Union tags manuels + tags extraits des notes, triés par count desc puis alpha
  const allDisplayTags = useMemo(() => {
    const all = new Set([...manualTags, ...Object.keys(counts.byTag)]);
    return Array.from(all).sort((a, b) => {
      const ca = counts.byTag[a] ?? 0;
      const cb = counts.byTag[b] ?? 0;
      if (cb !== ca) return cb - ca;
      return a.localeCompare(b, 'fr');
    });
  }, [manualTags, counts.byTag]);

  const row = (v: ViewFilter) =>
    `w-full flex items-center justify-between px-2 py-1.5 rounded-lg text-sm transition-colors ${
      viewEq(view, v)
        ? 'bg-yellow-500/15 text-yellow-300 font-medium'
        : 'text-gray-400 hover:text-white hover:bg-dark-700'
    }`;

  const commitRename = async (id: string) => {
    if (editingName.trim()) await updateFolder(id, { name: editingName.trim() });
    setEditingId(null);
  };

  const handleDeleteFolder = async (id: string) => {
    await deleteFolder(id);
    if (viewEq(view, { type: 'folder', id })) onSelectView('inbox');
    setMenuId(null);
  };

  const handleTagInputChange = (v: string) => {
    setNewTagInput(v);
    setTagInputSuggIdx(-1);
    if (v.trim()) {
      const lower = v.toLowerCase();
      setTagInputSuggs(allDisplayTags.filter(t => t.includes(lower) && t !== lower).slice(0, 5));
    } else {
      setTagInputSuggs(allDisplayTags.slice(0, 5)); // montre les tags existants quand vide
    }
  };

  const applyTagInputSugg = (tag: string) => {
    onCreateTag(tag);
    setNewTagInput(''); setShowNewTag(false); setTagInputSuggs([]); setTagInputSuggIdx(-1);
  };

  const commitNewTag = () => {
    const v = newTagInput.trim();
    if (v) onCreateTag(v);
    setNewTagInput(''); setShowNewTag(false); setTagInputSuggs([]); setTagInputSuggIdx(-1);
  };

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (tagInputSuggs.length > 0) {
      if (e.key === 'ArrowDown') { e.preventDefault(); setTagInputSuggIdx(i => Math.min(i + 1, tagInputSuggs.length - 1)); return; }
      if (e.key === 'ArrowUp')   { e.preventDefault(); setTagInputSuggIdx(i => Math.max(i - 1, -1)); return; }
      if (e.key === 'Tab')       { e.preventDefault(); applyTagInputSugg(tagInputSuggs[tagInputSuggIdx >= 0 ? tagInputSuggIdx : 0]); return; }
      if (e.key === 'Enter' && tagInputSuggIdx >= 0) { e.preventDefault(); applyTagInputSugg(tagInputSuggs[tagInputSuggIdx]); return; }
    }
    if (e.key === 'Enter')  commitNewTag();
    if (e.key === 'Escape') { setNewTagInput(''); setShowNewTag(false); setTagInputSuggs([]); }
  };

  return (
    <div
      className="flex flex-col h-full overflow-y-auto select-none"
      onClick={() => setMenuId(null)}
    >
      {/* Smart views */}
      <div className="px-2 pt-3 pb-2 space-y-0.5">
        {folders.length > 0 && (
          <button type="button" className={row('all')} onClick={() => onSelectView('all')}>
            <span className="flex items-center gap-2"><StickyNote size={13} />Toutes</span>
            <span className="text-xs opacity-50">{counts.all}</span>
          </button>
        )}
        {counts.pinned > 0 && (
          <button type="button" className={row('pinned')} onClick={() => onSelectView('pinned')}>
            <span className="flex items-center gap-2"><Pin size={13} />Épinglées</span>
            <span className="text-xs opacity-50">{counts.pinned}</span>
          </button>
        )}
        <button type="button" className={row('inbox')} onClick={() => onSelectView('inbox')}>
          <span className="flex items-center gap-2"><Folder size={13} />Toutes mes notes</span>
          <span className="text-xs opacity-50">{counts.inbox}</span>
        </button>
      </div>

      <div className="mx-2 border-t border-dark-700" />

      {/* Barre de recherche dossiers/tags — filtre la sidebar uniquement */}
      <div className="px-2 pt-2 pb-1 relative">
        <Search size={11} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          type="text"
          aria-label="Rechercher un dossier ou tag"
          placeholder="Dossiers, tags…"
          value={folderSearch}
          onChange={e => setFolderSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setFolderSearch(''); }}
          className="w-full pl-6 pr-6 py-1 bg-dark-800 border border-dark-700 rounded-lg text-[11px] text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
        />
        {folderSearch && (
          <button
            type="button"
            onClick={() => setFolderSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            aria-label="Effacer la recherche"
          >
            <X size={10} />
          </button>
        )}
      </div>

      {/* Mode recherche : liste plate OU sections normales (dossiers + tags) */}
      {folderSearch.trim() ? (
        /* Résultats de recherche — liste plate de tous les dossiers + tags correspondants.
           Quand folderSearch est non-vide, on remplace les sections normales par cette
           liste plate (pattern VS Code / Notion "jump to"). Clic → navigue + vide la recherche. */
        <div className="pt-1 pb-1 px-2 space-y-0.5">
          {/* Dossiers normaux correspondants (tous niveaux, non-intelligents) */}
          {folders
            .filter(f => !f.isSmart && f.name.toLowerCase().includes(folderSearch.toLowerCase()))
            .map(f => (
              <button
                key={f.id}
                type="button"
                className={row({ type: 'folder', id: f.id })}
                onClick={() => { onSelectView({ type: 'folder', id: f.id }); setFolderSearch(''); }}
              >
                <span className="flex items-center gap-2 truncate min-w-0">
                  <FolderOpen size={13} className="shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="text-xs opacity-50 shrink-0">{counts.byFolder[f.id] ?? 0}</span>
              </button>
            ))
          }
          {/* Dossiers intelligents correspondants */}
          {folders
            .filter(f => f.isSmart && f.name.toLowerCase().includes(folderSearch.toLowerCase()))
            .map(f => (
              <button
                key={f.id}
                type="button"
                className={row({ type: 'folder', id: f.id })}
                onClick={() => { onSelectView({ type: 'folder', id: f.id }); setFolderSearch(''); }}
              >
                <span className="flex items-center gap-2 truncate min-w-0">
                  <Zap size={12} className="text-yellow-400 shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
              </button>
            ))
          }
          {/* Tags correspondants */}
          {allDisplayTags
            .filter(t => t.toLowerCase().includes(folderSearch.toLowerCase()))
            .map(tag => (
              <button
                key={tag}
                type="button"
                className={row({ type: 'tag', tag })}
                onClick={() => { onSelectView({ type: 'tag', tag }); setFolderSearch(''); }}
              >
                <span className="flex items-center gap-2 truncate min-w-0">
                  <Hash size={12} className="shrink-0" />
                  <span className="truncate">#{tag}</span>
                </span>
                <span className="text-xs opacity-50 shrink-0">{counts.byTag[tag] ?? 0}</span>
              </button>
            ))
          }
          {/* État vide — aucun résultat */}
          {folders.filter(f => f.name.toLowerCase().includes(folderSearch.toLowerCase())).length === 0 &&
           allDisplayTags.filter(t => t.toLowerCase().includes(folderSearch.toLowerCase())).length === 0 && (
            <p className="text-[11px] text-gray-600 px-1 py-2">Aucun résultat</p>
          )}
        </div>
      ) : (
        /* Sidebar normale — arbre de dossiers + dossiers intelligents + tags */
        <>
          {/* Dossiers normaux — arbre récursif */}
          {folderTree.length > 0 && (
            <div className="pt-1 pb-1">
              <div className="px-3 mb-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Dossiers</span>
              </div>
              {folderTree.map(node => (
                <FolderTreeItem
                  key={node.id}
                  node={node}
                  depth={0}
                  view={view}
                  onSelectView={onSelectView}
                  editingId={editingId}
                  editingName={editingName}
                  setEditingId={setEditingId}
                  setEditingName={setEditingName}
                  commitRename={commitRename}
                  menuId={menuId}
                  setMenuId={setMenuId}
                  counts={counts}
                  onDeleteFolder={handleDeleteFolder}
                  onCreateSubfolder={onCreateSubfolder}
                  expandedIds={expandedIds}
                  toggleExpand={toggleExpand}
                />
              ))}
            </div>
          )}

          {/* Dossiers intelligents — liste plate */}
          {smartFolders.length > 0 && (
            <div className="pt-1 pb-1">
              <div className="px-3 mb-1">
                <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Intelligents</span>
              </div>
              <div className="space-y-0.5 px-2">
                {smartFolders.map(f => (
                  <div key={f.id} className="relative group">
                    {editingId === f.id ? (
                      <input
                        aria-label="Nom du dossier"
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => commitRename(f.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  commitRename(f.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full px-2 py-1.5 text-sm bg-dark-700 border border-yellow-500/50 rounded-lg text-white focus:outline-none"
                      />
                    ) : (
                      /* div role="button" — évite <button> imbriqué dans <button> (HTML invalide) */
                      <div
                        role="button"
                        tabIndex={0}
                        className={`${row({ type: 'folder', id: f.id })} cursor-pointer`}
                        onClick={() => onSelectView({ type: 'folder', id: f.id })}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectView({ type: 'folder', id: f.id }); } }}
                      >
                        <span className="flex items-center gap-2 truncate min-w-0">
                          <Zap size={12} className="text-yellow-400 shrink-0" />
                          <span className="truncate">{f.name}</span>
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            title="Options du dossier"
                            onClick={e => { e.stopPropagation(); setMenuId(menuId === f.id ? null : f.id); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-dark-600 transition-opacity"
                          >
                            <MoreHorizontal size={11} />
                          </button>
                        </span>
                      </div>
                    )}
                    {menuId === f.id && (
                      <div
                        className="absolute right-0 top-full z-50 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden w-44"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => { onEditSmartFolder(f.id); setMenuId(null); }}
                          className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-dark-700 flex items-center gap-2"
                        >
                          <Zap size={12} className="text-yellow-400" /> Modifier les filtres
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFolder(f.id)}
                          className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-dark-700"
                        >
                          Supprimer
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="mx-2 border-t border-dark-700" />

          {/* Tags — toujours visible avec bouton "+" pour créer */}
          <div className="px-2 pt-2 pb-2">
            <div className="px-1 mb-1 flex items-center justify-between">
              <span className="text-[10px] font-semibold text-gray-500 uppercase tracking-widest">Tags</span>
              <button
                type="button"
                title="Nouveau tag"
                onClick={e => { e.stopPropagation(); setShowNewTag(true); }}
                className="text-gray-500 hover:text-yellow-400 transition-colors p-0.5 rounded"
              >
                <Plus size={11} />
              </button>
            </div>

            {/* Champ de création inline + suggestions */}
            {showNewTag && (
              <div className="mb-1 relative">
                <input
                  aria-label="Nouveau tag"
                  type="text"
                  autoFocus
                  placeholder="mon-tag"
                  value={newTagInput}
                  onChange={e => handleTagInputChange(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  onBlur={() => setTimeout(commitNewTag, 150)}
                  onFocus={() => handleTagInputChange(newTagInput)}
                  className="w-full px-2 py-1 text-xs bg-dark-700 border border-yellow-500/50 rounded text-white focus:outline-none placeholder-gray-600"
                />
                {tagInputSuggs.length > 0 && (
                  <div className="absolute left-0 top-full z-50 w-full mt-0.5 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden">
                    {tagInputSuggs.map((t, i) => (
                      <button key={t} type="button"
                        onMouseDown={e => { e.preventDefault(); applyTagInputSugg(t); }}
                        className={`w-full px-2 py-1 text-xs text-left flex items-center gap-1.5 transition-colors ${
                          i === tagInputSuggIdx ? 'bg-yellow-500/20 text-yellow-300' : 'text-gray-300 hover:bg-dark-700'
                        }`}
                      ><Hash size={10} />#{t}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {allDisplayTags.length === 0 && !showNewTag && (
              <p className="text-[11px] text-gray-600 px-1 py-1">
                Aucun tag — utilise #tag dans tes notes ou crée-en un avec +
              </p>
            )}

            <div className="space-y-0.5">
              {allDisplayTags.map(tag => (
                <div key={tag} className="group relative">
                  {/* div role="button" — évite <button> imbriqué dans <button> (suppression tag) */}
                  <div
                    role="button"
                    tabIndex={0}
                    className={`${row({ type: 'tag', tag })} cursor-pointer`}
                    onClick={() => onSelectView({ type: 'tag', tag })}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelectView({ type: 'tag', tag }); } }}
                  >
                    <span className="flex items-center gap-2">
                      <Hash size={12} /><span className="truncate">{tag}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="text-xs opacity-50">{counts.byTag[tag] ?? 0}</span>
                      {/* Bouton supprimer uniquement sur les tags manuels */}
                      {manualTags.includes(tag) && (
                        <button
                          type="button"
                          title="Supprimer le tag"
                          onClick={e => { e.stopPropagation(); onDeleteTag(tag); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-opacity"
                        >
                          <X size={10} />
                        </button>
                      )}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* Corbeille — toujours visible */}
      <div className="mx-2 border-t border-dark-700 mt-auto" />
      <div className="px-2 py-2">
        <motion.button
          ref={trashBtnRef}
          type="button"
          className={row('trash')}
          onClick={() => onSelectView('trash')}
          animate={trashShake
            ? { x: [-4, 4, -4, 4, 0], rotate: [-10, 10, -10, 10, 0] }
            : { x: 0, rotate: 0 }}
          transition={{ duration: 0.4 }}
        >
          <span className="flex items-center gap-2"><Trash2 size={13} />Corbeille</span>
          {deletedNotes.length > 0 && (
            <span className="text-xs opacity-50">{deletedNotes.length}</span>
          )}
        </motion.button>
      </div>
    </div>
  );
}

// ── Main Component ───────────────────────────────────────────────────────────

export default function NotesEditor() {
  const { notes, deletedNotes, folders, manualTags, loading } = useAdminNotes();
  // ── Authentification — pour le profil utilisateur + déconnexion ───────────
  const { user, signOut } = useAuth();

  const [view,        setView]        = useState<ViewFilter>('inbox');
  const [selectedId,  setSelectedId]  = useState<string | null>(null);
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>('list');

  const [title,        setTitle]        = useState('');
  const [content,      setContent]      = useState('');
  const [saveStatus,   setSaveStatus]   = useState<SaveStatus>('saved');
  const [lastSaved,    setLastSaved]    = useState<Date | null>(null);
  const [confirmDel,   setConfirmDel]   = useState(false);
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);

  const [sortBy, setSortBy] = useState<SortBy>('dateModified');

  const [suggestions,     setSuggestions]     = useState<string[]>([]);
  const [suggestionIdx,   setSuggestionIdx]   = useState(-1);
  const [titleSuggs,      setTitleSuggs]      = useState<string[]>([]);
  const [titleSuggIdx,    setTitleSuggIdx]    = useState(-1);
  const titleRef        = useRef<HTMLInputElement>(null);
  const searchRef       = useRef<HTMLInputElement>(null);
  const trashBtnRef     = useRef<HTMLButtonElement>(null);
  const imageInputRef   = useRef<HTMLInputElement>(null);
  const fileInputRef    = useRef<HTMLInputElement>(null);
  const detectAtCursorRef = useRef<() => void>(() => {});
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  const [search,         setSearch]         = useState('');
  const [trashShake,     setTrashShake]     = useState(false);
  const [focusMode,      setFocusMode]      = useState(false);
  const [bubbleLinkOpen, setBubbleLinkOpen] = useState(false);
  const [bubbleLinkVal,  setBubbleLinkVal]  = useState('');
  const [codeCopied,     setCodeCopied]     = useState(false);
  const [isInCodeBlock,  setIsInCodeBlock]  = useState(false);
  const [codeBlockLang,  setCodeBlockLang]  = useState<string>('auto');
  const [codeModal,      setCodeModal]      = useState<{
    open: boolean; code: string; lang: string; isEdit: boolean; from: number; to: number;
  } | null>(null);
  const [codeModalCopied, setCodeModalCopied] = useState(false);

  const [excalidrawModal, setExcalidrawModal] = useState<{
    open: boolean;
    initialData?: Record<string, unknown>;
  } | null>(null);
  const excalidrawApiRef  = useRef<ExcalidrawImperativeAPI | null>(null);

  const docxInputRef = useRef<HTMLInputElement>(null);
  const pdfInputRef  = useRef<HTMLInputElement>(null);
  // Import dynamique (SSR-incompatible)
  const ExcalidrawComponent = useMemo(() => dynamic(
    () => import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw })),
    { ssr: false, loading: () => <p className="text-gray-500 text-sm p-4">Chargement du dessin…</p> }
  ), []);

  // Slash commands
  const [slashMenu,   setSlashMenu]   = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIdx,    setSlashIdx]    = useState(0);
  const slashMenuRef  = useRef(false);
  const slashIdxRef   = useRef(0);
  const applySlashRef = useRef<(idx: number) => void>(() => {});
  useEffect(() => { slashMenuRef.current = slashMenu; }, [slashMenu]);
  useEffect(() => { slashIdxRef.current  = slashIdx;  }, [slashIdx]);
  const [flyItem, setFlyItem] = useState<{
    x: number; y: number; w: number; h: number;
    tx: number; ty: number; label: string;
  } | null>(null);

  // ── Persistance localStorage ─────────────────────────────────────────────
  const hasRestoredRef = useRef(false);
  // Restaurer la vue au premier rendu côté client (après hydration SSR)
  useEffect(() => {
    try {
      const v = localStorage.getItem('notes_view');
      if (v) setView(JSON.parse(v) as ViewFilter);
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps
  // Sauvegarder view à chaque changement
  useEffect(() => {
    try { localStorage.setItem('notes_view', JSON.stringify(view)); } catch { /* ignore */ }
  }, [view]);
  // Sauvegarder selectedId à chaque changement
  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem('notes_selectedId', selectedId);
      else            localStorage.removeItem('notes_selectedId');
    } catch { /* ignore */ }
  }, [selectedId]);

  // Ctrl+F / Cmd+F → focus barre de recherche
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setMobilePanel('list');
        setTimeout(() => searchRef.current?.focus(), 50);
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  }, []);

  const [newFolderPendingId, setNewFolderPendingId] = useState<string | null>(null);
  const [showNewFolderMenu,  setShowNewFolderMenu]  = useState(false);
  const [showSmartModal,     setShowSmartModal]     = useState(false);
  const [editingSmartId,     setEditingSmartId]     = useState<string | null>(null);

  const prevSelectedId = useRef<string | null>(null);
  const prevTitle      = useRef('');
  const prevContent    = useRef('');
  const saveTimer      = useRef<ReturnType<typeof setTimeout>>();

  const selectedNote = notes.find(n => n.id === selectedId)
    ?? deletedNotes.find(n => n.id === selectedId)
    ?? null;

  const isTrash    = view === 'trash';
  const isReadOnly = selectedNote ? !!selectedNote.deletedAt : false;

  const currentFolder = useMemo(() =>
    typeof view === 'object' && view.type === 'folder'
      ? folders.find(f => f.id === view.id) ?? null
      : null,
    [view, folders]
  );

  // Tous les tags connus (union notes + manuels) pour l'autocomplétion
  const allTags = useMemo(() => {
    const set = new Set<string>([...manualTags]);
    notes.forEach(n => n.tags.forEach(t => set.add(t)));
    return Array.from(set);
  }, [notes, manualTags]);

  const smartModalInitial = useMemo(() => {
    if (!editingSmartId) return undefined;
    const f = folders.find(x => x.id === editingSmartId);
    if (!f?.isSmart) return undefined;
    return { name: f.name, filters: f.filters ?? {} };
  }, [editingSmartId, folders]);

  // ── Nettoyage notes vides au changement de sélection ─────────────────────
  useEffect(() => {
    const oldId      = prevSelectedId.current;
    const oldTitle   = prevTitle.current;
    const oldContent = prevContent.current;
    if (oldId && oldId !== selectedId) {
      if (!oldTitle.trim() && !stripHtml(oldContent).trim()) silentlyDeleteNote(oldId);
    }
    prevSelectedId.current = selectedId;
    prevTitle.current      = title;
    prevContent.current    = content;
    clearTimeout(saveTimer.current);
    setConfirmDel(false);
    setShowMoveMenu(false);
    setSaveStatus('saved');
    setLastSaved(null);
    setSuggestions([]);
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Sync temps réel multi-appareil ───────────────────────────────────────
  // Si la note ouverte est modifiée depuis un autre appareil et qu'on n'est
  // pas en train d'éditer, on met à jour l'éditeur automatiquement.
  useEffect(() => {
    if (!selectedId || saveStatus !== 'saved') return;
    const note = notes.find(n => n.id === selectedId);
    if (!note) return;
    // Ne jamais écraser si l'utilisateur est en train d'éditer (focus dans l'éditeur)
    const editorFocused = !!(editor && !editor.isDestroyed && editor.view.hasFocus());
    if (note.title !== title || note.content !== content) {
      setTitle(note.title);
      if (!editorFocused) {
        setContent(note.content);
        prevTitle.current   = note.title;
        prevContent.current = note.content;
        if (editor && !editor.isDestroyed) {
          editor.commands.setContent(note.content, { emitUpdate: false });
        }
      }
    }
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Notes filtrées et triées ──────────────────────────────────────────────
  const filteredNotes = useMemo(() => {
    let list = isTrash ? [...deletedNotes] : [...notes];
    if (!isTrash) {
      if (view === 'pinned') {
        list = list.filter(n => n.pinned);
      } else if (view === 'inbox') {
        list = list.filter(n => !n.folderId);
      } else if (typeof view === 'object' && view.type === 'folder') {
        const folder = folders.find(f => f.id === view.id);
        if (folder?.isSmart && folder.filters) {
          list = applySmartFilters(list, folder.filters);
        } else {
          list = list.filter(n => n.folderId === view.id);
        }
      } else if (typeof view === 'object' && view.type === 'tag') {
        list = list.filter(n => n.tags.includes(view.tag));
      }
    }
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(s) || stripHtml(n.content).toLowerCase().includes(s)
      );
    }
    if (!isTrash) {
      const pinned   = list.filter(n => n.pinned);
      const unpinned = list.filter(n => !n.pinned);
      const sort = (arr: Note[]) => arr.sort((a, b) => {
        if (sortBy === 'dateModified') return b.updatedAt.getTime() - a.updatedAt.getTime();
        if (sortBy === 'dateCreated')  return b.createdAt.getTime() - a.createdAt.getTime();
        return a.title.localeCompare(b.title, 'fr');
      });
      return [...pinned, ...sort(unpinned)];
    }
    return list.sort((a, b) =>
      (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0)
    );
  }, [notes, deletedNotes, view, search, sortBy, isTrash, folders]);

  // ── Autosave ──────────────────────────────────────────────────────────────
  const scheduleAutoSave = useCallback((t: string, c: string) => {
    if (!selectedId || isReadOnly) return;
    prevTitle.current   = t;
    prevContent.current = c;
    setSaveStatus('unsaved');
    clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(async () => {
      setSaveStatus('saving');
      try {
        await updateNote(selectedId, { title: t, content: c });
        setLastSaved(new Date());
        setSaveStatus('saved');
      } catch {
        setSaveStatus('error');
      }
    }, AUTOSAVE_DELAY_MS);
  }, [selectedId, isReadOnly]);

  // Reset de l'index de sélection quand les suggestions changent
  useEffect(() => { setSuggestionIdx(-1); }, [suggestions]);

  // ── Autocomplétion contenu (tags uniquement) ─────────────────────────────
  const detectAtCursor = useCallback(() => {
    if (!editor || editor.isDestroyed) return;
    const { $from } = editor.state.selection;
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

    // Priorité 0 : slash command — "/" ou "/partial" en début de paragraphe
    const slashMatch = textBefore.match(/^\/([a-zA-Z]*)$/);
    if (slashMatch) {
      setSlashFilter(slashMatch[1].toLowerCase());
      setSlashMenu(true);
      setSlashIdx(0);
      return;
    }
    if (slashMenuRef.current) setSlashMenu(false);

    // Priorité 1 : hashtag (#tag ou # seul)
    const tagMatch = textBefore.match(/#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)?$/);
    if (tagMatch) {
      const partial = (tagMatch[1] ?? '').toLowerCase();
      const filtered = partial
        ? allTags.filter(t => t.includes(partial) && t !== partial)
        : allTags;
      setSuggestions(filtered.slice(0, 6));
      return;
    }

    setSuggestions([]);
  }, [allTags]); // eslint-disable-line react-hooks/exhaustive-deps

  // Garde la ref à jour pour éviter les dépendances circulaires avec useEditor
  useEffect(() => { detectAtCursorRef.current = detectAtCursor; }, [detectAtCursor]);

  const applySuggestion = (item: string) => {
    if (!editor) return;
    const { state } = editor;
    const { from }  = state.selection;
    const textBefore = state.selection.$from.parent.textContent.slice(0, state.selection.$from.parentOffset);
    const m = textBefore.match(/#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)?$/);
    if (m) editor.chain().focus().deleteRange({ from: from - m[0].length, to: from }).insertContent(`#${item} `).run();
    setSuggestions([]);
  };

  // ── TipTap editor ─────────────────────────────────────────────────────────
  const editor = useEditor({
    immediatelyRender: false, // SSR Next.js — évite les hydration errors (TipTap 3 best practice)
    extensions: [
      StarterKit.configure({ codeBlock: false }),
      CodeBlockLowlight.configure({
        lowlight,
        // Blocs sans langage explicite → plaintext (jamais highlightAuto → jamais de crash)
        // La colorisation fonctionne normalement quand le langage est choisi via toolbar
        defaultLanguage: 'plaintext',
      }),
      ImageExtension.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({
        placeholder: 'Commence à écrire...\n\nUtilise #tag pour créer des tags automatiquement.',
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Superscript,
      Subscript,
      CharacterCount,
      FontFamily,
      FontSize,
      LineHeight,
      Indent,
      Mathematics,
    ],
    editorProps: {
      attributes: { class: 'tiptap-editor', spellcheck: 'true' },
      // Normalise le HTML avant parsing ProseMirror.
      // Problèmes gérés :
      //   1. VS Code : wrapper <div style="background-color:..."> → on unwrappe
      //   2. Claude.ai / Discord / sites dark-theme : éléments avec background-color
      //      sombre + color clair → texte invisible dans l'éditeur. On supprime
      //      background-color, background et color inline sur TOUS les éléments
      //      pour que le texte hérite du style de l'éditeur.
      transformPastedHTML(html: string): string {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        const body = doc.body;
        const children = Array.from(body.children);

        // Étape 1 : unwrapper le div VS Code (seul enfant avec background-color)
        if (
          children.length === 1 &&
          children[0].tagName === 'DIV' &&
          (children[0] as HTMLElement).style.backgroundColor
        ) {
          body.innerHTML = (children[0] as HTMLElement).innerHTML;
        }

        // Étape 2 : supprimer background-color, background et color sur tous les éléments
        // → évite les blocs sombres et le texte invisible lors du paste depuis
        //   des apps dark-theme (Claude.ai, Discord, GitHub, VS Code, etc.)
        body.querySelectorAll<HTMLElement>('*').forEach(el => {
          el.style.removeProperty('background-color');
          el.style.removeProperty('background');
          el.style.removeProperty('color');
          // Supprimer l'attribut style s'il est vide après nettoyage
          if (!el.getAttribute('style')) el.removeAttribute('style');
        });

        return body.innerHTML;
      },
      handlePaste(view, event) {
        const items = Array.from(event.clipboardData?.items ?? []);

        // 1. Image binaire pure (fichier image copié) → upload Firebase
        // IMPORTANT : Chrome ajoute toujours image/png comme rendu visuel du texte
        // copié (depuis n'importe quelle page web, VS Code, Claude…).
        // Si text/html ou text/plain est présent → c'est du texte, pas une image.
        // On n'intercepte que si le clipboard ne contient PAS de texte.
        const hasText = items.some(i => i.type === 'text/html' || i.type === 'text/plain');
        const imgItem = items.find(i => i.type.startsWith('image/'));
        if (!hasText && imgItem && selectedId) {
          event.preventDefault();
          const file = imgItem.getAsFile();
          if (file) handleImageInsertRef.current(file);
          return true;
        }

        // 2. Tout le reste → TipTap gère nativement (HTML, texte brut, etc.)
        return false;
      },
      handleDrop(_, event) {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0 || !selectedId) return false;

        // Fichier .excalidraw → ouvrir dans le modal
        const excFile = files.find(f => f.name.endsWith('.excalidraw'));
        if (excFile) {
          event.preventDefault();
          excFile.text().then(json => {
            try { setExcalidrawModal({ open: true, initialData: JSON.parse(json) }); }
            catch { setExcalidrawModal({ open: true }); }
          });
          return true;
        }

        event.preventDefault();
        // Traitement séquentiel : images inline, autres fichiers en lien
        (async () => {
          for (const file of files) {
            if (file.type.startsWith('image/')) {
              await handleImageInsertRef.current(file);
            } else {
              await handleFileInsertRef.current(file);
            }
          }
        })();
        return true;
      },
      handleKeyDown(_, event) {
        // Navigation dans le menu slash commands
        if (slashMenuRef.current) {
          const cmds = SLASH_CMDS.filter(c =>
            !slashFilter || c.id.startsWith(slashFilter) || c.label.toLowerCase().startsWith(slashFilter)
          );
          if (event.key === 'ArrowDown') {
            setSlashIdx(i => Math.min(i + 1, cmds.length - 1));
            return true;
          }
          if (event.key === 'ArrowUp') {
            setSlashIdx(i => Math.max(i - 1, 0));
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            applySlashRef.current(slashIdxRef.current);
            return true;
          }
          if (event.key === 'Escape') {
            setSlashMenu(false);
            return true;
          }
          // Fermer si l'utilisateur tape espace ou backspace efface tout
          if (event.key === ' ') { setSlashMenu(false); return false; }
        }

        // Navigation dans les suggestions d'autocomplétion
        if (suggestionsRef.current.length === 0) return false;
        if (event.key === 'ArrowDown') {
          setSuggestionIdx(i => Math.min(i + 1, suggestionsRef.current.length - 1));
          return true;
        }
        if (event.key === 'ArrowUp') {
          setSuggestionIdx(i => Math.max(i - 1, -1));
          return true;
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && suggestionIdxRef.current >= 0) {
          applySuggestionRef.current(suggestionsRef.current[suggestionIdxRef.current]);
          return true;
        }
        if (event.key === 'Tab' && suggestionIdxRef.current === -1 && suggestionsRef.current.length > 0) {
          applySuggestionRef.current(suggestionsRef.current[0]);
          return true;
        }
        if (event.key === 'Escape') { setSuggestions([]); return true; }
        return false;
      },
    },
    onUpdate: ({ editor }) => {
      const html = editor.getHTML();
      setContent(html);
      scheduleAutoSaveRef.current(titleRef.current?.value ?? '', html);
      setTimeout(() => detectAtCursorRef.current(), 0);
    },
    onSelectionUpdate: () => setTimeout(() => detectAtCursorRef.current(), 0),
    editable: true,
  });

  // Refs anti-stale-closure (valeurs utilisées dans les editorProps de useEditor)
  const suggestionsRef       = useRef<string[]>([]);
  const suggestionIdxRef     = useRef(-1);
  const applySuggestionRef   = useRef<(item: string) => void>(() => {});
  const handleImageInsertRef = useRef<(file: File) => void>(() => {});
  const scheduleAutoSaveRef  = useRef<(t: string, c: string) => void>(() => {});
  useEffect(() => { suggestionsRef.current    = suggestions;    }, [suggestions]);
  useEffect(() => { suggestionIdxRef.current  = suggestionIdx;  }, [suggestionIdx]);
  useEffect(() => { scheduleAutoSaveRef.current = scheduleAutoSave; }, [scheduleAutoSave]);

  // Restauration post-chargement — exécuté une seule fois quand Firestore ET l'éditeur sont prêts
  useEffect(() => {
    if (loading || !editor || editor.isDestroyed || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const savedId = localStorage.getItem('notes_selectedId');
      if (!savedId) return;
      const note = [...notes, ...deletedNotes].find(n => n.id === savedId);
      if (!note) return;
      // Écrire le vrai contenu dans les refs AVANT de changer selectedId
      // pour que l'effet de nettoyage des notes vides ne voie jamais '' comme contenu
      prevTitle.current   = note.title;
      prevContent.current = note.content;
      setSelectedId(savedId);
      setTitle(note.title);
      setContent(note.content);
      editor.commands.setContent(note.content, { emitUpdate: false });
      setMobilePanel('editor');
    } catch { /* ignore */ }
  }, [loading, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // Détection bloc de code actif (fiable — via events editor, pas BubbleMenu)
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const active = editor.isActive('codeBlock');
      setIsInCodeBlock(active);
      if (active) setCodeBlockLang(editor.getAttributes('codeBlock').language ?? 'auto');
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction', update);
    return () => { editor.off('selectionUpdate', update); editor.off('transaction', update); };
  }, [editor]);

  // Ouvre le modal code block (nouveau ou édition de l'existant)
  const openCodeModal = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('codeBlock')) {
      const { state } = editor;
      const { $from } = state.selection;
      let from = -1, to = -1, codeText = '', lang = 'auto';
      for (let d = $from.depth; d >= 0; d--) {
        const n = $from.node(d);
        if (n.type.name === 'codeBlock') {
          from = $from.before(d);
          to   = $from.after(d);
          codeText = n.textContent;
          lang     = n.attrs.language ?? 'auto';
          break;
        }
      }
      setCodeModal({ open: true, code: codeText, lang, isEdit: true, from, to });
    } else {
      setCodeModal({ open: true, code: '', lang: 'auto', isEdit: false, from: -1, to: -1 });
    }
  }, [editor]);

  // Applique le contenu du modal dans l'éditeur
  const applyCodeModal = useCallback(() => {
    if (!editor || !codeModal) return;
    const langAttr = codeModal.lang === 'auto' ? null : codeModal.lang;
    const newNode = {
      type: 'codeBlock',
      attrs: { language: langAttr },
      content: codeModal.code ? [{ type: 'text', text: codeModal.code }] : [],
    };
    if (codeModal.isEdit && codeModal.from >= 0) {
      editor.chain().focus()
        .deleteRange({ from: codeModal.from, to: codeModal.to })
        .insertContentAt(codeModal.from, newNode)
        .run();
    } else {
      editor.chain().focus().insertContent(newNode).run();
    }
    setCodeModal(null);
  }, [editor, codeModal]);

  // Export Excalidraw → PNG → Firebase Storage → inséré comme image
  const insertExcalidraw = useCallback(async () => {
    if (!excalidrawApiRef.current || !editor || !selectedId) return;
    try {
      setUploadProgress(0);
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements: excalidrawApiRef.current.getSceneElements(),
        appState: { ...excalidrawApiRef.current.getAppState(), exportWithDarkMode: false },
        files: excalidrawApiRef.current.getFiles(),
        mimeType: 'image/png',
      });
      const file = new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' });
      const url  = await uploadNoteImage(file, selectedId, pct => setUploadProgress(pct));
      editor.chain().focus().setImage({ src: url, alt: 'Dessin' }).run();
      const html = editor.getHTML();
      setContent(html);
      scheduleAutoSave(title, html);
      setExcalidrawModal(null);
    } catch (err) {
      console.error('Export Excalidraw:', err);
    } finally {
      setUploadProgress(null);
    }
  }, [editor, selectedId, title, scheduleAutoSave]);

  // Sync editor ↔ isReadOnly
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isReadOnly);
  }, [editor, isReadOnly]);

  // ── Import DOCX ────────────────────────────────────────────────────────────
  const handleImportDocx = useCallback(async (file: File) => {
    if (!editor) return;
    try {
      const html = await importDocx(file);
      editor.commands.setContent(html, { emitUpdate: false });
      const newHtml = editor.getHTML();
      setContent(newHtml);
      scheduleAutoSave(title, newHtml);
    } catch (err) { console.error('Import DOCX:', err); }
  }, [editor, title, scheduleAutoSave]);

  // ── Export DOCX ────────────────────────────────────────────────────────────
  const handleExportDocx = useCallback(async () => {
    if (!editor) return;
    try { await exportDocx(editor.getHTML(), title || 'note'); }
    catch (err) { console.error('Export DOCX:', err); }
  }, [editor, title]);

  // ── Import PDF — extraction texte ─────────────────────────────────────────
  const handleImportPdf = useCallback(async (file: File) => {
    if (!editor) return;
    try {
      setUploadProgress(0);
      const text = await extractTextFromPdf(file);
      setUploadProgress(50);
      const paragraphs = text.split(/\n{2,}/).map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`).join('');
      editor.commands.setContent(paragraphs || '<p></p>', { emitUpdate: false });
      const html = editor.getHTML();
      setContent(html);
      scheduleAutoSave(title, html);
    } catch (err) { console.error('Import PDF:', err); }
    finally { setUploadProgress(null); }
  }, [editor, title, scheduleAutoSave]);

  // ── Upload image (paste / drag-drop / bouton) ─────────────────────────────
  const handleImageInsert = useCallback(async (file: File) => {
    if (!editor || !selectedId) return;
    try {
      setUploadProgress(0);
      const url = await uploadNoteImage(file, selectedId, pct => setUploadProgress(pct));
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      // Force autosave immédiat après l'insertion
      const html = editor.getHTML();
      setContent(html);
      scheduleAutoSave(title, html);
    } catch (err) {
      console.error('Upload image:', err);
    } finally {
      setUploadProgress(null);
    }
  }, [editor, selectedId, title, scheduleAutoSave]);
  useEffect(() => { handleImageInsertRef.current = handleImageInsert; }, [handleImageInsert]);
  useEffect(() => { applySuggestionRef.current   = applySuggestion;   }, [applySuggestion]);

  // ── Upload fichier joint ───────────────────────────────────────────────────
  const handleFileInsert = useCallback(async (file: File) => {
    if (!editor || !selectedId) return;
    try {
      setUploadProgress(0);
      const { url, name } = await uploadNoteFile(file, selectedId, pct => setUploadProgress(pct));
      // Nœud ProseMirror JSON — plus fiable qu'une chaîne HTML brute avec l'extension Link
      editor.chain().focus().insertContent([
        { type: 'text', text: `📎 ${name}`, marks: [{ type: 'link', attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' } }] },
        { type: 'text', text: ' ' },
      ]).run();
      const html = editor.getHTML();
      setContent(html);
      scheduleAutoSave(title, html);
    } catch (err) {
      console.error('Upload fichier:', err);
    } finally {
      setUploadProgress(null);
    }
  }, [editor, selectedId, title, scheduleAutoSave]);
  const handleFileInsertRef = useRef(handleFileInsert);
  useEffect(() => { handleFileInsertRef.current = handleFileInsert; }, [handleFileInsert]);

  // ── Apply slash command ────────────────────────────────────────────────────
  const applySlashCommand = useCallback((idx: number) => {
    if (!editor) return;
    const filteredCmds = SLASH_CMDS.filter(c =>
      !slashFilter || c.id.startsWith(slashFilter) || c.label.toLowerCase().startsWith(slashFilter)
    );
    const cmd = filteredCmds[idx];
    if (!cmd) { setSlashMenu(false); return; }
    // Supprimer le "/" et le texte du filtre
    const { state } = editor;
    const { from, $from } = state.selection;
    const blockStart = from - $from.parentOffset;
    editor.chain().focus().deleteRange({ from: blockStart, to: from }).run();
    cmd.apply(editor);
    setSlashMenu(false);
  }, [editor, slashFilter]);
  useEffect(() => { applySlashRef.current = applySlashCommand; }, [applySlashCommand]);

  // ── Export Markdown ────────────────────────────────────────────────────────
  const handleExportMarkdown = useCallback(async () => {
    if (!editor || !selectedNote) return;
    // Import dynamique pour éviter les problèmes SSR
    const TurndownService = (await import('turndown')).default;
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    const md = `# ${title}\n\n${td.turndown(editor.getHTML())}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${title || 'note'}.md`;
    a.click(); URL.revokeObjectURL(url);
  }, [editor, title, selectedNote]);

  // ── Export PDF ─────────────────────────────────────────────────────────────
  const handleExportPDF = useCallback(() => {
    if (!editor || !selectedNote) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${title || 'Note'}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; line-height: 1.6; }
        h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: .3em; }
        h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
        pre { background: #f6f8fa; border-radius: 6px; padding: 16px; overflow: auto; }
        code { background: #f6f8fa; border-radius: 3px; padding: .2em .4em; font-size: .9em; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #ddd; padding: 8px 12px; }
        th { background: #f6f8fa; font-weight: 600; }
        img { max-width: 100%; }
        ul[data-type="taskList"] { list-style: none; padding: 0; }
        li[data-type="taskItem"] > label { display: flex; gap: 8px; }
        a { color: #0366d6; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
      <h1>${title || 'Sans titre'}</h1>
      ${editor.getHTML()}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }, [editor, title, selectedNote]);

  // ── Autocomplétion titre (tags uniquement) ────────────────────────────────
  const applyTitleSugg = useCallback((item: string) => {
    const el = titleRef.current;
    if (!el) return;
    const cursor = el.selectionStart ?? title.length;
    const textBefore = title.slice(0, cursor);
    const tagMatch = textBefore.match(/#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)?$/);
    if (tagMatch) {
      const start = cursor - tagMatch[0].length;
      const newTitle = title.slice(0, start) + '#' + item + ' ' + title.slice(cursor);
      setTitle(newTitle);
      scheduleAutoSave(newTitle, content);
      setTimeout(() => { const p = start + item.length + 2; el.setSelectionRange(p, p); }, 0);
    }
    setTitleSuggs([]); setTitleSuggIdx(-1);
  }, [title, content, scheduleAutoSave]);

  const handleTitleSuggKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (titleSuggs.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setTitleSuggIdx(i => Math.min(i + 1, titleSuggs.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setTitleSuggIdx(i => Math.max(i - 1, -1)); }
    else if ((e.key === 'Tab' || e.key === 'Enter') && titleSuggIdx >= 0) {
      e.preventDefault(); applyTitleSugg(titleSuggs[titleSuggIdx]);
    } else if (e.key === 'Tab' && titleSuggIdx === -1) {
      e.preventDefault(); applyTitleSugg(titleSuggs[0]);
    } else if (e.key === 'Escape') { setTitleSuggs([]); }
  };

  // ── Handlers éditeur ─────────────────────────────────────────────────────
  const handleTitleChange = (v: string) => {
    setTitle(v);
    scheduleAutoSave(v, content);

    const el = titleRef.current;
    const cursor = el?.selectionStart ?? v.length;
    const textBefore = v.slice(0, cursor);

    // Tags (#tag ou # seul)
    const tagMatch = textBefore.match(/#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)?$/);
    if (tagMatch) {
      const partial = (tagMatch[1] ?? '').toLowerCase();
      const filtered = partial ? allTags.filter(t => t.includes(partial) && t !== partial) : allTags;
      if (filtered.length > 0) {
        setTitleSuggs(filtered.slice(0, 6)); setTitleSuggIdx(-1); return;
      }
    }

    setTitleSuggs([]);
  };
  const handleNewNote = async () => {
    const folderId = (currentFolder && !currentFolder.isSmart) ? currentFolder.id : null;
    const id = await createNote(folderId);
    setSelectedId(id); setTitle(''); setContent(''); setSaveStatus('saved');
    editor?.commands.setContent('');
    setMobilePanel('editor');
    setTimeout(() => titleRef.current?.focus(), 80);
  };

  // Ctrl+S — sauvegarde immédiate (bypass du délai autosave)
  // Ctrl+N — nouvelle note
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 's') {
        e.preventDefault();
        if (!selectedId || isReadOnly) return;
        clearTimeout(saveTimer.current);
        setSaveStatus('saving');
        updateNote(selectedId, { title, content })
          .then(() => { setLastSaved(new Date()); setSaveStatus('saved'); })
          .catch(() => setSaveStatus('error'));
      }
      if (e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, isReadOnly, title, content]);

  const handleSelectNote = (note: Note) => {
    setSelectedId(note.id); setTitle(note.title); setContent(note.content);
    editor?.commands.setContent(note.content, { emitUpdate: false });
    setSaveStatus('saved'); setMobilePanel('editor');
  };

  const handlePin = async () => {
    if (!selectedNote || isReadOnly) return;
    await updateNote(selectedNote.id, { pinned: !selectedNote.pinned });
  };

  const triggerFlyToTrash = useCallback((noteId: string, label: string) => {
    const cardEl  = document.querySelector(`[data-note-id="${noteId}"]`);
    const trashEl = trashBtnRef.current;
    if (!cardEl || !trashEl) return;
    const from = cardEl.getBoundingClientRect();
    const to   = trashEl.getBoundingClientRect();
    setFlyItem({
      x: from.left, y: from.top, w: from.width, h: from.height,
      tx: to.left + to.width  / 2 - from.width  / 4,
      ty: to.top  + to.height / 2 - from.height / 4,
      label,
    });
    // Corbeille tremble quand le fantôme arrive (~350ms)
    setTimeout(() => {
      setTrashShake(true);
      setTimeout(() => { setTrashShake(false); setFlyItem(null); }, 460);
    }, 340);
  }, []);

  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    triggerFlyToTrash(selectedId, title || 'Sans titre');
    await deleteNote(selectedId);
    setSelectedId(null); setTitle(''); setContent('');
    setMobilePanel('list'); setConfirmDel(false);
  };

  const handleRecover = async () => {
    if (!selectedId) return;
    await recoverNote(selectedId);
    setSelectedId(null); setTitle(''); setContent('');
    setView('inbox'); setMobilePanel('list');
  };

  const handlePermanentDelete = async () => {
    if (!selectedId) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    await permanentlyDeleteNote(selectedId);
    setSelectedId(null); setTitle(''); setContent('');
    setMobilePanel('list'); setConfirmDel(false);
  };

  const handleMove = async (folderId: string | null) => {
    if (!selectedId) return;
    await moveNote(selectedId, folderId);
    setShowMoveMenu(false);
  };

  const handleCreateRegularFolder = async () => {
    const id = await createFolder('Nouveau dossier', folders.length);
    setNewFolderPendingId(id); setMobilePanel('sidebar');
  };

  const handleCreateSubfolder = async (parentId: string) => {
    const id = await createFolder('Nouveau dossier', folders.length, parentId);
    setNewFolderPendingId(id); setMobilePanel('sidebar');
  };

  const handleCreateSmartFolder = async (name: string, filters: SmartFolderFilter) => {
    const id = await createSmartFolder(name, folders.length, filters);
    setView({ type: 'folder', id }); setShowSmartModal(false);
  };

  const handleUpdateSmartFolder = async (name: string, filters: SmartFolderFilter) => {
    if (!editingSmartId) return;
    await updateSmartFolderFilters(editingSmartId, name, filters);
    setShowSmartModal(false); setEditingSmartId(null);
  };

  const handleEditSmartFolder = (id: string) => { setEditingSmartId(id); setShowSmartModal(true); };

  const handleCreateTag = async (name: string) => { await createTag(name); };
  const handleDeleteTag = async (name: string) => { await deleteTag(name); };

  const saveLabel = () => {
    if (saveStatus === 'saving')  return 'Sauvegarde...';
    if (saveStatus === 'unsaved') return 'Non sauvegardé';
    if (saveStatus === 'error')   return 'Erreur';
    if (lastSaved) return `Sauvegardé ${lastSaved.toLocaleTimeString('fr-CA', { hour: '2-digit', minute: '2-digit' })}`;
    return '';
  };

  const saveColor =
    saveStatus === 'error'   ? 'text-red-400' :
    saveStatus === 'unsaved' ? 'text-yellow-400' :
    saveStatus === 'saving'  ? 'text-gray-400' : 'text-gray-500';

  const hasPinnedSection =
    !isTrash && view !== 'pinned' &&
    filteredNotes.some(n => n.pinned) && filteredNotes.some(n => !n.pinned);

  const pinnedNotes   = hasPinnedSection ? filteredNotes.filter(n => n.pinned)  : [];
  const unpinnedNotes = hasPinnedSection ? filteredNotes.filter(n => !n.pinned) : filteredNotes;
  const regularFolders = folders.filter(f => !f.isSmart);

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <>
      {showSmartModal && (
        <SmartFolderModal
          allTags={allTags}
          initial={smartModalInitial}
          onConfirm={editingSmartId ? handleUpdateSmartFolder : handleCreateSmartFolder}
          onCancel={() => { setShowSmartModal(false); setEditingSmartId(null); }}
        />
      )}

      {/* ── Overlay fantôme "fly to trash" ──────────────────────────────────── */}
      <AnimatePresence>
        {flyItem && (
          <motion.div
            key="fly-ghost"
            initial={{ x: flyItem.x, y: flyItem.y, opacity: 0.85, scale: 1 }}
            animate={{
              x: flyItem.tx, y: flyItem.ty,
              opacity: 0, scale: 0.35,
            }}
            transition={{ duration: 0.38, ease: 'easeIn' }}
            style={{
              position: 'fixed',
              width: flyItem.w,
              height: Math.min(flyItem.h, 44),
              zIndex: 9999,
              pointerEvents: 'none',
              top: 0, left: 0,
            }}
            className="bg-dark-800 border border-yellow-500/40 rounded-lg shadow-2xl flex items-center gap-2 px-3 py-1 overflow-hidden"
          >
            <StickyNote size={11} className="text-yellow-400 shrink-0" />
            <span className="text-xs text-gray-300 truncate">{flyItem.label}</span>
          </motion.div>
        )}
      </AnimatePresence>

      <div
        className="flex h-screen overflow-hidden rounded-xl"
        onClick={() => {
          setShowMoveMenu(false); setShowSortMenu(false);
          setSuggestions([]); setShowNewFolderMenu(false);
        }}
      >
        {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
        <div className={`
          ${mobilePanel === 'sidebar' ? 'flex' : 'hidden'} md:flex
          w-full md:w-52 shrink-0 flex-col bg-dark-950 border-r border-dark-700
        `}>
          <div className="md:hidden flex items-center justify-between px-3 py-2 border-b border-dark-700">
            {/* Header mobile — logo + nom app */}
            <div className="flex items-center gap-1.5">
              <svg width="16" height="19" viewBox="0 0 22 26" fill="none" aria-hidden="true">
                <path d="M 0 0 L 14 0 L 22 8 L 22 26 L 0 26 Z" fill="#e8e8e8" />
                <path d="M 14 0 L 22 8 L 14 8 Z" fill="#eab308" />
              </svg>
              <span className="text-sm font-semibold text-white">MyNoteSpace</span>
            </div>
            <button type="button" title="Voir la liste" onClick={() => setMobilePanel('list')} className="text-gray-400 hover:text-white">
              <ChevronRight size={16} />
            </button>
          </div>
          <div className="px-2 pt-3 pb-1 flex items-center justify-between">
            {/* Header desktop — logo + nom app (style Notion workspace header) */}
            <div className="flex items-center gap-1.5">
              <svg width="14" height="17" viewBox="0 0 22 26" fill="none" aria-hidden="true">
                <path d="M 0 0 L 14 0 L 22 8 L 22 26 L 0 26 Z" fill="#e8e8e8" />
                <path d="M 14 0 L 22 8 L 14 8 Z" fill="#eab308" />
              </svg>
              <span className="text-xs font-semibold text-gray-300">MyNoteSpace</span>
            </div>
            <div className="relative">
              <button
                type="button"
                onClick={e => { e.stopPropagation(); setShowNewFolderMenu(!showNewFolderMenu); }}
                title="Nouveau dossier"
                className="text-gray-500 hover:text-yellow-400 transition-colors p-1 rounded"
              >
                <FolderPlus size={13} />
              </button>
              {showNewFolderMenu && (
                <div
                  className="absolute right-0 top-full z-50 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden w-48"
                  onClick={e => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => { handleCreateRegularFolder(); setShowNewFolderMenu(false); }}
                    className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <FolderPlus size={13} /> Nouveau dossier
                  </button>
                  <button
                    type="button"
                    onClick={() => { setEditingSmartId(null); setShowSmartModal(true); setShowNewFolderMenu(false); }}
                    className="w-full px-3 py-2 text-sm text-left text-gray-300 hover:bg-dark-700 flex items-center gap-2"
                  >
                    <Zap size={13} className="text-yellow-400" /> Dossier intelligent
                  </button>
                </div>
              )}
            </div>
          </div>
          <NotesSidebar
            notes={notes}
            deletedNotes={deletedNotes}
            folders={folders}
            manualTags={manualTags}
            view={view}
            onSelectView={v => { setView(v); setMobilePanel('list'); }}
            newFolderPendingId={newFolderPendingId}
            onFolderCreated={() => setNewFolderPendingId(null)}
            onEditSmartFolder={handleEditSmartFolder}
            onCreateTag={handleCreateTag}
            onDeleteTag={handleDeleteTag}
            trashBtnRef={trashBtnRef}
            trashShake={trashShake}
            onCreateSubfolder={handleCreateSubfolder}
          />

          {/* ── Profil utilisateur + déconnexion ─────────────────────────────
              Affiché en bas de la sidebar. Photo Google ou icône initiales,
              nom/email tronqué, bouton de déconnexion rouge au hover.       */}
          <div className="mt-auto border-t border-dark-700/60 p-3">
            <div className="flex items-center gap-2.5">
              {/* Avatar : photo Google si disponible, sinon icône initiale */}
              {user?.photoURL ? (
                <img
                  src={user.photoURL}
                  alt="Avatar"
                  className="w-7 h-7 rounded-full shrink-0 ring-1 ring-dark-600"
                  referrerPolicy="no-referrer"
                />
              ) : (
                <div className="w-7 h-7 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0 ring-1 ring-yellow-500/30">
                  <UserIcon size={13} className="text-yellow-400" />
                </div>
              )}
              {/* Nom + email */}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-300 truncate">
                  {user?.displayName || user?.email?.split('@')[0] || 'Utilisateur'}
                </p>
                <p className="text-[10px] text-gray-600 truncate">{user?.email}</p>
              </div>
              {/* Bouton déconnexion */}
              <button
                type="button"
                onClick={() => signOut()}
                title="Se déconnecter"
                className="text-gray-500 hover:text-red-400 transition-colors duration-[120ms] p-1 rounded"
              >
                <LogOut size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* ══ NOTE LIST ════════════════════════════════════════════════════════ */}
        <div className={`
          ${mobilePanel === 'list' ? 'flex' : 'hidden'} md:flex
          w-full md:w-72 shrink-0 flex-col bg-dark-900 border-r border-dark-700
        `}>
          <div className="px-3 pt-3 pb-2 border-b border-dark-700">
            <div className="md:hidden flex items-center gap-2 mb-2">
              <button type="button" onClick={() => setMobilePanel('sidebar')} className="flex items-center gap-1 text-xs text-gray-400 hover:text-white">
                <ArrowLeft size={13} />{viewLabel(view, folders)}
              </button>
            </div>
            <div className="flex items-center justify-between mb-2">
              <span className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
                {currentFolder?.isSmart && <Zap size={12} className="text-yellow-400 shrink-0" />}
                {viewLabel(view, folders)}
              </span>
              <div className="flex items-center gap-1">
                {!isTrash && (
                  <div className="relative">
                    <button type="button" title="Trier"
                      onClick={e => { e.stopPropagation(); setShowSortMenu(!showSortMenu); }}
                      className="p-1 rounded text-gray-500 hover:text-white hover:bg-dark-700 transition-colors"
                    >
                      <ArrowUpDown size={12} />
                    </button>
                    {showSortMenu && (
                      <div className="absolute right-0 top-full z-50 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden w-44" onClick={e => e.stopPropagation()}>
                        <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Trier par</p>
                        {([
                          ['dateModified', 'Date de modification'],
                          ['dateCreated',  'Date de création'],
                          ['title',        'Titre'],
                        ] as [SortBy, string][]).map(([val, label]) => (
                          <button key={val} type="button"
                            onClick={() => { setSortBy(val); setShowSortMenu(false); }}
                            className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${sortBy === val ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-300 hover:bg-dark-700'}`}
                          >{label}</button>
                        ))}
                      </div>
                    )}
                  </div>
                )}
                {!isTrash && (
                  <button type="button" onClick={handleNewNote} title="Nouvelle note" className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors">
                    <Plus size={14} />
                  </button>
                )}
                {isTrash && deletedNotes.length > 0 && (
                  <button type="button" title="Vider la corbeille"
                    onClick={() => { if (confirm('Supprimer définitivement toutes les notes ?')) deletedNotes.forEach(n => permanentlyDeleteNote(n.id)); }}
                    className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
                  >Vider</button>
                )}
              </div>
            </div>
            <div className="relative">
              <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
              <input
                ref={searchRef}
                type="text"
                placeholder="Rechercher… (Ctrl+F)"
                value={search}
                onChange={e => setSearch(e.target.value)}
                onKeyDown={e => { if (e.key === 'Escape') { setSearch(''); searchRef.current?.blur(); } }}
                className="w-full pl-7 pr-7 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
              />
              {search && (
                <button type="button" title="Effacer" onClick={() => setSearch('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white">
                  <X size={11} />
                </button>
              )}
            </div>
            {search && (
              <p className="text-[10px] text-gray-500 mt-1 text-right">
                {filteredNotes.length} résultat{filteredNotes.length !== 1 ? 's' : ''}
              </p>
            )}
          </div>

          <div className="flex-1 overflow-y-auto">
            {loading ? (
              <p className="text-center text-gray-500 text-xs mt-10">Chargement...</p>
            ) : filteredNotes.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-600">
                <StickyNote size={28} className="mb-2 opacity-30" />
                <p className="text-xs">{search ? 'Aucun résultat' : isTrash ? 'Corbeille vide' : 'Aucune note'}</p>
              </div>
            ) : (
              <AnimatePresence mode="popLayout">
                {hasPinnedSection && (
                  <div key="pinned-header" className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest bg-dark-900 sticky top-0 z-10">Épinglées</div>
                )}
                {hasPinnedSection && pinnedNotes.map(note => (
                  <NoteCard key={note.id} note={note} selected={selectedId === note.id} onSelect={handleSelectNote} />
                ))}
                {hasPinnedSection && (
                  <div key="unpinned-header" className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest bg-dark-900 sticky top-6 z-10">Notes</div>
                )}
                {unpinnedNotes.map(note => (
                  <NoteCard key={note.id} note={note} selected={selectedId === note.id} onSelect={handleSelectNote}
                    trashInfo={isTrash && note.deletedAt ? daysUntilPurge(note.deletedAt) : undefined}
                  />
                ))}
              </AnimatePresence>
            )}
          </div>
        </div>

        {/* ══ EDITOR ═══════════════════════════════════════════════════════════ */}
        <div
          className={focusMode
            ? 'fixed inset-0 z-50 bg-dark-950 flex flex-col'
            : `${mobilePanel === 'editor' ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-dark-900 min-w-0`}
          onClick={e => e.stopPropagation()}
        >
          {!selectedNote ? (
            <div className="flex-1 flex flex-col items-center justify-center text-gray-600 gap-3">
              <StickyNote size={48} className="opacity-20" />
              <p className="text-sm">{isTrash ? 'Sélectionne une note à récupérer' : 'Sélectionne une note ou'}</p>
              {!isTrash && (
                <button type="button" onClick={handleNewNote} className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg text-sm transition-colors">
                  <Plus size={14} /> Nouvelle note
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Toolbar */}
              <div className="flex items-center px-4 py-2 border-b border-dark-700 gap-2">
                <button type="button" title="Retour à la liste" onClick={() => setMobilePanel('list')} className="md:hidden text-gray-400 hover:text-white mr-1">
                  <ArrowLeft size={15} />
                </button>
                {isReadOnly && (
                  <span className="text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">Lecture seule</span>
                )}
                <span className={`text-xs ${saveColor} mr-auto`}>{!isReadOnly && saveLabel()}</span>

                {isReadOnly && (
                  <>
                    <button type="button" onClick={handleRecover} className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg text-xs transition-colors">
                      <RotateCcw size={12} /> Récupérer
                    </button>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={handlePermanentDelete} title="Supprimer définitivement"
                        className={`p-1.5 rounded transition-colors ${confirmDel ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-red-400 hover:bg-dark-700'}`}
                      ><Trash2 size={14} /></button>
                      {confirmDel && <span className="text-[10px] text-red-400">Cliquer encore</span>}
                    </div>
                    {selectedNote.deletedAt && (
                      <span className="text-[10px] text-gray-500 ml-1">{daysUntilPurge(selectedNote.deletedAt)}j restants</span>
                    )}
                  </>
                )}

                {!isReadOnly && (
                  <>
                    <div className="relative">
                      <button type="button" onClick={e => { e.stopPropagation(); setShowMoveMenu(!showMoveMenu); }} title="Déplacer vers"
                        className="p-1.5 rounded text-gray-500 hover:text-white hover:bg-dark-700 transition-colors"
                      ><FolderOpen size={14} /></button>
                      {showMoveMenu && (
                        <div className="absolute right-0 top-full z-50 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden w-44" onClick={e => e.stopPropagation()}>
                          <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Déplacer vers</p>
                          <button type="button" onClick={() => handleMove(null)} className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${!selectedNote.folderId ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-300 hover:bg-dark-700'}`}>Toutes mes notes</button>
                          {regularFolders.map(f => (
                            <button key={f.id} type="button" onClick={() => handleMove(f.id)} className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${selectedNote.folderId === f.id ? 'text-yellow-400 bg-yellow-500/10' : 'text-gray-300 hover:bg-dark-700'}`}>{f.name}</button>
                          ))}
                          <div className="border-t border-dark-700 mt-1">
                            <button type="button" onClick={async () => { setShowMoveMenu(false); await handleCreateRegularFolder(); }} className="w-full px-3 py-1.5 text-sm text-left text-gray-400 hover:text-white hover:bg-dark-700 flex items-center gap-2">
                              <Plus size={12} /> Nouveau dossier
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                    <button type="button" onClick={handlePin} title={selectedNote.pinned ? 'Désépingler' : 'Épingler'}
                      className={`p-1.5 rounded transition-colors ${selectedNote.pinned ? 'text-yellow-400 bg-yellow-500/15' : 'text-gray-500 hover:text-white hover:bg-dark-700'}`}
                    ><Pin size={14} /></button>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={handleDelete} title="Mettre à la corbeille"
                        className={`p-1.5 rounded transition-colors ${confirmDel ? 'bg-red-500/20 text-red-400' : 'text-gray-500 hover:text-red-400 hover:bg-dark-700'}`}
                      ><Trash2 size={14} /></button>
                      {confirmDel && <span className="text-[10px] text-red-400 whitespace-nowrap">Cliquer encore</span>}
                    </div>
                  </>
                )}
              </div>

              {/* Barre d'outils rich text + éditeur TipTap */}
              {/* En focusMode : min-h-0 obligatoire pour que le scroll-wrapper enfant puisse scroller
               *  (sans min-h-0, min-height:auto flex empêche overflow-y-auto de se déclencher) */}
              <div className={`relative flex-1 min-h-0 flex flex-col ${focusMode ? '' : 'overflow-hidden'}`}>
                {!isReadOnly && (
                  <EditorToolbar
                    editor={editor}
                    onImageClick={() => imageInputRef.current?.click()}
                    onFileClick={() => fileInputRef.current?.click()}
                    uploadProgress={uploadProgress}
                    focusMode={focusMode}
                    onFocusToggle={() => setFocusMode(f => !f)}
                    onExportMd={handleExportMarkdown}
                    onExportPdf={handleExportPDF}
                    onCodeBlockClick={openCodeModal}
                    onDrawClick={() => setExcalidrawModal({ open: true })}
                    onImportDocxClick={() => docxInputRef.current?.click()}
                    onExportDocxClick={handleExportDocx}
                    onImportPdfClick={() => pdfInputRef.current?.click()}
                  />
                )}

                {/* ══ SCROLL UNIQUE + PAGE CENTRÉE (focusMode) ══════════════════
                 *  focusMode  : un seul scroll vertical (flex-1 min-h-0 overflow-y-auto).
                 *               min-h-0 obligatoire — sans ça min-height:auto (flex défaut)
                 *               empêche overflow-y-auto de se déclencher.
                 *               Page centrée à 850px max, clic dans les marges → focus éditeur.
                 *  hors focus : divs transparentes (flex-1 flex flex-col min-h-0). */}
                <div
                  className={focusMode ? 'flex-1 min-h-0 overflow-y-auto' : 'flex-1 flex flex-col min-h-0'}
                  onClick={focusMode ? () => editor?.commands.focus('end') : undefined}
                >
                <div className={focusMode ? 'max-w-[1080px] mx-auto w-full py-8' : 'flex-1 flex flex-col min-h-0'}>

                {/* Titre + autocomplete */}
                <div className="relative">
                  <input
                    ref={titleRef}
                    type="text" value={title} onChange={e => handleTitleChange(e.target.value)}
                    onKeyDown={handleTitleSuggKey}
                    onBlur={() => setTimeout(() => setTitleSuggs([]), 150)}
                    placeholder="Titre" readOnly={isReadOnly} aria-label="Titre de la note"
                    className={`w-full px-6 pt-4 pb-1 bg-transparent text-xl font-bold text-white placeholder-gray-600 focus:outline-none ${isReadOnly ? 'cursor-default' : ''}`}
                  />
                  {titleSuggs.length > 0 && (
                    <div className="absolute left-6 top-full z-50 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden min-w-[220px]" onClick={e => e.stopPropagation()}>
                      <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tags</p>
                      {titleSuggs.map((t, i) => (
                        <button key={t} type="button"
                          onMouseDown={e => { e.preventDefault(); applyTitleSugg(t); }}
                          className={`w-full px-3 py-1.5 text-sm text-left transition-colors truncate flex items-center gap-2 ${
                            i === titleSuggIdx ? 'bg-yellow-500/20 text-yellow-300' : 'text-yellow-400 hover:bg-dark-700'
                          }`}
                        >
                          <Hash size={11} />#{t}
                        </button>
                      ))}
                      <p className="px-3 py-1 text-[10px] text-gray-600">↑↓ · Tab/Enter · Esc</p>
                    </div>
                  )}
                </div>

                {selectedNote.folderId && (
                  <div className="px-6 pb-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <FolderOpen size={11} />{folders.find(f => f.id === selectedNote.folderId)?.name ?? 'Dossier'}
                    </span>
                  </div>
                )}
                {/* Inputs fichiers cachés */}
                <input ref={imageInputRef} type="file" accept="image/*" className="hidden"
                  aria-label="Insérer une image"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImageInsert(f); e.target.value = ''; }} />
                <input ref={fileInputRef} type="file" className="hidden"
                  aria-label="Joindre un fichier"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleFileInsert(f); e.target.value = ''; }} />
                <input ref={docxInputRef} type="file" accept=".docx" className="hidden"
                  aria-label="Importer un fichier Word"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImportDocx(f); e.target.value = ''; }} />
                <input ref={pdfInputRef} type="file" accept=".pdf" className="hidden"
                  aria-label="Ouvrir un fichier PDF"
                  onChange={e => { const f = e.target.files?.[0]; if (f) handleImportPdf(f); e.target.value = ''; }} />
                {/* Barre contextuelle bloc de code — s'affiche quand curseur est dans un bloc */}
                {isInCodeBlock && !isReadOnly && editor && (
                  <div className="px-3 py-1.5 border-b border-dark-800 flex items-center gap-2 bg-dark-900 shrink-0">
                    <Code2 size={11} className="text-yellow-400 shrink-0" />
                    <select
                      title="Langage du bloc de code"
                      value={codeBlockLang}
                      onChange={e => {
                        const lang = e.target.value;
                        setCodeBlockLang(lang);
                        editor.chain().focus().updateAttributes('codeBlock', {
                          language: lang === 'auto' ? null : lang,
                        }).run();
                      }}
                      className="text-xs bg-dark-800 text-gray-300 border border-dark-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-yellow-500/50 cursor-pointer"
                    >
                      {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                    </select>
                    <div className="w-px h-3 bg-dark-700" />
                    <button
                      type="button"
                      onClick={() => {
                        const { $from } = editor.state.selection;
                        let node = $from.parent;
                        if (node.type.name !== 'codeBlock') {
                          for (let d = $from.depth; d >= 0; d--) {
                            const n = $from.node(d);
                            if (n.type.name === 'codeBlock') { node = n; break; }
                          }
                        }
                        navigator.clipboard.writeText(node.textContent).then(() => {
                          setCodeCopied(true);
                          setTimeout(() => setCodeCopied(false), 1500);
                        });
                      }}
                      className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
                    >
                      {codeCopied ? <span className="text-green-400">✓ Copié</span> : 'Copier'}
                    </button>
                    <button
                      type="button"
                      onClick={openCodeModal}
                      className="ml-auto text-xs text-gray-500 hover:text-yellow-400 transition-colors"
                    >
                      Modifier…
                    </button>
                  </div>
                )}
                {/* BubbleMenu tableau — outils contextuels (apparaît quand curseur dans une cellule) */}
                {editor && !isReadOnly && (
                  <BubbleMenu
                    editor={editor}
                    options={{ placement: 'top' }}
                    shouldShow={({ editor: e }) => e.isActive('tableCell') || e.isActive('tableHeader')}
                    className="flex items-center gap-0.5 flex-wrap bg-dark-800 border border-dark-700 rounded-lg px-1.5 py-1 shadow-2xl z-50 max-w-sm"
                  >
                    {/* Lignes */}
                    <button type="button" title="Ajouter une ligne au-dessus"
                      onClick={() => editor.chain().focus().addRowBefore().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-white hover:bg-dark-700 transition-colors whitespace-nowrap">
                      ↑ Ligne
                    </button>
                    <button type="button" title="Ajouter une ligne en-dessous"
                      onClick={() => editor.chain().focus().addRowAfter().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-white hover:bg-dark-700 transition-colors whitespace-nowrap">
                      ↓ Ligne
                    </button>
                    <button type="button" title="Supprimer la ligne"
                      onClick={() => editor.chain().focus().deleteRow().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-red-400/70 hover:text-red-400 hover:bg-dark-700 transition-colors whitespace-nowrap">
                      ✕ Ligne
                    </button>
                    <div className="w-px h-4 bg-dark-700 mx-0.5 shrink-0" />
                    {/* Colonnes */}
                    <button type="button" title="Ajouter une colonne à gauche"
                      onClick={() => editor.chain().focus().addColumnBefore().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-white hover:bg-dark-700 transition-colors whitespace-nowrap">
                      ← Col.
                    </button>
                    <button type="button" title="Ajouter une colonne à droite"
                      onClick={() => editor.chain().focus().addColumnAfter().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-white hover:bg-dark-700 transition-colors whitespace-nowrap">
                      → Col.
                    </button>
                    <button type="button" title="Supprimer la colonne"
                      onClick={() => editor.chain().focus().deleteColumn().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-red-400/70 hover:text-red-400 hover:bg-dark-700 transition-colors whitespace-nowrap">
                      ✕ Col.
                    </button>
                    <div className="w-px h-4 bg-dark-700 mx-0.5 shrink-0" />
                    {/* Fusion / Scission */}
                    <button type="button" title="Fusionner les cellules sélectionnées"
                      onClick={() => editor.chain().focus().mergeCells().run()}
                      disabled={!editor.can().mergeCells()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-white hover:bg-dark-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
                      Fusionner
                    </button>
                    <button type="button" title="Scinder la cellule"
                      onClick={() => editor.chain().focus().splitCell().run()}
                      disabled={!editor.can().splitCell()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-400 hover:text-white hover:bg-dark-700 transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
                      Scinder
                    </button>
                    <div className="w-px h-4 bg-dark-700 mx-0.5 shrink-0" />
                    {/* En-tête */}
                    <button type="button" title="Basculer la ligne en en-tête"
                      onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                      className={`text-xs px-1.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                        editor.isActive('tableHeader') ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'
                      }`}>
                      En-tête
                    </button>
                    <div className="w-px h-4 bg-dark-700 mx-0.5 shrink-0" />
                    {/* Supprimer le tableau */}
                    <button type="button" title="Supprimer le tableau"
                      onClick={() => editor.chain().focus().deleteTable().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-red-400/70 hover:text-red-400 hover:bg-dark-700 transition-colors whitespace-nowrap">
                      ✕ Tableau
                    </button>
                  </BubbleMenu>
                )}
                {/* BubbleMenu — formatage rapide à la sélection (apparaît sous le texte) */}
                {editor && !isReadOnly && (
                  <BubbleMenu editor={editor} options={{ placement: 'bottom' }}
                    className="flex items-center gap-0.5 bg-dark-800 border border-dark-700 rounded-lg p-1 shadow-2xl z-50">
                    <button type="button" title="Gras (Ctrl+B)"
                      onClick={() => editor.chain().focus().toggleBold().run()}
                      className={`p-1.5 rounded transition-colors ${editor.isActive('bold') ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}>
                      <Bold size={12} />
                    </button>
                    <button type="button" title="Italique (Ctrl+I)"
                      onClick={() => editor.chain().focus().toggleItalic().run()}
                      className={`p-1.5 rounded transition-colors ${editor.isActive('italic') ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}>
                      <Italic size={12} />
                    </button>
                    <div className="w-px h-4 bg-dark-700 mx-0.5" />
                    <div className="relative">
                      <button type="button" title="Lien hypertexte"
                        onClick={() => {
                          if (editor.isActive('link')) {
                            editor.chain().focus().unsetLink().run();
                            setBubbleLinkOpen(false);
                          } else {
                            setBubbleLinkVal(editor.getAttributes('link').href || '');
                            setBubbleLinkOpen(o => !o);
                          }
                        }}
                        className={`p-1.5 rounded transition-colors ${editor.isActive('link') ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-400 hover:text-white hover:bg-dark-700'}`}>
                        <LinkIcon size={12} />
                      </button>
                      {bubbleLinkOpen && (
                        <div
                          className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-dark-800 border border-dark-600 rounded-lg p-2 shadow-xl flex gap-1.5 min-w-[200px]"
                          onMouseDown={e => e.stopPropagation()}>
                          <input
                            autoFocus
                            value={bubbleLinkVal}
                            onChange={e => setBubbleLinkVal(e.target.value)}
                            onKeyDown={e => {
                              if (e.key === 'Enter') {
                                const href = bubbleLinkVal.trim();
                                if (!href) editor.chain().focus().unsetLink().run();
                                else editor.chain().focus().setLink({ href: href.startsWith('http') ? href : `https://${href}` }).run();
                                setBubbleLinkOpen(false); setBubbleLinkVal('');
                              }
                              if (e.key === 'Escape') { setBubbleLinkOpen(false); setBubbleLinkVal(''); }
                            }}
                            placeholder="https://..."
                            className="flex-1 text-xs bg-dark-700 text-gray-200 placeholder-gray-500 rounded px-2 py-1 focus:outline-none border border-dark-600 focus:border-yellow-500/50"
                          />
                          <button type="button"
                            onMouseDown={e => {
                              e.preventDefault();
                              const href = bubbleLinkVal.trim();
                              if (!href) editor.chain().focus().unsetLink().run();
                              else editor.chain().focus().setLink({ href: href.startsWith('http') ? href : `https://${href}` }).run();
                              setBubbleLinkOpen(false); setBubbleLinkVal('');
                            }}
                            className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded transition-colors">
                            OK
                          </button>
                        </div>
                      )}
                    </div>
                  </BubbleMenu>
                )}
                {/* En focusMode : le scroll est géré par le scroll-wrapper parent → pas d'overflow-y ici */}
                <EditorContent
                  editor={editor}
                  className={focusMode ? 'px-6 py-2' : 'flex-1 px-6 py-2 overflow-y-auto min-h-0'}
                />
                {/* Slash command menu */}
                {slashMenu && (() => {
                  const cmds = SLASH_CMDS.filter(c =>
                    !slashFilter || c.id.startsWith(slashFilter) || c.label.toLowerCase().startsWith(slashFilter)
                  );
                  if (cmds.length === 0) return null;
                  return (
                    <div className="absolute left-6 top-16 z-50 bg-dark-800 border border-dark-600 rounded-xl shadow-2xl overflow-hidden w-64"
                      onClick={e => e.stopPropagation()}>
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Commandes — tapez pour filtrer
                      </p>
                      {cmds.map((c, i) => (
                        <button key={c.id} type="button"
                          onMouseDown={e => { e.preventDefault(); applySlashCommand(i); }}
                          className={`w-full px-3 py-2 text-sm text-left flex items-center gap-3 transition-colors ${
                            i === slashIdx ? 'bg-yellow-500/15 text-yellow-300' : 'text-gray-300 hover:bg-dark-700'
                          }`}
                        >
                          <span className="font-medium text-sm w-24 shrink-0">{c.label}</span>
                          <span className="text-xs text-gray-500 truncate">{c.desc}</span>
                        </button>
                      ))}
                      <p className="px-3 py-1.5 text-[10px] text-gray-600 border-t border-dark-700">↑↓ · Enter · Esc</p>
                    </div>
                  );
                })()}

                {suggestions.length > 0 && (
                  <div className="absolute left-6 bottom-4 z-50 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden min-w-[160px]" onClick={e => e.stopPropagation()}>
                    <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tags</p>
                    {suggestions.map((item, i) => (
                      <button key={item} type="button" onClick={() => applySuggestion(item)}
                        className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 transition-colors ${
                          i === suggestionIdx ? 'bg-yellow-500/20 text-yellow-300' : 'text-yellow-400 hover:bg-dark-700'
                        }`}
                      >
                        <Hash size={11} />#{item}
                      </button>
                    ))}
                    <p className="px-3 py-1 text-[10px] text-gray-600">↑↓ · Tab/Enter · Esc</p>
                  </div>
                )}
                {/* Compteur mots / caractères */}
                {editor && (
                  <div className="px-6 py-1 border-t border-dark-900 flex justify-end shrink-0">
                    <span className="text-[10px] text-gray-600">
                      {editor.storage.characterCount?.words?.() ?? 0} mots
                      · {editor.storage.characterCount?.characters?.() ?? 0} car.
                    </span>
                  </div>
                )}
                {/* Tags — dans la page centrée pour scroller avec le contenu en focusMode */}
                {selectedNote.tags.length > 0 && (
                  <div className="px-6 py-2.5 border-t border-dark-800 flex items-center gap-1.5 flex-wrap">
                    <Hash size={11} className="text-gray-600" />
                    {selectedNote.tags.map(t => (
                      <span key={t}
                        onClick={() => { if (!isTrash) setView({ type: 'tag', tag: t }); }}
                        className={`text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full transition-colors ${!isTrash ? 'cursor-pointer hover:bg-yellow-500/20' : ''}`}
                      >#{t}</span>
                    ))}
                  </div>
                )}
                </div>{/* fin page-centered (max-w-[1080px]) */}
                </div>{/* fin scroll-wrapper */}
              </div>
            </>
          )}
        </div>
      </div>
      {/* ── Modal bloc de code ──────────────────────────────────────────────── */}
      {codeModal?.open && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
          onClick={() => setCodeModal(null)}
        >
          <div
            className="bg-dark-900 border border-dark-700 rounded-xl shadow-2xl w-[700px] max-w-[95vw] flex flex-col max-h-[80vh]"
            onClick={e => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-800 shrink-0">
              <Code2 size={14} className="text-yellow-400" />
              <span className="text-sm font-semibold text-gray-200">
                {codeModal.isEdit ? 'Modifier le bloc de code' : 'Nouveau bloc de code'}
              </span>
              <div className="ml-auto flex items-center gap-2">
                <select
                  title="Langage du bloc de code"
                  value={codeModal.lang}
                  onChange={e => setCodeModal(m => m ? { ...m, lang: e.target.value } : m)}
                  className="text-xs bg-dark-800 text-gray-300 border border-dark-600 rounded px-2 py-1 focus:outline-none focus:border-yellow-500/50 cursor-pointer"
                >
                  {LANGUAGES.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
                </select>
                <button
                  type="button"
                  title="Fermer"
                  onClick={() => setCodeModal(null)}
                  className="p-1 text-gray-500 hover:text-white rounded transition-colors"
                >
                  <X size={15} />
                </button>
              </div>
            </div>

            {/* Zone de code */}
            <textarea
              value={codeModal.code}
              onChange={e => setCodeModal(m => m ? { ...m, code: e.target.value } : m)}
              onKeyDown={e => {
                if (e.key === 'Tab') {
                  e.preventDefault();
                  const el = e.currentTarget;
                  const start = el.selectionStart ?? 0;
                  const end   = el.selectionEnd   ?? 0;
                  const next  = el.value.substring(0, start) + '  ' + el.value.substring(end);
                  setCodeModal(m => m ? { ...m, code: next } : m);
                  setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2; }, 0);
                } else if (e.key === 'Escape') {
                  setCodeModal(null);
                }
              }}
              placeholder="Écrivez votre code ici…"
              autoFocus
              spellCheck={false}
              className="code-modal-textarea flex-1 bg-dark-950 text-gray-200 text-sm px-4 py-3 resize-none focus:outline-none min-h-[320px] overflow-y-auto"
            />

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-3 border-t border-dark-800 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (!codeModal.code) return;
                  navigator.clipboard.writeText(codeModal.code).then(() => {
                    setCodeModalCopied(true);
                    setTimeout(() => setCodeModalCopied(false), 1500);
                  });
                }}
                className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
              >
                {codeModalCopied ? <span className="text-green-400">✓ Copié</span> : 'Copier'}
              </button>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setCodeModal(null)}
                  className="text-xs px-3 py-1.5 rounded text-gray-400 hover:text-white hover:bg-dark-800 transition-colors"
                >
                  Annuler
                </button>
                <button
                  type="button"
                  onClick={applyCodeModal}
                  className="text-xs px-3 py-1.5 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors font-medium"
                >
                  {codeModal.isEdit ? 'Mettre à jour' : 'Insérer'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Modal Excalidraw — plein écran ──────────────────────────────────── */}
      {excalidrawModal?.open && (
        <div className="fixed inset-0 z-[200] flex flex-col bg-dark-950">
          {/* Header */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-dark-800 shrink-0 bg-dark-900">
            <Pencil size={14} className="text-yellow-400" />
            <span className="text-sm font-semibold text-gray-200">Dessin</span>
            <span className="text-xs text-gray-500">Glissez-déposez un fichier .excalidraw pour l&apos;ouvrir</span>
            <div className="ml-auto flex items-center gap-2">
              {uploadProgress !== null && (
                <span className="text-xs text-yellow-400">{uploadProgress}%</span>
              )}
              <button
                type="button"
                onClick={insertExcalidraw}
                className="text-xs px-3 py-1.5 rounded bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors font-medium"
              >
                Insérer dans la note
              </button>
              <button
                type="button"
                title="Fermer"
                onClick={() => setExcalidrawModal(null)}
                className="p-1 text-gray-500 hover:text-white rounded transition-colors"
              >
                <X size={15} />
              </button>
            </div>
          </div>
          {/* Canvas Excalidraw */}
          <div className="flex-1 overflow-hidden">
            <ExcalidrawComponent
              excalidrawAPI={(api: ExcalidrawImperativeAPI) => { excalidrawApiRef.current = api; }}
              initialData={excalidrawModal.initialData}
              theme="dark"
              UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false } }}
            />
          </div>
        </div>
      )}
    </>
  );
}

// ── NoteCard ─────────────────────────────────────────────────────────────────

// forwardRef requis pour AnimatePresence mode="popLayout" (framer-motion passe une ref au composant)
const NoteCard = forwardRef<HTMLDivElement, {
  note:       Note;
  selected:   boolean;
  onSelect:   (n: Note) => void;
  trashInfo?: number;
}>(function NoteCard({ note, selected, onSelect, trashInfo }, ref) {
  return (
    <motion.div
      ref={ref}
      data-note-id={note.id}
      layout
      initial={{ opacity: 1 }}
      exit={{ opacity: 0, x: -24, scale: 0.88, transition: { duration: 0.28, ease: 'easeIn' } }}
    >
      <button
        type="button"
        onClick={() => onSelect(note)}
        className={`w-full text-left px-3 py-2.5 border-b border-dark-800 transition-colors duration-[120ms] ${
          selected ? 'bg-yellow-500/10 border-l-2 border-l-yellow-400' : 'hover:bg-dark-700/50'
        }`}
      >
        <div className="flex items-center gap-1.5 mb-0.5">
          {note.pinned && <Pin size={9} className="text-yellow-400 shrink-0" />}
          <span className="text-xs font-semibold text-white truncate">{note.title || 'Sans titre'}</span>
        </div>
        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-gray-500 truncate flex-1">
            {stripHtml(note.content).replace(/#\w+/g, '').trim() || 'Aucun contenu'}
          </p>
          <span className="text-[10px] text-gray-600 shrink-0">
            {trashInfo !== undefined ? <span className="text-orange-500">{trashInfo}j</span> : fmtDate(note.updatedAt)}
          </span>
        </div>
        {note.tags.length > 0 && (
          <div className="flex gap-1 mt-1 flex-wrap">
            {note.tags.slice(0, 3).map(t => (
              <span key={t} className="text-[10px] text-yellow-600 bg-yellow-500/10 px-1 rounded">#{t}</span>
            ))}
            {note.tags.length > 3 && <span className="text-[10px] text-gray-600">+{note.tags.length - 3}</span>}
          </div>
        )}
      </button>
    </motion.div>
  );
});
