/**
 * ============================================================================
 * HOOK NOTE FILTERS — hooks/notes/useNoteFilters.ts
 * ============================================================================
 *
 * Gère la vue active, la recherche, le tri et le filtrage de la liste des notes.
 *
 * Fonctionnalités :
 *   - État `view` : vue active (inbox, pinned, trash, dossier, tag)
 *   - État `sortBy` : critère de tri (dateModified | dateCreated | title)
 *   - État `search` : texte de la barre de recherche
 *   - `filteredNotes` : liste calculée avec filtres + tri + recherche
 *   - `allTags` : union tags des notes + tags manuels (pour l'autocomplétion)
 *   - `currentFolder` : dossier actif si view = { type: 'folder', id }
 *   - Sections épinglées : `hasPinnedSection`, `pinnedNotes`, `unpinnedNotes`
 *   - Persistance localStorage : view restaurée au montage, sauvée à chaque changement
 *
 * Paramètres reçus :
 *   notes        — notes actives (Firestore onSnapshot)
 *   deletedNotes — notes en corbeille (Firestore onSnapshot)
 *   folders      — tous les dossiers (normaux + intelligents)
 *   manualTags   — tags créés manuellement (collection adminTags)
 * ============================================================================
 */

import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Note, Folder, SmartFolderFilter } from '@/lib/notes-service';
import { applySmartFilters, stripHtml } from '@/lib/notes-utils';
import type { ViewFilter, SortBy } from '@/lib/notes-types';

// ── Interface paramètres ───────────────────────────────────────────────────────

interface UseNoteFiltersParams {
  /** Notes actives en temps réel (Firestore listener) */
  notes:        Note[];
  /** Notes en corbeille (Firestore listener) */
  deletedNotes: Note[];
  /** Tous les dossiers (normaux + intelligents) */
  folders:      Folder[];
  /** Tags créés manuellement dans la sidebar */
  manualTags:   string[];
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNoteFilters({
  notes,
  deletedNotes,
  folders,
  manualTags,
}: UseNoteFiltersParams) {

  // ── État de navigation ─────────────────────────────────────────────────────
  /** Vue active — interne, setter brut uniquement pour la restauration localStorage */
  const [view,   _setView]   = useState<ViewFilter>('inbox');
  /** Critère de tri — interne, setter brut uniquement pour la restauration localStorage */
  const [sortBy, _setSortBy] = useState<SortBy>('dateModified');
  /** Texte de la barre de recherche */
  const [search, setSearch] = useState('');

  // ── Persistance localStorage — pattern "atomic setter" ────────────────────
  //
  // Principe (best practice shadcn/Josh W. Comeau) :
  //   • L'effet de restauration [] lit localStorage et appelle le setter BRUT
  //     (_setView/_setSortBy) → aucun write localStorage, zéro race condition.
  //   • Les wrappers exportés (setView/setSortBy) écrivent état ET localStorage
  //     de façon atomique → pas d'effet réactif [view], impossible d'écraser
  //     les valeurs stockées avec les valeurs par défaut au mount.

  /** Restaure la vue depuis localStorage une seule fois au mount (post-hydration SSR) */
  useEffect(() => {
    try {
      const v = localStorage.getItem('notes_view');
      if (v) _setView(JSON.parse(v) as ViewFilter);
    } catch { /* ignore — localStorage peut être bloqué */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Restaure le tri depuis localStorage une seule fois au mount */
  useEffect(() => {
    try {
      const s = localStorage.getItem('notes_sortBy');
      if (s === 'dateModified' || s === 'dateCreated' || s === 'title') _setSortBy(s);
    } catch { /* ignore */ }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  /** Setter public — met à jour l'état ET persiste dans localStorage atomiquement */
  const setView = useCallback((v: ViewFilter) => {
    _setView(v);
    try { localStorage.setItem('notes_view', JSON.stringify(v)); }
    catch { /* ignore */ }
  }, []);

  /** Setter public — met à jour l'état ET persiste dans localStorage atomiquement */
  const setSortBy = useCallback((s: SortBy) => {
    _setSortBy(s);
    try { localStorage.setItem('notes_sortBy', s); }
    catch { /* ignore */ }
  }, []);

  // ── Dérivés stables ────────────────────────────────────────────────────────

  /** true si la vue active est la corbeille */
  const isTrash = view === 'trash';

  /**
   * Dossier actif — non-null uniquement si view = { type: 'folder', id }.
   * Utilisé pour déterminer dans quel dossier créer une nouvelle note.
   */
  const currentFolder = useMemo(() =>
    typeof view === 'object' && view.type === 'folder'
      ? folders.find(f => f.id === view.id) ?? null
      : null,
    [view, folders]
  );

  /**
   * Union de tous les tags connus : tags extraits automatiquement (#tag dans contenu)
   * + tags créés manuellement dans la sidebar.
   * Utilisé pour l'autocomplétion (#tag) dans le titre et le contenu.
   */
  const allTags = useMemo(() => {
    const set = new Set<string>([...manualTags]);
    notes.forEach(n => n.tags.forEach(t => set.add(t)));
    return Array.from(set);
  }, [notes, manualTags]);

  // ── Notes filtrées et triées ───────────────────────────────────────────────
  /**
   * Liste des notes à afficher dans la colonne centrale.
   * Applique dans l'ordre :
   *   1. Filtre par vue (dossier, tag, épinglées, inbox, trash, smart)
   *   2. Filtre par texte de recherche (titre + contenu sans HTML)
   *   3. Séparation épinglées / non-épinglées
   *   4. Tri par critère (dateModified | dateCreated | title)
   *
   * Les notes épinglées sont toujours en tête de liste.
   * En vue trash : triées par date de suppression (plus récentes en haut).
   */
  const filteredNotes = useMemo(() => {
    let list = isTrash ? [...deletedNotes] : [...notes];

    // ── Filtre par vue active ──────────────────────────────────────────────
    if (!isTrash) {
      if (view === 'pinned') {
        // Vue "Épinglées" : toutes les notes épinglées, tous dossiers
        list = list.filter(n => n.pinned);
      } else if (view === 'inbox') {
        // Vue "Inbox" : notes sans dossier assigné
        list = list.filter(n => !n.folderId);
      } else if (typeof view === 'object' && view.type === 'folder') {
        const folder = folders.find(f => f.id === view.id);
        if (folder?.isSmart && folder.filters) {
          // Dossier intelligent : applique les filtres dynamiques (tags, dates, épinglées)
          list = applySmartFilters(list, folder.filters as SmartFolderFilter);
        } else {
          // Dossier normal : filtrer par folderId
          list = list.filter(n => n.folderId === view.id);
        }
      } else if (typeof view === 'object' && view.type === 'tag') {
        // Vue tag : toutes les notes contenant ce tag
        list = list.filter(n => n.tags.includes(view.tag));
      }
      // view === 'all' : toutes les notes actives, aucun filtre
    }

    // ── Filtre par recherche texte ─────────────────────────────────────────
    if (search.trim()) {
      const s = search.toLowerCase();
      list = list.filter(n =>
        n.title.toLowerCase().includes(s) ||
        stripHtml(n.content).toLowerCase().includes(s)
      );
    }

    // ── Tri ───────────────────────────────────────────────────────────────
    if (!isTrash) {
      const pinned   = list.filter(n => n.pinned);
      const unpinned = list.filter(n => !n.pinned);
      const sort = (arr: Note[]) => arr.sort((a, b) => {
        if (sortBy === 'dateModified') return b.updatedAt.getTime() - a.updatedAt.getTime();
        if (sortBy === 'dateCreated')  return b.createdAt.getTime() - a.createdAt.getTime();
        return a.title.localeCompare(b.title, 'fr');
      });
      // Les épinglées (triées) précèdent toujours les non-épinglées (triées)
      return [...sort(pinned), ...sort(unpinned)];
    }

    // Vue trash : plus récemment supprimées en premier
    return list.sort((a, b) =>
      (b.deletedAt?.getTime() ?? 0) - (a.deletedAt?.getTime() ?? 0)
    );
  }, [notes, deletedNotes, view, search, sortBy, isTrash, folders]);

  // ── Sections épinglées ─────────────────────────────────────────────────────
  /**
   * Affiche la section "Épinglées" uniquement si la liste contient à la fois
   * des notes épinglées ET non-épinglées (évite un header inutile en vue "Épinglées").
   */
  const hasPinnedSection =
    !isTrash && view !== 'pinned' &&
    filteredNotes.some(n => n.pinned) && filteredNotes.some(n => !n.pinned);

  /** Notes épinglées — vide si hasPinnedSection est false */
  const pinnedNotes   = hasPinnedSection ? filteredNotes.filter(n => n.pinned)  : [];
  /** Notes non-épinglées — toute la liste si hasPinnedSection est false */
  const unpinnedNotes = hasPinnedSection ? filteredNotes.filter(n => !n.pinned) : filteredNotes;

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    view,   setView,
    sortBy, setSortBy,
    search, setSearch,
    isTrash,
    currentFolder,
    allTags,
    filteredNotes,
    hasPinnedSection,
    pinnedNotes,
    unpinnedNotes,
  };
}
