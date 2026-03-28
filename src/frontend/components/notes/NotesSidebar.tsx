/**
 * ============================================================================
 * NOTES SIDEBAR — components/notes/NotesSidebar.tsx
 * ============================================================================
 *
 * Panneau de navigation gauche de l'éditeur de notes.
 * Affiche les vues intelligentes, l'arbre de dossiers, les dossiers
 * intelligents, les tags et la corbeille.
 *
 * ── Sections ───────────────────────────────────────────────────────────────
 *   Smart views    : Toutes / Épinglées / Toutes mes notes (inbox)
 *   Dossiers       : Arbre récursif via FolderTreeItem
 *   Intelligents   : Liste plate des dossiers à filtres automatiques
 *   Tags           : Avec compteurs + bouton création inline
 *   Corbeille      : Toujours visible en bas avec animation shake
 *
 * ── Barre de recherche ─────────────────────────────────────────────────────
 *   Filtre dossiers et tags en "liste plate" style VS Code / Notion.
 *   Quand la recherche est active, les sections normales sont remplacées
 *   par une liste plate de résultats (dossiers + tags correspondants).
 *
 * ── Autocomplétion des tags ────────────────────────────────────────────────
 *   Lors de la création d'un tag inline, une popup de suggestions
 *   s'affiche (fuzzy match sur les tags existants).
 *   Navigation : ↑↓ · Tab (accepte) · Enter (accepte si sélectionné) · Escape
 *
 * ── Accessibilité ──────────────────────────────────────────────────────────
 *   - role="button" + tabIndex + onKeyDown sur les divs interactifs
 *   - aria-label sur les inputs et boutons d'action
 *   - motion.button pour la corbeille avec animation shake framer-motion
 * ============================================================================
 */

"use client";

import { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import { motion } from 'framer-motion';
import {
  Plus, Pin, Trash2, Search, StickyNote, FolderOpen,
  Hash, MoreHorizontal, Folder, Zap, X, FolderPlus,
} from 'lucide-react';
import { updateFolder, deleteFolder, createTag } from '@/src/frontend/services/notes-mutations-api';
import type { Note, Folder as FolderType } from '@/lib/notes-service';
import { viewEq, viewLabel } from '@/lib/notes-types';
import ConfirmModal from '@/src/frontend/components/common/ConfirmModal';
import type { ViewFilter } from '@/lib/notes-types';
import { buildFolderTree } from '@/lib/notes-utils';
import FolderTreeItem from '@/components/notes/FolderTreeItem';

// ── Props du composant ────────────────────────────────────────────────────────

interface NotesSidebarProps {
  /** Notes actives (hors corbeille) */
  notes:              Note[];
  /** Notes dans la corbeille */
  deletedNotes:       Note[];
  /** Tous les dossiers (normaux + intelligents) */
  folders:            FolderType[];
  /** Tags créés manuellement (hors tags extraits des notes) */
  manualTags:         string[];
  /** Vue active */
  view:               ViewFilter;
  /** Callback de sélection d'une vue */
  onSelectView:       (v: ViewFilter) => void;
  /** ID du dossier en attente de renommage après création (null = aucun) */
  newFolderPendingId: string | null;
  /** Appelé quand le renommage pending a été traité */
  onFolderCreated:    () => void;
  /** Ouvre la modal d'édition des filtres d'un dossier intelligent */
  onEditSmartFolder:  (id: string) => void;
  /** Crée un tag manuel */
  onCreateTag:        (name: string) => void;
  /** Supprime un tag manuel */
  onDeleteTag:        (name: string) => void;
  /** Ref vers le bouton corbeille (pour l'animation "fly to trash") */
  trashBtnRef:        React.RefObject<HTMLButtonElement>;
  /** Déclenche l'animation shake sur le bouton corbeille */
  trashShake:         boolean;
  /** Crée un sous-dossier sous le dossier donné */
  onCreateSubfolder:    (parentId: string) => void;
  /** Crée un dossier normal */
  onCreateFolder:       () => void;
  /** Ouvre la modal de création de dossier intelligent */
  onCreateSmartFolder:  () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function NotesSidebar({
  notes, deletedNotes, folders, manualTags, view, onSelectView,
  newFolderPendingId, onFolderCreated, onEditSmartFolder,
  onCreateTag, onDeleteTag, trashBtnRef, trashShake, onCreateSubfolder,
  onCreateFolder, onCreateSmartFolder,
}: NotesSidebarProps) {
  // ── État local ─────────────────────────────────────────────────────────────
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
  /** ID du dossier dont la suppression est en attente de confirmation */
  const [confirmDeleteFolderId, setConfirmDeleteFolderId] = useState<string | null>(null);
  /** Nom du tag dont la suppression est en attente de confirmation */
  const [confirmDeleteTag,      setConfirmDeleteTag]      = useState<string | null>(null);
  /** Dropdown "Nouveau dossier / intelligent" dans le header de section */
  const [showFolderMenu, setShowFolderMenu] = useState(false);

  /** Bascule l'état expansé/réduit d'un dossier (mémoïsé pour éviter re-renders) */
  const toggleExpand = useCallback((id: string) => {
    setExpandedIds(prev => ({ ...prev, [id]: !(prev[id] ?? true) }));
  }, []);

  /** Arbre de dossiers normaux (non-intelligents) pour rendu récursif */
  const folderTree   = useMemo(() => buildFolderTree(folders), [folders]);
  /** Liste plate des dossiers intelligents */
  const smartFolders = useMemo(() => folders.filter(f => f.isSmart), [folders]);

  /**
   * Déclenche l'édition inline du dossier nouvellement créé.
   * Quand newFolderPendingId est non-null et que le dossier existe dans Firestore,
   * on ouvre l'input de renommage automatiquement.
   */
  useEffect(() => {
    if (newFolderPendingId && folders.find(f => f.id === newFolderPendingId)) {
      setEditingId(newFolderPendingId);
      setEditingName(folders.find(f => f.id === newFolderPendingId)!.name);
      onFolderCreated();
    }
  }, [newFolderPendingId, folders, onFolderCreated]);

  /** Compteurs de notes par vue (all, inbox, pinned, byFolder, byTag) */
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

  /**
   * Union des tags manuels et tags extraits des notes, triés par count desc puis alpha.
   * Permet d'afficher tous les tags utilisables même si non encore présents dans notes.
   */
  const allDisplayTags = useMemo(() => {
    const all = new Set([...manualTags, ...Object.keys(counts.byTag)]);
    return Array.from(all).sort((a, b) => {
      const ca = counts.byTag[a] ?? 0;
      const cb = counts.byTag[b] ?? 0;
      if (cb !== ca) return cb - ca;
      return a.localeCompare(b, 'fr');
    });
  }, [manualTags, counts.byTag]);

  /** Classes CSS d'une ligne de navigation selon l'état actif */
  const row = (v: ViewFilter) =>
    `w-full flex items-center justify-between px-2 py-2 rounded-lg text-sm transition-all ${
      viewEq(view, v)
        ? 'ring-1 ring-primary-500/70 text-gray-900 dark:text-white font-medium'
        : 'font-medium text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/5 dark:hover:bg-dark-650'
    }`;

  /** Valide le renommage d'un dossier et met à jour Firestore */
  const commitRename = async (id: string) => {
    if (editingName.trim()) await updateFolder(id, { name: editingName.trim() });
    setEditingId(null);
  };

  /** Demande confirmation puis supprime le dossier */
  const handleDeleteFolder = (id: string) => {
    setConfirmDeleteFolderId(id);
    setMenuId(null);
  };

  const confirmDeleteFolder = async () => {
    if (!confirmDeleteFolderId) return;
    await deleteFolder(confirmDeleteFolderId);
    if (viewEq(view, { type: 'folder', id: confirmDeleteFolderId })) onSelectView('inbox');
    setConfirmDeleteFolderId(null);
  };

  /**
   * Met à jour l'input de création de tag et calcule les suggestions fuzzy.
   * Quand l'input est vide, affiche les 5 premiers tags existants.
   */
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

  /** Applique une suggestion de tag et ferme l'input */
  const applyTagInputSugg = (tag: string) => {
    onCreateTag(tag);
    setNewTagInput(''); setShowNewTag(false); setTagInputSuggs([]); setTagInputSuggIdx(-1);
  };

  /** Valide la création du tag avec la valeur courante de l'input */
  const commitNewTag = () => {
    const v = newTagInput.trim();
    if (v) onCreateTag(v);
    setNewTagInput(''); setShowNewTag(false); setTagInputSuggs([]); setTagInputSuggIdx(-1);
  };

  /**
   * Gestion clavier de l'input de création de tag.
   * ↑↓ : navigation dans les suggestions
   * Tab : accepte la première suggestion (ou la sélectionnée)
   * Enter : accepte la suggestion sélectionnée ou valide l'input
   * Escape : ferme l'input sans créer
   */
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
    <nav
      aria-label="Navigation des notes"
      className="flex flex-col h-full overflow-y-auto select-none"
      onClick={() => setMenuId(null)}
    >
      {/* ── Barre de recherche dossiers/tags — en tête de sidebar, pattern Notion/Linear ── */}
      <div className="block md:hidden lg:block px-2 pt-3 pb-2 relative">
        <Search size={12} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 pointer-events-none" />
        <input
          name="sidebar-search"
          type="text"
          aria-label="Rechercher un dossier ou tag"
          placeholder="Dossiers, tags…"
          value={folderSearch}
          onChange={e => setFolderSearch(e.target.value)}
          onKeyDown={e => { if (e.key === 'Escape') setFolderSearch(''); }}
          className="w-full pl-6 pr-6 py-1 bg-gray-100 dark:bg-dark-725 border border-gray-200 dark:border-dark-600 rounded-lg text-[11px] text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-primary-500/50"
        />
        {folderSearch && (
          <button
            type="button"
            onClick={() => setFolderSearch('')}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-900 dark:hover:text-white"
            aria-label="Effacer la recherche"
          >
            <X size={12} />
          </button>
        )}
      </div>

      {/* ── Smart views ─────────────────────────────────────────────────────── */}
      <div className="px-2 pt-1 pb-2 space-y-0.5">
        {folders.length > 0 && (
          <button type="button" className={row('all')} onClick={() => onSelectView('all')}>
            <span className="flex items-center gap-2"><StickyNote size={14} /><span className="inline md:hidden lg:inline">Toutes</span></span>
            <span className="text-[11px] opacity-40 inline md:hidden lg:inline">{counts.all}</span>
          </button>
        )}
        {counts.pinned > 0 && (
          <button type="button" className={row('pinned')} onClick={() => onSelectView('pinned')}>
            <span className="flex items-center gap-2"><Pin size={14} /><span className="inline md:hidden lg:inline">Épinglées</span></span>
            <span className="text-[11px] opacity-40 inline md:hidden lg:inline">{counts.pinned}</span>
          </button>
        )}
        <button type="button" className={row('inbox')} onClick={() => onSelectView('inbox')}>
          <span className="flex items-center gap-2"><Folder size={14} /><span className="inline md:hidden lg:inline">Toutes mes notes</span></span>
          <span className="text-[11px] opacity-40 inline md:hidden lg:inline">{counts.inbox}</span>
        </button>
      </div>

      <div className="mx-2 border-t border-gray-200 dark:border-dark-600" />

      {/* ── Mode recherche : liste plate OU sections normales (dossiers + tags) */}
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
                  <FolderOpen size={14} className="shrink-0" />
                  <span className="truncate">{f.name}</span>
                </span>
                <span className="text-[11px] opacity-40 shrink-0">{counts.byFolder[f.id] ?? 0}</span>
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
                  <Zap size={12} className="text-primary-400 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
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
                <span className="text-[11px] opacity-40 shrink-0">{counts.byTag[tag] ?? 0}</span>
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
          {/* ── Dossiers normaux — arbre récursif ───────────────────────────── */}
          {folderTree.length > 0 && (
            <div className="pt-3 pb-2">
              <div className="px-3 mb-1 flex items-center justify-between group/section">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400/55 dark:text-gray-500/70 inline md:hidden lg:inline">Dossiers</span>

                {/* Bouton hover-reveal — pattern Notion/Linear */}
                <div className="relative block md:hidden lg:block">
                  <button
                    type="button"
                    title="Nouveau dossier"
                    onClick={e => { e.stopPropagation(); setShowFolderMenu(m => !m); }}
                    className="flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity text-gray-400 hover:text-primary-400 px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-dark-650"
                  >
                    <FolderPlus size={12} />
                    <span className="text-[10px]">Nouveau</span>
                  </button>

                  {showFolderMenu && (
                    <div
                      className="absolute right-0 top-full z-50 mt-1 bg-white dark:bg-dark-650 border border-gray-200 dark:border-dark-600 rounded-lg shadow-2xl overflow-hidden w-48"
                      onClick={e => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => { onCreateFolder(); setShowFolderMenu(false); }}
                        className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-650 flex items-center gap-2"
                      >
                        <FolderPlus size={12} /> Dossier normal
                      </button>
                      <button
                        type="button"
                        onClick={() => { onCreateSmartFolder(); setShowFolderMenu(false); }}
                        className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-650 flex items-center gap-2"
                      >
                        <Zap size={12} className="text-primary-400" /> Dossier intelligent
                      </button>
                    </div>
                  )}
                </div>
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

          {/* ── Dossiers intelligents — liste plate ─────────────────────────── */}
          {smartFolders.length > 0 && (
            <div className="pt-3 pb-2">
              <div className="px-3 mb-1">
                <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400/55 dark:text-gray-500/70 inline md:hidden lg:inline">Intelligents</span>
              </div>

              <div className="space-y-0.5 px-2">
                {smartFolders.map(f => (
                  <div key={f.id} className="relative group">
                    {editingId === f.id ? (
                      /* Mode édition inline pour dossiers intelligents */
                      <input
                        name="smart-folder-name"
                        aria-label="Nom du dossier"
                        autoFocus
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onBlur={() => commitRename(f.id)}
                        onKeyDown={e => {
                          if (e.key === 'Enter')  commitRename(f.id);
                          if (e.key === 'Escape') setEditingId(null);
                        }}
                        className="w-full px-2 py-1.5 text-sm bg-gray-200 dark:bg-dark-725 border border-primary-500/50 rounded-lg text-gray-900 dark:text-white focus:outline-none"
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
                          <Zap size={12} className="text-primary-400 shrink-0 opacity-70 group-hover:opacity-100 transition-opacity" />
                          <span className="truncate inline md:hidden lg:inline">{f.name}</span>
                        </span>
                        <span className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            title="Options du dossier"
                            onClick={e => { e.stopPropagation(); setMenuId(menuId === f.id ? null : f.id); }}
                            className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-300 dark:hover:bg-dark-650 transition-opacity"
                          >
                            <MoreHorizontal size={12} />
                          </button>
                        </span>
                      </div>
                    )}
                    {/* Menu contextuel du dossier intelligent */}
                    {menuId === f.id && (
                      <div
                        className="absolute right-0 top-full z-50 mt-1 bg-gray-100 dark:bg-dark-650 border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl overflow-hidden w-44"
                        onClick={e => e.stopPropagation()}
                      >
                        <button
                          type="button"
                          onClick={() => { onEditSmartFolder(f.id); setMenuId(null); }}
                          className="w-full px-3 py-2 text-sm text-left text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-650 flex items-center gap-2"
                        >
                          <Zap size={12} className="text-primary-400" /> Modifier les filtres
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteFolder(f.id)}
                          className="w-full px-3 py-2 text-sm text-left text-red-400 hover:bg-gray-200 dark:hover:bg-dark-650"
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

      <div className="mx-2 border-t border-gray-200 dark:border-dark-600" />

          {/* ── Tags — toujours visible avec bouton "+" pour créer ───────────── */}
          <div className="px-2 pt-3 pb-3">
            <div className="px-1 mb-1 flex items-center justify-between group/section">
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-400/55 dark:text-gray-500/70 inline md:hidden lg:inline">Tags</span>
              <button
                type="button"
                title="Nouveau tag"
                onClick={e => { e.stopPropagation(); setShowNewTag(true); }}
                className="flex md:hidden lg:flex items-center gap-1 opacity-0 group-hover/section:opacity-100 transition-opacity text-gray-400 hover:text-primary-400 px-1 py-0.5 rounded hover:bg-gray-100 dark:hover:bg-dark-650"
              >
                <Plus size={12} />
                <span className="text-[10px]">Nouveau</span>
              </button>
            </div>

            {/* Champ de création inline + suggestions */}
            {showNewTag && (
              <div className="mb-1 relative">
                <input
                  name="new-tag"
                  aria-label="Nouveau tag"
                  type="text"
                  autoFocus
                  placeholder="mon-tag"
                  value={newTagInput}
                  onChange={e => handleTagInputChange(e.target.value)}
                  onKeyDown={handleTagInputKeyDown}
                  onBlur={() => setTimeout(commitNewTag, 150)}
                  onFocus={() => handleTagInputChange(newTagInput)}
                  maxLength={50}
                  className="w-full px-2 py-1 text-xs bg-gray-200 dark:bg-dark-725 border border-primary-500/50 rounded text-gray-900 dark:text-white focus:outline-none placeholder-gray-500 dark:placeholder-gray-600"
                />
                {tagInputSuggs.length > 0 && (
                  <div className="absolute left-0 top-full z-50 w-full mt-0.5 bg-gray-100 dark:bg-dark-650 border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl overflow-hidden">
                    {tagInputSuggs.map((t, i) => (
                      <button key={t} type="button"
                        onMouseDown={e => { e.preventDefault(); applyTagInputSugg(t); }}
                        className={`w-full px-2 py-1 text-xs text-left flex items-center gap-1.5 transition-colors ${
                          i === tagInputSuggIdx ? 'ring-1 ring-primary-500/60 text-primary-300' : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-dark-650'
                        }`}
                      ><Hash size={12} />#{t}</button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Message état vide */}
            {allDisplayTags.length === 0 && !showNewTag && (
              <p className="text-[11px] text-gray-600 px-1 py-1">
                Aucun tag — utilise #tag dans tes notes ou crée-en un avec +
              </p>
            )}

            {/* Liste des tags avec compteurs et bouton de suppression */}
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
                      <Hash size={14} /><span className="truncate inline md:hidden lg:inline">{tag}</span>
                    </span>
                    <span className="flex items-center gap-1 shrink-0">
                      <span className="text-[11px] opacity-40 inline md:hidden lg:inline">{counts.byTag[tag] ?? 0}</span>
                      {/* Bouton supprimer uniquement sur les tags manuels */}
                      {manualTags.includes(tag) && (
                        <button
                          type="button"
                          title="Supprimer le tag"
                          onClick={e => { e.stopPropagation(); setConfirmDeleteTag(tag); }}
                          className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:text-red-400 transition-opacity"
                        >
                          <X size={12} />
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

      {/* ── Modales de confirmation ─────────────────────────────────────────── */}
      {confirmDeleteFolderId && (
        <ConfirmModal
          title="Supprimer le dossier ?"
          message="Le dossier sera supprimé définitivement. Les notes qu'il contient seront déplacées dans l'inbox."
          confirmLabel="Supprimer"
          onConfirm={confirmDeleteFolder}
          onCancel={() => setConfirmDeleteFolderId(null)}
        />
      )}
      {confirmDeleteTag && (
        <ConfirmModal
          title="Supprimer le tag ?"
          message={`Le tag « ${confirmDeleteTag} » sera supprimé de la liste. Les notes taggées ne seront pas modifiées.`}
          confirmLabel="Supprimer"
          onConfirm={() => { onDeleteTag(confirmDeleteTag); setConfirmDeleteTag(null); }}
          onCancel={() => setConfirmDeleteTag(null)}
        />
      )}

      {/* ── Corbeille — toujours visible en bas ─────────────────────────────── */}
      <div className="mx-2 border-t border-gray-200 dark:border-dark-600 mt-auto" />
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
          <span className="flex items-center gap-2"><Trash2 size={14} /><span className="inline md:hidden lg:inline">Corbeille</span></span>
          {deletedNotes.length > 0 && (
            <span className="text-[11px] opacity-40 inline md:hidden lg:inline">{deletedNotes.length}</span>
          )}
        </motion.button>
      </div>
    </nav>
  );
}
