/**
 * ============================================================================
 * COLONNE LISTE DES NOTES — components/notes/NoteListColumn.tsx
 * ============================================================================
 *
 * Colonne du milieu de l'éditeur de notes (3 colonnes : sidebar · liste · éditeur).
 * Affiche la liste filtrée et triée des notes de la vue courante.
 *
 * ── Responsabilités ──────────────────────────────────────────────────────────
 *
 * - Header : titre de la vue courante, bouton tri, bouton nouvelle note,
 *            bouton "Vider la corbeille" (si vue trash)
 * - Barre de recherche : filtre les notes en temps réel (Ctrl+F)
 * - Liste des notes : AnimatePresence pour les animations d'entrée/sortie,
 *                     sections "Épinglées" / "Notes" si notes épinglées présentes
 * - Skeleton loading : 4 cartes factices pendant le chargement Firestore
 * - État vide : icône StickyNote + message contextuel
 *
 * ── Extraction ───────────────────────────────────────────────────────────────
 *
 * Extrait de NotesEditor.tsx — bloc {/* ══ NOTE LIST ══ *\/} (lignes 592–706).
 * Phase 6 du refactoring — réduction NotesEditor.tsx de ~1136 à ~900 lignes.
 *
 * ── Props ─────────────────────────────────────────────────────────────────────
 *
 * mobilePanel / setMobilePanel : contrôle de la colonne visible sur mobile
 * view / folders               : vue courante + liste dossiers (pour le label)
 * isTrash / currentFolder      : flags de contexte (corbeille, dossier intelligent)
 * showSortMenu / setShowSortMenu / sortBy / setSortBy : menu de tri
 * onNewNote                    : callback création nouvelle note
 * deletedNotes                 : notes supprimées (pour "Vider la corbeille")
 * search / setSearch / searchRef : barre de recherche
 * filteredNotes / hasPinnedSection / pinnedNotes / unpinnedNotes : listes filtrées
 * selectedId / onSelectNote    : sélection de la note ouverte
 * loading                      : état de chargement Firestore
 * ============================================================================
 */

"use client";

import { AnimatePresence } from 'framer-motion';
import {
  Plus, Search, StickyNote, ArrowLeft, X, ArrowUpDown, Trash2, Zap,
} from 'lucide-react';
import { permanentlyDeleteNote } from '@/lib/notes-service';
import type { Note, Folder } from '@/lib/notes-service';
import type { ViewFilter, SortBy, MobilePanel } from '@/lib/notes-types';
import { viewLabel } from '@/lib/notes-types';
import { daysUntilPurge } from '@/lib/notes-utils';
import NoteCard from '@/components/notes/NoteCard';
import React from 'react';

// ── Props ─────────────────────────────────────────────────────────────────────

interface NoteListColumnProps {
  /** Panneau visible sur mobile */
  mobilePanel: MobilePanel;
  /** Met à jour le panneau visible sur mobile */
  setMobilePanel: (p: MobilePanel) => void;
  /** Filtre de vue actif (all, pinned, inbox, trash, folder, tag) */
  view: ViewFilter;
  /** Liste complète des dossiers (pour le label de la vue courante) */
  folders: Folder[];
  /** Vrai si la vue courante est la corbeille */
  isTrash: boolean;
  /** Dossier courant si la vue est un dossier (undefined sinon) */
  currentFolder: Folder | undefined;
  /** Affiche/masque le menu de tri */
  showSortMenu: boolean;
  /** Setter du menu de tri (supporte la forme fonctionnelle prev => !prev) */
  setShowSortMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  /** Critère de tri courant */
  sortBy: SortBy;
  /** Modifie le critère de tri */
  setSortBy: (s: SortBy) => void;
  /** Crée une nouvelle note */
  onNewNote: () => void;
  /** Notes supprimées (corbeille) — pour le bouton "Vider" */
  deletedNotes: Note[];
  /** Texte de recherche courant */
  search: string;
  /** Met à jour le texte de recherche */
  setSearch: (s: string) => void;
  /** Ref de l'input de recherche (Ctrl+F) */
  searchRef: React.RefObject<HTMLInputElement | null>;
  /** Notes filtrées selon la vue + recherche + tri */
  filteredNotes: Note[];
  /** Vrai si des notes épinglées existent dans la vue courante */
  hasPinnedSection: boolean;
  /** Notes épinglées de la vue courante */
  pinnedNotes: Note[];
  /** Notes non épinglées de la vue courante */
  unpinnedNotes: Note[];
  /** ID de la note actuellement ouverte dans l'éditeur */
  selectedId: string | null;
  /** Sélectionne une note dans l'éditeur */
  onSelectNote: (note: Note) => void;
  /** Vrai pendant le chargement initial Firestore */
  loading: boolean;
}

// ── Composant ─────────────────────────────────────────────────────────────────

/**
 * NoteListColumn — colonne du milieu de l'éditeur de notes.
 * Affiche la liste filtrée/triée des notes avec header, recherche et animations.
 */
export default function NoteListColumn({
  mobilePanel,
  setMobilePanel,
  view,
  folders,
  isTrash,
  currentFolder,
  showSortMenu,
  setShowSortMenu,
  sortBy,
  setSortBy,
  onNewNote,
  deletedNotes,
  search,
  setSearch,
  searchRef,
  filteredNotes,
  hasPinnedSection,
  pinnedNotes,
  unpinnedNotes,
  selectedId,
  onSelectNote,
  loading,
}: NoteListColumnProps) {
  return (
    /* ══ NOTE LIST ══════════════════════════════════════════════════════════ */
    <div className={`
      ${mobilePanel === 'list' ? 'flex' : 'hidden'} md:flex
      w-full md:w-72 shrink-0 flex-col bg-dark-900 border-r border-dark-700
    `}>
      {/* ── Header : titre de la vue, tri, nouvelle note ─────────────────── */}
      <div className="px-3 pt-3 pb-2 border-b border-dark-700">
        {/* Bouton retour mobile (sidebar → liste) */}
        <div className="md:hidden flex items-center gap-2 mb-2">
          <button
            type="button"
            onClick={() => setMobilePanel('sidebar')}
            className="flex items-center gap-1 text-xs text-gray-400 hover:text-white"
          >
            <ArrowLeft size={13} />{viewLabel(view, folders)}
          </button>
        </div>

        {/* Titre vue + boutons actions */}
        <div className="flex items-center justify-between mb-2">
          <span className="flex items-center gap-1.5 text-sm font-semibold text-white truncate">
            {/* Icône éclair pour les dossiers intelligents */}
            {currentFolder?.isSmart && <Zap size={12} className="text-yellow-400 shrink-0" />}
            {viewLabel(view, folders)}
          </span>

          <div className="flex items-center gap-1">
            {/* Bouton tri (masqué en mode corbeille) */}
            {!isTrash && (
              <div className="relative">
                <button
                  type="button"
                  title="Trier"
                  onClick={e => { e.stopPropagation(); setShowSortMenu(prev => !prev); }}
                  className="p-1 rounded text-gray-500 hover:text-white hover:bg-dark-700 transition-colors"
                >
                  <ArrowUpDown size={12} />
                </button>

                {/* Menu déroulant de tri */}
                {showSortMenu && (
                  <div
                    className="absolute right-0 top-full z-50 mt-1 bg-dark-800 border border-dark-600 rounded-lg shadow-2xl overflow-hidden w-44"
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Trier par</p>
                    {([
                      ['dateModified', 'Date de modification'],
                      ['dateCreated',  'Date de création'],
                      ['title',        'Titre'],
                    ] as [SortBy, string][]).map(([val, label]) => (
                      <button
                        key={val}
                        type="button"
                        onClick={() => { setSortBy(val); setShowSortMenu(false); }}
                        className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${
                          sortBy === val
                            ? 'text-yellow-400 bg-yellow-500/10'
                            : 'text-gray-300 hover:bg-dark-700'
                        }`}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Bouton nouvelle note (masqué en corbeille) */}
            {!isTrash && (
              <button
                type="button"
                onClick={onNewNote}
                title="Nouvelle note"
                className="p-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 transition-colors"
              >
                <Plus size={14} />
              </button>
            )}

            {/* Bouton "Vider la corbeille" — corbeille non vide uniquement */}
            {isTrash && deletedNotes.length > 0 && (
              <button
                type="button"
                title="Vider la corbeille"
                onClick={() => {
                  if (confirm('Supprimer définitivement toutes les notes ?')) {
                    deletedNotes.forEach(n => permanentlyDeleteNote(n.id));
                  }
                }}
                className="text-xs text-red-400 hover:text-red-300 px-2 py-1 rounded hover:bg-red-500/10 transition-colors"
              >
                <Trash2 size={12} />
              </button>
            )}
          </div>
        </div>

        {/* ── Barre de recherche ──────────────────────────────────────────── */}
        <div className="relative">
          <Search size={12} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-500" />
          <input
            ref={searchRef as React.RefObject<HTMLInputElement>}
            name="note-search"
            type="text"
            placeholder="Rechercher… (Ctrl+F)"
            value={search}
            onChange={e => setSearch(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Escape') {
                setSearch('');
                searchRef.current?.blur();
              }
            }}
            className="w-full pl-7 pr-7 py-1.5 bg-dark-800 border border-dark-700 rounded-lg text-xs text-white placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
          />
          {/* Bouton effacer recherche */}
          {search && (
            <button
              type="button"
              title="Effacer"
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white"
            >
              <X size={11} />
            </button>
          )}
        </div>

        {/* Compteur de résultats */}
        {search && (
          <p className="text-[10px] text-gray-500 mt-1 text-right">
            {filteredNotes.length} résultat{filteredNotes.length !== 1 ? 's' : ''}
          </p>
        )}
      </div>

      {/* ── Corps : liste des notes ─────────────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {loading ? (
          /* Skeleton loading — 4 cartes factices pendant le chargement Firestore */
          <div className="px-2 py-2 space-y-1.5" aria-busy="true" aria-label="Chargement des notes…">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="px-3 py-2.5 rounded-lg bg-dark-800 animate-pulse">
                <div className="h-3 w-3/4 bg-dark-600 rounded mb-2" />
                <div className="h-2 w-1/2 bg-dark-700 rounded" />
              </div>
            ))}
          </div>
        ) : filteredNotes.length === 0 ? (
          /* État vide — message contextuel selon la vue */
          <div className="flex flex-col items-center justify-center h-40 text-gray-600">
            <StickyNote size={28} className="mb-2 opacity-30" />
            <p className="text-xs">
              {search ? 'Aucun résultat' : isTrash ? 'Corbeille vide' : 'Aucune note'}
            </p>
          </div>
        ) : (
          /* Liste animée des notes */
          <AnimatePresence mode="popLayout">
            {/* Section "Épinglées" */}
            {hasPinnedSection && (
              <div
                key="pinned-header"
                className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest bg-dark-900 sticky top-0 z-10"
              >
                Épinglées
              </div>
            )}
            {hasPinnedSection && pinnedNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                selected={selectedId === note.id}
                onSelect={onSelectNote}
              />
            ))}

            {/* Section "Notes" (non épinglées) */}
            {hasPinnedSection && (
              <div
                key="unpinned-header"
                className="px-3 py-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest bg-dark-900 sticky top-6 z-10"
              >
                Notes
              </div>
            )}
            {unpinnedNotes.map(note => (
              <NoteCard
                key={note.id}
                note={note}
                selected={selectedId === note.id}
                onSelect={onSelectNote}
                /* Jours restants avant purge définitive (corbeille uniquement) */
                trashInfo={isTrash && note.deletedAt ? daysUntilPurge(note.deletedAt) : undefined}
              />
            ))}
          </AnimatePresence>
        )}
      </div>
    </div>
  );
}
