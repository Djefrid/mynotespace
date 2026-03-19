/**
 * ============================================================================
 * HOOK SÉLECTION DE NOTE — hooks/notes/useNoteSelection.ts
 * ============================================================================
 *
 * Gère la sélection de note et toutes les opérations CRUD.
 *
 * Ce hook ne dépend PAS de l'éditeur TipTap pour éviter une dépendance
 * circulaire (useNoteEditor a besoin de setContent de useNoteSelection).
 * Les appels editor.commands.setContent sont effectués dans NotesEditor
 * via des fonctions wrapper, après que les deux hooks sont instanciés.
 *
 * Effets "bridge" qui restent dans NotesEditor :
 *   - Nettoyage notes vides (utilise prevTitle, prevContent, saveTimer)
 *   - Sync multi-appareil (utilise editor + saveStatus + notes)
 *   - Restauration localStorage (utilise editor + loading + notes)
 *
 * Contenu :
 *   - États : selectedId, title, content, mobilePanel, confirmDel, etc.
 *   - États UI : trashShake, focusMode, flyItem (animation fly-to-trash)
 *   - États panels : dossiers, smart folders
 *   - Dérivés : selectedNote, isReadOnly
 *   - Persistance localStorage selectedId
 *   - Handlers CRUD : note, dossier, tag
 * ============================================================================
 */

import { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import type { Note, Folder as FolderType, SmartFolderFilter } from '@/lib/notes-service';
import {
  createNote, updateNote, deleteNote, moveNote,
  permanentlyDeleteNote, recoverNote,
  createFolder, createSmartFolder, updateSmartFolderFilters,
  createTag, deleteTag,
} from '@/lib/notes-service';
import type { ViewFilter, MobilePanel } from '@/lib/notes-types';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNoteSelection({
  notes,
  deletedNotes,
  folders,
  currentFolder,
  setView,
}: {
  /** Notes actives (onSnapshot Firestore) */
  notes:         Note[];
  /** Notes en corbeille (onSnapshot Firestore) */
  deletedNotes:  Note[];
  /** Tous les dossiers (normaux + intelligents) */
  folders:       FolderType[];
  /** Dossier actuellement actif (de useNoteFilters) — null si inbox ou tag */
  currentFolder: FolderType | null;
  /** Setter vue (de useNoteFilters) — pour handleRecover → 'inbox' */
  setView:       (v: ViewFilter) => void;
}) {

  // ── État principal de sélection ─────────────────────────────────────────────
  /** ID de la note actuellement ouverte dans l'éditeur */
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  /** Panneau visible sur mobile (une seule colonne à la fois) */
  const [mobilePanel,  setMobilePanel]  = useState<MobilePanel>('list');
  /** Titre courant de la note ouverte */
  const [title,        setTitle]        = useState('');
  /** Contenu HTML courant de la note ouverte */
  const [content,      setContent]      = useState('');

  // ── État actions en cours ───────────────────────────────────────────────────
  /** true = demande confirmation avant suppression */
  const [confirmDel,   setConfirmDel]   = useState(false);
  /** true = menu de déplacement ouvert */
  const [showMoveMenu, setShowMoveMenu] = useState(false);
  /** true = menu de tri ouvert */
  const [showSortMenu, setShowSortMenu] = useState(false);

  // ── État UI et animations ───────────────────────────────────────────────────
  /** true = le bouton corbeille tremble (animation fly-to-trash) */
  const [trashShake,   setTrashShake]   = useState(false);
  /** true = mode focus plein écran (masque sidebar + liste) */
  const [focusMode,    setFocusMode]    = useState(false);
  /** Données de l'animation "carte qui vole vers la corbeille" */
  const [flyItem, setFlyItem] = useState<{
    x: number; y: number; w: number; h: number;
    tx: number; ty: number; label: string;
  } | null>(null);

  // ── État bubble link + code ──────────────────────────────────────────────────
  /** true = popup de lien (BubbleMenu) ouvert */
  const [bubbleLinkOpen, setBubbleLinkOpen] = useState(false);
  /** Valeur courante du champ URL dans le BubbleMenu */
  const [bubbleLinkVal,  setBubbleLinkVal]  = useState('');
  /** true = code copié (feedback visuel ~1.5s) */
  const [codeCopied,     setCodeCopied]     = useState(false);

  // ── État panels dossiers ────────────────────────────────────────────────────
  /** ID du dossier en attente de renommage (juste créé) */
  const [newFolderPendingId, setNewFolderPendingId] = useState<string | null>(null);
  /** true = menu "Nouveau dossier / Intelligent" ouvert */
  const [showNewFolderMenu,  setShowNewFolderMenu]  = useState(false);
  /** true = modal SmartFolder ouvert */
  const [showSmartModal,     setShowSmartModal]     = useState(false);
  /** ID du smart folder en cours d'édition */
  const [editingSmartId,     setEditingSmartId]     = useState<string | null>(null);

  // ── Refs ────────────────────────────────────────────────────────────────────
  /** Ref vers l'<input> du titre — focus auto après création de note */
  const titleRef    = useRef<HTMLInputElement>(null);
  /** Ref vers le bouton Corbeille — cible de l'animation fly-to-trash */
  const trashBtnRef = useRef<HTMLButtonElement>(null);

  // ── Dérivés ─────────────────────────────────────────────────────────────────

  /** Note actuellement ouverte (cherche dans notes actives ET corbeille) */
  const selectedNote = notes.find(n => n.id === selectedId)
    ?? deletedNotes.find(n => n.id === selectedId)
    ?? null;

  /** true si la note est dans la corbeille — bloque toute modification */
  const isReadOnly = selectedNote ? !!selectedNote.deletedAt : false;

  /** Données initiales du modal SmartFolder en mode édition */
  const smartModalInitial = useMemo(() => {
    if (!editingSmartId) return undefined;
    const f = folders.find(x => x.id === editingSmartId);
    if (!f?.isSmart) return undefined;
    return { name: f.name, filters: f.filters ?? {} };
  }, [editingSmartId, folders]);

  // ── Persistance localStorage — selectedId ──────────────────────────────────
  /** Sauvegarde l'ID sélectionné pour restauration au rechargement suivant */
  useEffect(() => {
    try {
      if (selectedId) localStorage.setItem('notes_selectedId', selectedId);
      else            localStorage.removeItem('notes_selectedId');
    } catch { /* ignore — localStorage peut être bloqué */ }
  }, [selectedId]);

  // ── Animation fly-to-trash ──────────────────────────────────────────────────
  /**
   * Lance l'animation "carte qui vole vers la corbeille".
   * Position calculée via getBoundingClientRect à l'appel.
   */
  const triggerFlyToTrash = useCallback((noteId: string, label: string) => {
    const cardEl  = document.querySelector(`[data-note-id="${noteId}"]`);
    const trashEl = trashBtnRef.current;
    if (!cardEl || !trashEl) return;
    const from = cardEl.getBoundingClientRect();
    const to   = trashEl.getBoundingClientRect();
    setFlyItem({
      x:  from.left, y: from.top, w: from.width, h: from.height,
      tx: to.left + to.width  / 2 - from.width  / 4,
      ty: to.top  + to.height / 2 - from.height / 4,
      label,
    });
    // Tremblement du bouton ~350ms après le départ de l'animation
    setTimeout(() => {
      setTrashShake(true);
      setTimeout(() => { setTrashShake(false); setFlyItem(null); }, 460);
    }, 340);
  }, []);

  // ── Handlers de sélection ───────────────────────────────────────────────────

  /**
   * Sélectionne une note — charge son contenu dans l'état React.
   * Note : l'appel editor.commands.setContent est effectué dans NotesEditor
   *        (wrapper) pour éviter la dépendance circulaire avec useNoteEditor.
   */
  const handleSelectNote = (note: Note) => {
    setSelectedId(note.id);
    setTitle(note.title);
    setContent(note.content);
    setMobilePanel('editor');
  };

  /**
   * Crée une nouvelle note — initialise l'état React.
   * Note : l'appel editor.commands.setContent('') est effectué dans NotesEditor.
   */
  const handleNewNote = async () => {
    const folderId = (currentFolder && !currentFolder.isSmart) ? currentFolder.id : null;
    const id       = await createNote(folderId);
    setSelectedId(id);
    setTitle('');
    setContent('');
    setMobilePanel('editor');
    // Focus auto sur le champ titre après création (attendre le render DOM)
    setTimeout(() => titleRef.current?.focus(), 80);
  };

  // ── Handlers CRUD notes ─────────────────────────────────────────────────────

  /** Bascule l'état épinglé de la note */
  const handlePin = async () => {
    if (!selectedNote || isReadOnly) return;
    await updateNote(selectedNote.id, { pinned: !selectedNote.pinned });
  };

  /**
   * Suppression douce avec double-confirmation.
   * 1er clic → setConfirmDel(true) → l'UI affiche "Confirmer ?"
   * 2e clic → deleteNote + animation fly-to-trash
   */
  const handleDelete = async () => {
    if (!selectedId) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    triggerFlyToTrash(selectedId, title || 'Sans titre');
    await deleteNote(selectedId);
    setSelectedId(null); setTitle(''); setContent('');
    setMobilePanel('list'); setConfirmDel(false);
  };

  /** Restaure une note depuis la corbeille → inbox */
  const handleRecover = async () => {
    if (!selectedId) return;
    await recoverNote(selectedId);
    setSelectedId(null); setTitle(''); setContent('');
    setView('inbox'); setMobilePanel('list');
  };

  /** Suppression définitive avec double-confirmation */
  const handlePermanentDelete = async () => {
    if (!selectedId) return;
    if (!confirmDel) { setConfirmDel(true); return; }
    await permanentlyDeleteNote(selectedId);
    setSelectedId(null); setTitle(''); setContent('');
    setMobilePanel('list'); setConfirmDel(false);
  };

  /** Déplace la note dans le dossier spécifié (null = inbox) */
  const handleMove = async (folderId: string | null) => {
    if (!selectedId) return;
    await moveNote(selectedId, folderId);
    setShowMoveMenu(false);
  };

  // ── Handlers dossiers ───────────────────────────────────────────────────────

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

  const handleEditSmartFolder = (id: string) => {
    setEditingSmartId(id); setShowSmartModal(true);
  };

  // ── Handlers tags ────────────────────────────────────────────────────────────

  const handleCreateTag = async (name: string) => { await createTag(name); };
  const handleDeleteTag = async (name: string) => { await deleteTag(name); };

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    // ── État ──────────────────────────────────────────────────────────────────
    selectedId,  setSelectedId,
    mobilePanel, setMobilePanel,
    title,       setTitle,
    content,     setContent,
    confirmDel,   setConfirmDel,
    showMoveMenu, setShowMoveMenu,
    showSortMenu, setShowSortMenu,
    trashShake,
    focusMode,    setFocusMode,
    flyItem,      setFlyItem,
    bubbleLinkOpen, setBubbleLinkOpen,
    bubbleLinkVal,  setBubbleLinkVal,
    codeCopied,     setCodeCopied,
    newFolderPendingId, setNewFolderPendingId,
    showNewFolderMenu,  setShowNewFolderMenu,
    showSmartModal,     setShowSmartModal,
    editingSmartId,     setEditingSmartId,
    smartModalInitial,
    // ── Refs ──────────────────────────────────────────────────────────────────
    titleRef,
    trashBtnRef,
    // ── Dérivés ───────────────────────────────────────────────────────────────
    selectedNote,
    isReadOnly,
    // ── Callbacks ─────────────────────────────────────────────────────────────
    triggerFlyToTrash,
    handleSelectNote,
    handleNewNote,
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
  };
}
