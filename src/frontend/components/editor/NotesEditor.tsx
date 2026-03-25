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
  useState, useEffect, useRef, useCallback,
} from 'react';
import {
  FolderPlus, ChevronRight, ChevronDown, Zap,
  LogOut, Settings, Search as SearchIcon,
  ChevronsLeft, ChevronsRight,
} from 'lucide-react';
import Link from 'next/link';
import { useSession, signOut } from 'next-auth/react';
import { usePermissions } from '@/src/frontend/hooks/usePermissions';
import { useRouter } from 'next/navigation';
import type { Editor } from '@tiptap/core';
import { useNotes } from '@/src/frontend/hooks/data/useNotes';
import { useSearch }     from '@/src/frontend/hooks/data/useSearch';
import type { Note } from '@/lib/notes-service';
import { silentlyDeleteNote } from '../../services/notes-mutations-api';
// Fonctions pures extraites vers lib/notes-utils.ts pour être testables indépendamment
import {
  stripHtml,
} from '@/lib/notes-utils';
// Types, constantes et helpers partagés entre sous-composants de l'éditeur
import {
  ViewFilter, SortBy, SaveStatus, MobilePanel, LANGUAGES,
  type NoteContentPayload,
} from '@/lib/notes-types';
import type { JSONContent } from '@tiptap/core';
// Sous-composants extraits
import FlyToTrash        from '@/components/notes/FlyToTrash';
import CodeModal         from '@/components/notes/CodeModal';
import ExcalidrawModal   from '@/components/notes/ExcalidrawModal';
import SmartFolderModal  from '@/components/notes/SmartFolderModal';
import NotesSidebar      from '@/components/notes/NotesSidebar';
import NoteListColumn    from '@/components/notes/NoteListColumn';
import NoteEditorColumn  from '@/components/notes/NoteEditorColumn';
// Hooks custom extraits
import { useAutosave }             from '@/hooks/notes/useAutosave';
import { useNoteFilters }          from '@/hooks/notes/useNoteFilters';
import { useNoteSelection }        from '@/hooks/notes/useNoteSelection';
import { useContentAutocomplete }  from '@/hooks/notes/useContentAutocomplete';
import { useImageFile }            from '@/hooks/notes/useImageFile';
import { useImportExport }         from '@/hooks/notes/useImportExport';
import { useTitleAutocomplete }    from '@/hooks/notes/useTitleAutocomplete';
import { useNoteEditor }           from '@/hooks/notes/useNoteEditor';
import CommandPalette             from '@/src/frontend/components/common/CommandPalette';
import { usePanelCollapse }       from '@/src/frontend/hooks/ui/usePanelCollapse';

// ── Types, constantes et helpers — importés depuis lib/notes-types.ts ────────
// ViewFilter, SortBy, SaveStatus, MobilePanel, viewEq, viewLabel,
// AUTOSAVE_DELAY_MS, SLASH_CMDS, LANGUAGES → voir @/lib/notes-types


// ── Main Component ───────────────────────────────────────────────────────────

export default function NotesEditor() {
  const { notes, deletedNotes, folders, manualTags, loading, refreshNotes, refreshMeta, deleteNoteOptimistic, permanentlyDeleteNoteOptimistic, recoverNoteOptimistic } = useNotes();
  // ── Authentification — pour le profil utilisateur + déconnexion ───────────
  const { data: session } = useSession();
  const { can } = usePermissions();
  const router = useRouter();
  /**
   * Déconnexion robuste : redirect:false évite qu'Auth.js utilise AUTH_URL
   * (qui peut pointer vers localhost en dev) pour construire la destination.
   * La redirection est faite par le router Next.js — toujours vers le bon domaine.
   */
  const handleSignOut = useCallback(async () => {
    await signOut({ redirect: false });
    router.push('/login');
  }, [router]);

  // ── Filtres, vue, tri et recherche ──────────────────────────────────────────
  const {
    view, setView, sortBy, setSortBy, search, setSearch,
    isTrash, currentFolder, allTags, filteredNotes,
    hasPinnedSection, pinnedNotes, unpinnedNotes,
  } = useNoteFilters({ notes, deletedNotes, folders, manualTags });

  // ── Ref partagée vers l'éditeur TipTap ──────────────────────────────────────
  // Créée ici, peuplée par useNoteEditor, consommée par useImageFile / useImportExport / useContentAutocomplete
  const editorRef = useRef<Editor | null>(null);

  // ── Refs "bridge" entre changements de note ──────────────────────────────────
  // prevTitle/prevContent : utilisés par useAutosave (nettoyage notes vides + autosave)
  // prevSelectedId        : guard pour détecter le changement de note
  // hasRestoredRef        : exécution unique de la restauration localStorage
  const prevTitle      = useRef('');
  const prevContent    = useRef<NoteContentPayload | string>('');
  const prevSelectedId = useRef<string | null>(null);
  const hasRestoredRef = useRef(false);

  // ── Ref pour la barre de recherche (Ctrl+F) ──────────────────────────────────
  const searchRef = useRef<HTMLInputElement>(null);

  // ── Refs input fichiers cachés toolbar (image + fichier joint) ───────────────
  // Ces deux refs sont propres à NotesEditor — les autres inputs (docx, pdf) viennent de useImportExport
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef  = useRef<HTMLInputElement>(null);

  // ── Sélection de note + CRUD dossiers/tags ───────────────────────────────────
  const {
    selectedId,  setSelectedId,
    mobilePanel, setMobilePanel,
    title,       setTitle,
    content,     setContent,
    confirmDel,   setConfirmDel,
    showMoveMenu, setShowMoveMenu,
    showSortMenu, setShowSortMenu,
    trashShake,
    focusMode,    setFocusMode,
    flyItem,
    bubbleLinkOpen, setBubbleLinkOpen,
    bubbleLinkVal,  setBubbleLinkVal,
    codeCopied,     setCodeCopied,
    newFolderPendingId, setNewFolderPendingId,
    showNewFolderMenu,  setShowNewFolderMenu,
    showSmartModal,     setShowSmartModal,
    editingSmartId,     setEditingSmartId,
    smartModalInitial,
    titleRef,
    trashBtnRef,
    selectedNote,
    isReadOnly,
    triggerFlyToTrash,
    handleSelectNote:      handleSelectNoteBase,
    handleNewNote:         handleNewNoteBase,
    handlePin,
    handleDelete,
    handleRecover,
    handlePermanentDelete,
    handleMove,
    handleCreateRegularFolder,
    handleCreateSubfolder,
    handleCreateSmartFolder,
    handleUpdateSmartFolder,
    handleEditSmartFolder,
    handleCreateTag,
    handleDeleteTag,
  } = useNoteSelection({ notes, deletedNotes, folders, currentFolder, setView, refreshNotes, refreshMeta, deleteNoteOptimistic, permanentlyDeleteNoteOptimistic, recoverNoteOptimistic });

  // VIEWER ne peut pas modifier — l'éditeur est en lecture seule même hors corbeille
  const effectiveReadOnly = isReadOnly || !can('notes:update');

  // ── Autosave + Background Sync ──────────────────────────────────────────────
  const {
    saveStatus, setSaveStatus,
    lastSaved,  setLastSaved,
    saveTimer,
    scheduleAutoSave, saveImmediately, registerBackgroundSync,
    saveLabel, saveColor,
  } = useAutosave({ selectedId, isReadOnly: effectiveReadOnly, prevTitle, prevContent });

  // ── Autocomplétion contenu (tags + slash commands) ───────────────────────────
  const {
    suggestions,   setSuggestions,
    suggestionIdx, setSuggestionIdx,
    slashMenu,     setSlashMenu,
    slashFilter,
    slashIdx,      setSlashIdx,
    applySuggestion,
    applySlashCommand,
    suggestionsRef,
    suggestionIdxRef,
    applySuggestionRef,
    slashMenuRef,
    slashIdxRef,
    applySlashRef,
    detectAtCursorRef,
  } = useContentAutocomplete({ editorRef, allTags });

  // ── Upload images et fichiers ─────────────────────────────────────────────────
  const {
    uploadProgress, setUploadProgress,
    handleImageInsert,
    handleFileInsert,
    handleImageInsertRef,
    handleFileInsertRef,
  } = useImageFile({ editorRef, selectedId, title, scheduleAutoSave, setContent });

  // ── Import / Export DOCX / PDF / Markdown ─────────────────────────────────────
  const {
    docxInputRef,
    pdfInputRef,
    handleImportDocx,
    handleExportDocx,
    handleImportPdf,
    handleExportMarkdown,
    handleExportPDF,
  } = useImportExport({ editorRef, title, selectedNote, scheduleAutoSave, setContent, setUploadProgress });

  // ── Autocomplétion titre (tags uniquement) ───────────────────────────────────
  const {
    titleSuggs,      setTitleSuggs,
    titleSuggIdx,
    applyTitleSugg,
    handleTitleSuggKey,
    handleTitleChange,
  } = useTitleAutocomplete({ allTags, title, content, setTitle, scheduleAutoSave, titleRef });

  // ── Éditeur TipTap complet (useEditor + modaux code/excalidraw) ──────────────
  const {
    editor,
    codeModal,       setCodeModal,
    codeModalCopied, setCodeModalCopied,
    openCodeModal,   applyCodeModal,
    excalidrawModal, setExcalidrawModal,
    excalidrawApiRef,
    ExcalidrawComponent,
    insertExcalidraw,
    isInCodeBlock,
    codeBlockLang, setCodeBlockLang,
  } = useNoteEditor({
    editorRef,
    selectedId,
    isReadOnly: effectiveReadOnly,
    title,
    slashFilter,
    setContent,
    setSlashFilter: () => {}, // setSlashFilter est géré par useContentAutocomplete via detectAtCursor
    setSlashMenu,
    setSlashIdx,
    setSuggestions,
    setSuggestionIdx,
    setUploadProgress,
    scheduleAutoSave,
    detectAtCursorRef,
    suggestionsRef,
    suggestionIdxRef,
    applySuggestionRef,
    slashMenuRef,
    slashIdxRef,
    applySlashRef,
    handleImageInsertRef,
    handleFileInsertRef,
    titleRef,
  });

  // ── Wrappers handleSelectNote / handleNewNote ─────────────────────────────────
  // Appellent le handler de base (state seul, depuis useNoteSelection) +
  // editor.commands.setContent pour synchroniser l'éditeur TipTap.

  /** Sélectionne une note — met à jour l'état ET l'éditeur */
  const handleSelectNote = (note: Note) => {
    handleSelectNoteBase(note);
    editorRef.current?.commands.setContent(note.content, { emitUpdate: false });
  };

  /** Crée une nouvelle note — initialise l'état ET vide l'éditeur */
  const handleNewNote = async () => {
    await handleNewNoteBase();
    editorRef.current?.commands.setContent('', { emitUpdate: false });
  };

  // ── Effet bridge : nettoyage notes vides + reset UI au changement de note ─────
  /**
   * Exécuté quand selectedId change.
   * Si l'ancienne note était vide (titre + contenu vides après strip HTML),
   * elle est supprimée silencieusement (comportement Apple Notes).
   * Réinitialise les états UI (confirmDel, suggestions, save status, etc.).
   */
  useEffect(() => {
    const oldId      = prevSelectedId.current;
    const oldTitle   = prevTitle.current;
    const oldContent = prevContent.current;
    if (oldId && oldId !== selectedId) {
      const oldHtml = typeof oldContent === 'string' ? oldContent : oldContent.html;
      if (!oldTitle.trim() && !stripHtml(oldHtml).trim()) {
        silentlyDeleteNote(oldId).then(() => refreshNotes());
      }
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

  // ── Effet : chargement du contenu HTML complet depuis l'API ─────────────────
  /**
   * La liste API ne contient pas le contenu des notes (html).
   * À chaque changement de note sélectionnée, on charge le contenu complet
   * via GET /api/notes/[id] et on met à jour l'éditeur TipTap.
   * Les notes absentes de la base PG (anciennes notes Firebase) retournent 404 → ignoré silencieusement.
   */
  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    fetch(`/api/notes/${selectedId}`)
      .then(r => (r.ok ? r.json() : null))
      .then((res: { data?: { content?: { html?: string; json?: Record<string, unknown>; plainText?: string } } } | null) => {
        if (cancelled || !res) return;
        const html      = res.data?.content?.html ?? '';
        const jsonDoc   = res.data?.content?.json;
        const plainText = res.data?.content?.plainText ?? '';
        setContent(html);
        prevContent.current = jsonDoc
          ? { html, json: jsonDoc, plainText }
          : html;
        const ed = editorRef.current;
        if (ed && !ed.isDestroyed) {
          // Préfère le JSON (chargement natif ProseMirror, zéro re-parse HTML)
          // Fallback HTML pour les notes existantes sans JSON encore
          ed.commands.setContent(
            jsonDoc ? jsonDoc as JSONContent : html,
            { emitUpdate: false }
          );
        }
      })
      .catch(() => {/* note introuvable en PG */});
    return () => { cancelled = true; };
  }, [selectedId]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effet bridge : sync temps réel multi-appareil ────────────────────────────
  /**
   * Surveille les changements Firestore (notes onSnapshot).
   * Si la note ouverte a changé sur un autre appareil ET que l'éditeur n'a pas
   * le focus → met à jour title, content, et l'éditeur TipTap.
   * Guard `editorFocused` : ne jamais écraser la frappe locale en cours.
   */
  useEffect(() => {
    if (!selectedId || saveStatus !== 'saved') return;
    const note = notes.find(n => n.id === selectedId);
    if (!note) return;
    const ed = editorRef.current;
    const editorFocused = !!(ed && !ed.isDestroyed && ed.view.hasFocus());
    if (note.title !== title || note.content !== content) {
      setTitle(note.title);
      if (!editorFocused) {
        setContent(note.content);
        prevTitle.current   = note.title;
        prevContent.current = note.content;
        if (ed && !ed.isDestroyed) {
          ed.commands.setContent(note.content, { emitUpdate: false });
        }
      }
    }
  }, [notes]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Effet bridge : restauration localStorage post-hydration ──────────────────
  /**
   * Exécuté une seule fois quand Firestore ET l'éditeur sont prêts.
   * Restaure la dernière note ouverte (notes_selectedId) depuis localStorage.
   * Guard hasRestoredRef : empêche la ré-exécution sur re-renders ultérieurs.
   */
  useEffect(() => {
    if (loading || !editor || editor.isDestroyed || hasRestoredRef.current) return;
    hasRestoredRef.current = true;
    try {
      const savedId = localStorage.getItem('notes_selectedId');
      if (!savedId) return;
      const note = [...notes, ...deletedNotes].find(n => n.id === savedId);
      if (!note) return;
      prevTitle.current   = note.title;
      prevContent.current = note.content;
      setSelectedId(savedId);
      setTitle(note.title);
      setContent(note.content);
      editor.commands.setContent(note.content, { emitUpdate: false });
      setMobilePanel('editor');
    } catch { /* ignore — localStorage peut être bloqué */ }
  }, [loading, editor]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Ctrl+S / Ctrl+N / Ctrl+K ──────────────────────────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 's') {
        e.preventDefault();
        if (!selectedId || effectiveReadOnly) return;
        saveImmediately(title, content);
      }
      if (e.key === 'n') {
        e.preventDefault();
        handleNewNote();
      }
      if (e.key === 'k') {
        e.preventDefault();
        setCmdPaletteOpen(o => !o);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId, effectiveReadOnly, title, content]);

  // ── Panneaux rétractables (persistance localStorage) ─────────────────────────
  const [sidebarOpen,  toggleSidebar,  setSidebarOpen]  = usePanelCollapse('mns:sidebar-open');
  const [noteListOpen, toggleNoteList, setNoteListOpen] = usePanelCollapse('mns:notelist-open');

  // ── Ctrl+F / Cmd+F → focus barre de recherche ───────────────────────────────
  // ── Ctrl+\ → toggle sidebar · Ctrl+Shift+\ → toggle liste ───────────────────
  useEffect(() => {
    const handleGlobalKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'f') {
        e.preventDefault();
        setMobilePanel('list');
        setTimeout(() => searchRef.current?.focus(), 50);
      }
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      }
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && (e.key === '\\' || e.key === '|')) {
        e.preventDefault();
        toggleNoteList();
      }
    };
    window.addEventListener('keydown', handleGlobalKey);
    return () => window.removeEventListener('keydown', handleGlobalKey);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [toggleSidebar, toggleNoteList]);

  // ── Command palette (Ctrl+K) ──────────────────────────────────────────────────
  const [cmdPaletteOpen,  setCmdPaletteOpen]  = useState(false);
  const [avatarPopover,   setAvatarPopover]   = useState(false);
  const avatarBtnRef = useRef<HTMLButtonElement>(null);

  // ── Recherche backend (full-text via /api/search) ─────────────────────────────
  const { results: searchApiResults, isSearching } = useSearch(search);

  /**
   * Quand la barre de recherche est active, on substitue la liste filtrée locale
   * par les résultats du backend (titre + contenu HTML complet).
   * Quand search est vide, on retombe sur la liste locale (useNoteFilters).
   */
  const searchNotes: Note[] = searchApiResults.map(r => ({
    id:        r.id,
    title:     r.title,
    content:   r.plain_text,
    pinned:    r.is_pinned,
    folderId:  r.folder_id || null,
    tags:      [],
    deletedAt: null,
    createdAt: new Date(r.updated_at * 1000),
    updatedAt: new Date(r.updated_at * 1000),
  }));

  const displayedNotes    = search.trim() ? searchNotes    : filteredNotes;
  const displayedPinned   = search.trim() ? []             : pinnedNotes;
  const displayedUnpinned = search.trim() ? searchNotes    : unpinnedNotes;
  const displayedHasPinned = !search.trim() && hasPinnedSection;

  // ── Dérivé : dossiers non-intelligents (pour le menu de déplacement) ─────────
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

      {/* ── Command Palette (Ctrl+K) ─────────────────────────────────────────── */}
      {cmdPaletteOpen && (
        <CommandPalette
          notes={notes}
          folders={folders}
          onClose={() => setCmdPaletteOpen(false)}
          onSelectNote={(note) => { handleSelectNote(note); setCmdPaletteOpen(false); }}
          onSelectView={(v) => { setView(v); setMobilePanel('list'); setCmdPaletteOpen(false); }}
          onNewNote={() => { handleNewNote(); setCmdPaletteOpen(false); }}
        />
      )}

      {/* ── Overlay fantôme "fly to trash" ──────────────────────────────────── */}
      <FlyToTrash flyItem={flyItem} />

      <div
        className="flex h-screen overflow-hidden rounded-xl"
        onClick={() => {
          setShowMoveMenu(false); setShowSortMenu(false);
          setSuggestions([]); setShowNewFolderMenu(false);
          setAvatarPopover(false);
        }}
      >
        {/* ══ SIDEBAR ══════════════════════════════════════════════════════════ */}
        <div
          className={`
            ${mobilePanel === 'sidebar' ? 'flex' : 'hidden'} md:flex
            w-full md:w-14 lg:w-60 shrink-0 flex-col bg-gray-50 dark:bg-[#080c14] border-r border-gray-200 dark:border-dark-700 overflow-hidden
            transition-[width,min-width] duration-[280ms] ease-in-out
            ${!sidebarOpen ? '!w-0 !min-w-0' : ''}
          `}
        >
          {/* ── Workspace header — style Notion, une seule ligne ── */}
          <div className="relative border-b border-gray-200 dark:border-dark-700">
            <div className="flex items-center gap-1 px-2 py-3">

              {/* Bouton workspace — avatar + label + chevron ▾ */}
              <button
                ref={avatarBtnRef}
                type="button"
                onClick={e => { e.stopPropagation(); setAvatarPopover(o => !o); }}
                title="Espace de travail"
                className="flex-1 min-w-0 flex items-center gap-2 px-1.5 py-1 rounded-md hover:bg-gray-100 dark:hover:bg-[#111520] transition-colors text-left"
              >
                {session?.user?.image ? (
                  <img src={session.user.image} alt="Avatar" referrerPolicy="no-referrer"
                    className="w-5 h-5 rounded-full shrink-0 ring-1 ring-gray-300 dark:ring-dark-600" />
                ) : (
                  <div className="w-5 h-5 rounded-full bg-yellow-500/15 flex items-center justify-center shrink-0 ring-1 ring-yellow-500/30">
                    <span className="text-[9px] font-bold text-yellow-500 uppercase leading-none">
                      {(session?.user?.name ?? session?.user?.email ?? 'U').charAt(0)}
                    </span>
                  </div>
                )}
                <span className="flex-1 min-w-0 text-sm font-medium text-gray-800 dark:text-gray-100 truncate">
                  Espace de{' '}
                  <span className="font-semibold">
                    {session?.user?.name?.split(' ')[0] || session?.user?.email?.split('@')[0] || 'Utilisateur'}
                  </span>
                </span>
                <ChevronDown size={12} className="shrink-0 text-gray-400" />
              </button>

              {/* Action droite : collapse sidebar */}
              <div className="flex items-center gap-0.5 shrink-0">
                <button
                  type="button"
                  title="Masquer la barre latérale (Ctrl+\)"
                  onClick={toggleSidebar}
                  className="text-gray-400 hover:text-gray-700 dark:hover:text-white transition-colors p-1 rounded"
                >
                  <ChevronsLeft size={14} />
                </button>
              </div>

            </div>

            {/* Popover — s'ouvre vers le bas */}
            {avatarPopover && (
              <div
                className="absolute top-full left-2 right-2 mt-1 bg-white dark:bg-[#111520] border border-gray-200 dark:border-dark-600 rounded-xl shadow-2xl overflow-hidden z-50"
                onClick={e => e.stopPropagation()}
              >
                <div className="px-3 py-2.5 border-b border-gray-100 dark:border-dark-700">
                  <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">
                    {session?.user?.name || 'Utilisateur'}
                  </p>
                  <p className="text-[10px] text-gray-500 truncate">{session?.user?.email}</p>
                </div>
                <Link
                  href="/profile"
                  onClick={() => setAvatarPopover(false)}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111520] transition-colors"
                >
                  <Settings size={12} /> Paramètres
                </Link>
                <button
                  type="button"
                  onClick={() => { setAvatarPopover(false); handleSignOut(); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-red-500 dark:text-red-400 hover:bg-red-500/10 transition-colors"
                >
                  <LogOut size={12} /> Se déconnecter
                </button>
              </div>
            )}
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
            onCreateFolder={handleCreateRegularFolder}
            onCreateSmartFolder={() => { setEditingSmartId(null); setShowSmartModal(true); }}
          />

        </div>

        {/* Expand sidebar — bande visible uniquement quand sidebar fermée (desktop) */}
        {!sidebarOpen && (
          <button
            type="button"
            title="Afficher la barre latérale (Ctrl+\)"
            onClick={() => setSidebarOpen(true)}
            className="hidden md:flex shrink-0 flex-col items-center justify-start pt-3 w-5 bg-gray-50 dark:bg-[#080c14] border-r border-gray-200 dark:border-dark-700 text-gray-400 hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-[#111520] transition-colors"
          >
            <ChevronsRight size={12} />
          </button>
        )}

        {/* ══ NOTE LIST — composant extrait dans NoteListColumn.tsx ══════════ */}
        <NoteListColumn
          mobilePanel={mobilePanel}
          setMobilePanel={setMobilePanel}
          view={view}
          folders={folders}
          isTrash={isTrash}
          currentFolder={currentFolder ?? undefined}
          showSortMenu={showSortMenu}
          setShowSortMenu={setShowSortMenu}
          sortBy={sortBy}
          setSortBy={setSortBy}
          onNewNote={handleNewNote}
          deletedNotes={deletedNotes}
          search={search}
          setSearch={setSearch}
          searchRef={searchRef}
          filteredNotes={displayedNotes}
          hasPinnedSection={displayedHasPinned}
          pinnedNotes={displayedPinned}
          unpinnedNotes={displayedUnpinned}
          loading={loading || (!!search.trim() && isSearching)}
          selectedId={selectedId}
          onSelectNote={handleSelectNote}
          isCollapsed={!noteListOpen}
          onToggle={toggleNoteList}
          onExpandFromEditor={() => setNoteListOpen(true)}
        />

        {/* Expand note list — bande visible uniquement quand liste fermée (desktop) */}
        {!noteListOpen && (
          <button
            type="button"
            title="Afficher la liste (Ctrl+Shift+\)"
            onClick={() => setNoteListOpen(true)}
            className="hidden md:flex shrink-0 flex-col items-center justify-start pt-3 w-5 bg-gray-50 dark:bg-[#080c14] border-r border-gray-200 dark:border-dark-700 text-gray-400 hover:text-yellow-400 hover:bg-gray-100 dark:hover:bg-[#111520] transition-colors"
          >
            <ChevronsRight size={12} />
          </button>
        )}

        {/* ══ EDITOR — composant extrait dans NoteEditorColumn.tsx ══════════ */}
        <NoteEditorColumn
          mobilePanel={mobilePanel}
          setMobilePanel={setMobilePanel}
          focusMode={focusMode}
          setFocusMode={setFocusMode}
          selectedNote={selectedNote ?? undefined}
          isReadOnly={effectiveReadOnly}
          isTrash={isTrash}
          folders={folders}
          saveLabel={saveLabel}
          saveColor={saveColor}
          handleRecover={handleRecover}
          handlePermanentDelete={handlePermanentDelete}
          confirmDel={confirmDel}
          setConfirmDel={setConfirmDel}
          showMoveMenu={showMoveMenu}
          setShowMoveMenu={setShowMoveMenu}
          regularFolders={regularFolders}
          handleMove={handleMove}
          handleCreateRegularFolder={handleCreateRegularFolder}
          handlePin={handlePin}
          handleDelete={handleDelete}
          handleNewNote={handleNewNote}
          editor={editor}
          imageInputRef={imageInputRef}
          fileInputRef={fileInputRef}
          docxInputRef={docxInputRef}
          pdfInputRef={pdfInputRef}
          uploadProgress={uploadProgress}
          onExportMarkdown={handleExportMarkdown}
          onExportPDF={handleExportPDF}
          onCodeBlockClick={openCodeModal}
          setExcalidrawModal={setExcalidrawModal}
          onExportDocx={handleExportDocx}
          title={title}
          titleRef={titleRef}
          titleSuggs={titleSuggs}
          setTitleSuggs={setTitleSuggs}
          titleSuggIdx={titleSuggIdx}
          applyTitleSugg={applyTitleSugg}
          handleTitleSuggKey={handleTitleSuggKey}
          handleTitleChange={handleTitleChange}
          handleImageInsert={handleImageInsert}
          handleFileInsert={handleFileInsert}
          handleImportDocx={handleImportDocx}
          handleImportPdf={handleImportPdf}
          isInCodeBlock={isInCodeBlock}
          codeBlockLang={codeBlockLang}
          setCodeBlockLang={setCodeBlockLang}
          codeCopied={codeCopied}
          setCodeCopied={setCodeCopied}
          slashMenu={slashMenu}
          slashFilter={slashFilter}
          slashIdx={slashIdx}
          applySlashCommand={applySlashCommand}
          suggestions={suggestions}
          suggestionIdx={suggestionIdx}
          applySuggestion={applySuggestion}
          emptyReason={
            !selectedNote
              ? search.trim() && displayedNotes.length === 0
                ? 'no-results'
                : displayedNotes.length === 0
                  ? 'empty-view'
                  : 'no-selection'
              : undefined
          }
          searchQuery={search}
          bubbleLinkOpen={bubbleLinkOpen}
          setBubbleLinkOpen={setBubbleLinkOpen}
          bubbleLinkVal={bubbleLinkVal}
          setBubbleLinkVal={setBubbleLinkVal}
        />
      </div>
      {/* ── Modal bloc de code ──────────────────────────────────────────────── */}
      <CodeModal
        codeModal={codeModal}
        setCodeModal={setCodeModal}
        codeModalCopied={codeModalCopied}
        setCodeModalCopied={setCodeModalCopied}
        applyCodeModal={applyCodeModal}
        languages={LANGUAGES}
      />

      {/* ── Modal Excalidraw — plein écran ──────────────────────────────────── */}
      <ExcalidrawModal
        excalidrawModal={excalidrawModal}
        setExcalidrawModal={setExcalidrawModal}
        insertExcalidraw={insertExcalidraw}
        uploadProgress={uploadProgress}
        excalidrawApiRef={excalidrawApiRef}
        ExcalidrawComponent={ExcalidrawComponent}
      />
    </>
  );
}

// ── NoteCard → extrait dans components/notes/NoteCard.tsx ────────────────────
// Importé en haut du fichier : import NoteCard from '@/components/notes/NoteCard';
