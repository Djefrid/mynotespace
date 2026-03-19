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
  useState, useEffect, useRef,
} from 'react';
import {
  FolderPlus, ChevronRight, Zap,
  LogOut, User as UserIcon,
} from 'lucide-react';
import { useAuth } from '@/lib/firebase/hooks';
import type { Editor } from '@tiptap/core';
import { useAdminNotes } from '@/hooks/useAdminNotes';
import {
  silentlyDeleteNote,
  Note,
} from '@/lib/notes-service';
// Fonctions pures extraites vers lib/notes-utils.ts pour être testables indépendamment
import {
  stripHtml,
} from '@/lib/notes-utils';
// Types, constantes et helpers partagés entre sous-composants de l'éditeur
import {
  ViewFilter, SortBy, SaveStatus, MobilePanel, LANGUAGES,
} from '@/lib/notes-types';
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

// ── Types, constantes et helpers — importés depuis lib/notes-types.ts ────────
// ViewFilter, SortBy, SaveStatus, MobilePanel, viewEq, viewLabel,
// AUTOSAVE_DELAY_MS, SLASH_CMDS, LANGUAGES → voir @/lib/notes-types


// ── Main Component ───────────────────────────────────────────────────────────

export default function NotesEditor() {
  const { notes, deletedNotes, folders, manualTags, loading } = useAdminNotes();
  // ── Authentification — pour le profil utilisateur + déconnexion ───────────
  const { user, signOut } = useAuth();

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
  const prevContent    = useRef('');
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
  } = useNoteSelection({ notes, deletedNotes, folders, currentFolder, setView });

  // ── Autosave + Background Sync ──────────────────────────────────────────────
  const {
    saveStatus, setSaveStatus,
    lastSaved,  setLastSaved,
    saveTimer,
    scheduleAutoSave, saveImmediately, registerBackgroundSync,
    saveLabel, saveColor,
  } = useAutosave({ selectedId, isReadOnly, prevTitle, prevContent });

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
    isReadOnly,
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

  // ── Ctrl+S (sauvegarde immédiate) + Ctrl+N (nouvelle note) ───────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === 's') {
        e.preventDefault();
        if (!selectedId || isReadOnly) return;
        saveImmediately(title, content);
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

  // ── Ctrl+F / Cmd+F → focus barre de recherche ───────────────────────────────
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

      {/* ── Overlay fantôme "fly to trash" ──────────────────────────────────── */}
      <FlyToTrash flyItem={flyItem} />

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
          filteredNotes={filteredNotes}
          hasPinnedSection={hasPinnedSection}
          pinnedNotes={pinnedNotes}
          unpinnedNotes={unpinnedNotes}
          selectedId={selectedId}
          onSelectNote={handleSelectNote}
          loading={loading}
        />

        {/* ══ EDITOR — composant extrait dans NoteEditorColumn.tsx ══════════ */}
        <NoteEditorColumn
          mobilePanel={mobilePanel}
          setMobilePanel={setMobilePanel}
          focusMode={focusMode}
          setFocusMode={setFocusMode}
          selectedNote={selectedNote ?? undefined}
          isReadOnly={isReadOnly}
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
