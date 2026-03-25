"use client";

/**
 * ============================================================================
 * COMMAND PALETTE — Ctrl+K
 * ============================================================================
 *
 * Palette de commandes flottante à la Notion / Linear.
 * Raccourci : Ctrl+K (ou Cmd+K sur Mac)
 *
 * Fonctionnalités :
 *   - Recherche fuzzy sur les notes (titre) et les dossiers (nom)
 *   - Actions rapides : Nouvelle note, Toutes les notes, Profil
 *   - Navigation clavier : ↑↓ · Enter (execute) · Escape (ferme)
 *   - Résultats groupés : Actions / Notes / Dossiers
 * ============================================================================
 */

import { useState, useEffect, useRef, useMemo } from 'react';
import {
  StickyNote, FolderOpen, Plus, ArrowRight,
  User as UserIcon, Search, Folder, X,
} from 'lucide-react';
import type { Note, Folder as FolderType } from '@/lib/notes-service';
import type { ViewFilter } from '@/lib/notes-types';
import Link from 'next/link';

// ── Types ─────────────────────────────────────────────────────────────────────

interface PaletteItem {
  id:       string;
  label:    string;
  subtitle?: string;
  icon:     React.ReactNode;
  action:   () => void;
  isLink?:  string;   // si défini → rendu comme <Link> plutôt que <button>
}

interface CommandPaletteProps {
  notes:         Note[];
  folders:       FolderType[];
  onClose:       () => void;
  onSelectNote:  (note: Note) => void;
  onSelectView:  (v: ViewFilter) => void;
  onNewNote:     () => void;
}

// ── Fuzzy match léger ──────────────────────────────────────────────────────────

function fuzzy(query: string, target: string): boolean {
  if (!query) return true;
  const q = query.toLowerCase();
  const t = target.toLowerCase();
  if (t.includes(q)) return true;
  // Match caractère par caractère en ordre (pas forcément contigus)
  let qi = 0;
  for (let i = 0; i < t.length && qi < q.length; i++) {
    if (t[i] === q[qi]) qi++;
  }
  return qi === q.length;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function CommandPalette({
  notes, folders, onClose, onSelectNote, onSelectView, onNewNote,
}: CommandPaletteProps) {
  const [query,     setQuery]     = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef   = useRef<HTMLInputElement>(null);
  const listRef    = useRef<HTMLDivElement>(null);

  // Focus l'input au montage
  useEffect(() => { inputRef.current?.focus(); }, []);

  // Fermer sur Escape (global)
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  // ── Construction des groupes de résultats ──────────────────────────────────

  const groups = useMemo(() => {
    const q = query.trim();

    // Groupe Actions (toujours présent quand query est vide ou correspond)
    const actions: PaletteItem[] = [
      {
        id:     'new-note',
        label:  'Nouvelle note',
        subtitle: 'Ctrl+N',
        icon:   <Plus size={14} />,
        action: onNewNote,
      },
      {
        id:     'all-notes',
        label:  'Toutes les notes',
        icon:   <StickyNote size={14} />,
        action: () => onSelectView('all'),
      },
      {
        id:     'profile',
        label:  'Profil & paramètres',
        icon:   <UserIcon size={14} />,
        action: () => {},
        isLink: '/profile',
      },
    ].filter(a => !q || fuzzy(q, a.label));

    // Groupe Notes (recherche sur le titre)
    const matchedNotes: PaletteItem[] = !q ? [] : notes
      .filter(n => fuzzy(q, n.title || 'Sans titre'))
      .slice(0, 8)
      .map(n => ({
        id:       `note-${n.id}`,
        label:    n.title || 'Sans titre',
        subtitle: folders.find(f => f.id === n.folderId)?.name,
        icon:     <StickyNote size={14} />,
        action:   () => onSelectNote(n),
      }));

    // Groupe Dossiers (recherche sur le nom)
    const matchedFolders: PaletteItem[] = !q ? [] : folders
      .filter(f => !f.isSmart && fuzzy(q, f.name))
      .slice(0, 5)
      .map(f => ({
        id:      `folder-${f.id}`,
        label:   f.name,
        icon:    <Folder size={14} />,
        action:  () => onSelectView({ type: 'folder', id: f.id }),
      }));

    return [
      { label: 'Actions',  items: actions          },
      { label: 'Notes',    items: matchedNotes      },
      { label: 'Dossiers', items: matchedFolders    },
    ].filter(g => g.items.length > 0);
  }, [query, notes, folders, onNewNote, onSelectNote, onSelectView]);

  // Liste plate pour la navigation clavier
  const flatItems = useMemo(() => groups.flatMap(g => g.items), [groups]);

  // Reset activeIdx quand la query change
  useEffect(() => { setActiveIdx(0); }, [query]);

  // Scroll l'item actif dans la vue
  useEffect(() => {
    const el = listRef.current?.querySelector(`[data-idx="${activeIdx}"]`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx(i => Math.min(i + 1, flatItems.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      flatItems[activeIdx]?.action();
      if (!flatItems[activeIdx]?.isLink) onClose();
    }
  }

  // Compteur global pour assigner data-idx à travers les groupes
  let globalIdx = 0;

  return (
    /* Backdrop */
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-24 px-4 bg-black/50 backdrop-blur-sm"
      onClick={onClose}
    >
      {/* Modal */}
      <div
        className="w-full max-w-lg bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-dark-700 rounded-xl shadow-2xl overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Input de recherche */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-dark-800">
          <Search size={15} className="shrink-0 text-gray-400" />
          <input
            ref={inputRef}
            name="command-palette"
            type="text"
            aria-label="Recherche rapide"
            placeholder="Rechercher ou taper une commande…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            className="flex-1 bg-transparent text-sm text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')}
              className="text-gray-400 hover:text-gray-600 dark:hover:text-white transition-colors">
              <X size={13} />
            </button>
          )}
        </div>

        {/* Résultats */}
        <div ref={listRef} className="max-h-80 overflow-y-auto py-1">
          {flatItems.length === 0 ? (
            <p className="px-4 py-6 text-sm text-center text-gray-400">
              Aucun résultat pour « {query} »
            </p>
          ) : (
            groups.map(group => (
              <div key={group.label}>
                {/* En-tête de groupe */}
                <p className="px-4 pt-2 pb-1 text-[10px] font-medium text-gray-400 dark:text-gray-500 uppercase tracking-wider">
                  {group.label}
                </p>
                {/* Items */}
                {group.items.map(item => {
                  const idx = globalIdx++;
                  const isActive = idx === activeIdx;
                  const sharedCls = `w-full flex items-center gap-3 px-4 py-2.5 text-sm transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-yellow-500/15 text-yellow-300'
                      : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111520]'
                  }`;

                  if (item.isLink) {
                    return (
                      <Link
                        key={item.id}
                        href={item.isLink}
                        data-idx={idx}
                        onClick={onClose}
                        className={sharedCls}
                      >
                        <span className={`shrink-0 ${isActive ? 'text-yellow-400' : 'text-gray-400'}`}>
                          {item.icon}
                        </span>
                        <span className="flex-1 truncate">{item.label}</span>
                        {item.subtitle && (
                          <span className="text-xs text-gray-400 ml-auto shrink-0">{item.subtitle}</span>
                        )}
                        <ArrowRight size={11} className="shrink-0 text-gray-400 opacity-50" />
                      </Link>
                    );
                  }

                  return (
                    <button
                      key={item.id}
                      type="button"
                      data-idx={idx}
                      onClick={() => { item.action(); onClose(); }}
                      onMouseEnter={() => setActiveIdx(idx)}
                      className={sharedCls}
                    >
                      <span className={`shrink-0 ${isActive ? 'text-yellow-400' : 'text-gray-400'}`}>
                        {item.icon}
                      </span>
                      <span className="flex-1 truncate">{item.label}</span>
                      {item.subtitle && (
                        <span className="text-xs text-gray-400 ml-auto shrink-0">{item.subtitle}</span>
                      )}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer hints */}
        <div className="px-4 py-2 border-t border-gray-100 dark:border-dark-800 flex items-center gap-4 text-[10px] text-gray-400">
          <span className="flex items-center gap-1"><kbd className="font-mono">↑↓</kbd> naviguer</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">Entrée</kbd> ouvrir</span>
          <span className="flex items-center gap-1"><kbd className="font-mono">Échap</kbd> fermer</span>
        </div>
      </div>
    </div>
  );
}
