/**
 * ============================================================================
 * FOLDER TREE ITEM — components/notes/FolderTreeItem.tsx
 * ============================================================================
 *
 * Item récursif de l'arbre de dossiers dans la sidebar des notes.
 * Supporte les dossiers imbriqués (depth-first), l'édition inline du nom,
 * un menu contextuel (renommer, sous-dossier, supprimer) et l'expansion.
 *
 * Fonctionnalités :
 *   - Indentation visuelle proportionnelle à la profondeur (depth)
 *   - Bouton chevron d'expansion/réduction des enfants
 *   - Affichage du nombre de notes dans le dossier
 *   - Menu contextuel (3 actions) affiché au survol via MoreHorizontal
 *   - Édition inline du nom (input autoFocus, commit sur Enter/blur)
 *   - Récursion : chaque nœud rend ses enfants via FolderTreeItem
 *   - div role="button" au lieu de <button> imbriqué (HTML valide)
 *   - Navigation clavier : Enter / Space pour sélectionner le dossier
 * ============================================================================
 */

"use client";

import {
  FolderOpen, FolderPlus, ChevronRight, MoreHorizontal,
} from 'lucide-react';
import { viewEq } from '@/lib/notes-types';
import type { ViewFilter } from '@/lib/notes-types';
import type { FolderNode } from '@/lib/notes-utils';

// ── Props du composant ────────────────────────────────────────────────────────

interface FolderTreeItemProps {
  /** Nœud courant de l'arbre (contient id, name, children) */
  node:              FolderNode;
  /** Profondeur dans l'arbre — contrôle le padding gauche */
  depth:             number;
  /** Vue active dans la sidebar */
  view:              ViewFilter;
  /** Callback de sélection d'une vue */
  onSelectView:      (v: ViewFilter) => void;
  /** ID du dossier en cours d'édition (null = aucun) */
  editingId:         string | null;
  /** Nom en cours d'édition dans l'input inline */
  editingName:       string;
  /** Setter de l'id en cours d'édition */
  setEditingId:      (id: string | null) => void;
  /** Setter du nom en cours d'édition */
  setEditingName:    (name: string) => void;
  /** Valide le renommage et appelle updateFolder */
  commitRename:      (id: string) => void;
  /** ID du dossier dont le menu est ouvert (null = aucun) */
  menuId:            string | null;
  /** Setter de l'id du menu ouvert */
  setMenuId:         (id: string | null) => void;
  /** Compteurs de notes par dossier */
  counts:            { byFolder: Record<string, number> };
  /** Callback de suppression d'un dossier */
  onDeleteFolder:    (id: string) => void;
  /** Callback de création d'un sous-dossier */
  onCreateSubfolder: (parentId: string) => void;
  /** Map des dossiers expansés (id → boolean, true par défaut) */
  expandedIds:       Record<string, boolean>;
  /** Bascule l'état expansé/réduit d'un dossier */
  toggleExpand:      (id: string) => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function FolderTreeItem({
  node, depth, view, onSelectView,
  editingId, editingName, setEditingId, setEditingName, commitRename,
  menuId, setMenuId, counts,
  onDeleteFolder, onCreateSubfolder,
  expandedIds, toggleExpand,
}: FolderTreeItemProps) {
  /** Indique si ce dossier est la vue actuellement active */
  const isActive    = viewEq(view, { type: 'folder', id: node.id });
  /** Indique si ce dossier a des enfants */
  const hasChildren = node.children.length > 0;
  /** Indique si ce dossier est actuellement expansé (true par défaut) */
  const isExpanded  = expandedIds[node.id] ?? true;

  /** Classes CSS de la ligne selon l'état actif */
  const rowCls = `w-full flex items-center justify-between rounded-lg text-sm transition-colors ${
    isActive
      ? 'bg-yellow-500/15 text-yellow-600 dark:text-yellow-300 font-medium'
      : 'text-gray-500 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-dark-700'
  }`;

  return (
    <div>
      {/* Ligne du dossier — padding gauche proportionnel à la profondeur */}
      <div className="relative group px-2" style={{ paddingLeft: 8 + depth * 12 }}>
        {editingId === node.id ? (
          /* Mode édition — input inline autoFocus */
          <input
            name="folder-name"
            aria-label="Nom du dossier"
            autoFocus
            value={editingName}
            onChange={e => setEditingName(e.target.value)}
            onBlur={() => commitRename(node.id)}
            onKeyDown={e => {
              if (e.key === 'Enter')  commitRename(node.id);
              if (e.key === 'Escape') setEditingId(null);
            }}
            className="w-full px-2 py-1.5 text-sm bg-gray-100 dark:bg-dark-700 border border-yellow-500/50 rounded-lg text-gray-900 dark:text-white focus:outline-none my-0.5"
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
              {/* Bouton expansion — masqué si pas d'enfants */}
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
              {/* Compteur de notes */}
              <span className="text-xs opacity-50">{counts.byFolder[node.id] ?? 0}</span>
              {/* Bouton menu contextuel — visible au survol */}
              <button
                type="button"
                title="Options"
                onClick={e => { e.stopPropagation(); setMenuId(menuId === node.id ? null : node.id); }}
                className="opacity-0 group-hover:opacity-100 p-0.5 rounded hover:bg-gray-200 dark:hover:bg-dark-600 transition-opacity"
              >
                <MoreHorizontal size={11} />
              </button>
            </span>
          </div>
        )}

        {/* Menu contextuel — renommer, sous-dossier, supprimer */}
        {menuId === node.id && (
          <div
            className="absolute right-0 top-full z-50 mt-1 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg shadow-2xl overflow-hidden w-48"
            onClick={e => e.stopPropagation()}
          >
            <button type="button" onClick={() => { setEditingId(node.id); setEditingName(node.name); setMenuId(null); }}
              className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700">
              Renommer
            </button>
            <button type="button" onClick={() => { onCreateSubfolder(node.id); setMenuId(null); }}
              className="w-full px-3 py-2 text-sm text-left text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-dark-700 flex items-center gap-2">
              <FolderPlus size={12} /> Nouveau sous-dossier
            </button>
            <button type="button" onClick={() => { onDeleteFolder(node.id); setMenuId(null); }}
              className="w-full px-3 py-2 text-sm text-left text-red-500 dark:text-red-400 hover:bg-gray-100 dark:hover:bg-dark-700">
              Supprimer
            </button>
          </div>
        )}
      </div>

      {/* Enfants — rendus récursivement si le dossier est expansé */}
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
