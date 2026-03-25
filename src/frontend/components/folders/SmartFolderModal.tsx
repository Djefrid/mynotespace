/**
 * ============================================================================
 * SMART FOLDER MODAL — components/notes/SmartFolderModal.tsx
 * ============================================================================
 *
 * Modal de création/édition des dossiers intelligents.
 * Permet de configurer des filtres dynamiques (tags, épinglées, dates)
 * qui déterminent quelles notes apparaissent dans le dossier.
 *
 * Fonctionnalités :
 *   - Filtre par tags (mode ET ou OU)
 *   - Filtre épinglées uniquement
 *   - Filtre par date de création (N derniers jours)
 *   - Filtre par date de modification (N derniers jours)
 *   - Focus trap WCAG 2.1.2 (Tab/Shift+Tab confiné dans la modal)
 *   - Restauration focus déclencheur à la fermeture (WCAG 2.4.3)
 *   - Fermeture Escape
 * ============================================================================
 */

"use client";

import { useState, useRef, useEffect } from 'react';
import { Zap } from 'lucide-react';
import type { SmartFolderFilter } from '@/lib/notes-service';

// ── Props du composant ────────────────────────────────────────────────────────

interface SmartFolderModalProps {
  /** Liste de tous les tags existants dans les notes (pour les coches) */
  allTags:   string[];
  /** Valeurs initiales si on édite un dossier existant (undefined = création) */
  initial?:  { name: string; filters: SmartFolderFilter };
  /** Appelé avec le nom + filtres quand l'utilisateur confirme */
  onConfirm: (name: string, filters: SmartFolderFilter) => void;
  /** Appelé quand l'utilisateur annule ou presse Escape */
  onCancel:  () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function SmartFolderModal({
  allTags,
  initial,
  onConfirm,
  onCancel,
}: SmartFolderModalProps) {
  // ── État local des champs du formulaire ───────────────────────────────────
  const [name,            setName]            = useState(initial?.name ?? 'Dossier intelligent');
  const [useTags,         setUseTags]         = useState(!!(initial?.filters?.tags?.length));
  const [selectedTags,    setSelectedTags]    = useState<string[]>(initial?.filters?.tags ?? []);
  const [tagLogic,        setTagLogic]        = useState<'and' | 'or'>(initial?.filters?.tagLogic ?? 'or');
  const [usePinned,       setUsePinned]       = useState(initial?.filters?.pinned !== undefined);
  const [useCreatedDays,  setUseCreatedDays]  = useState(!!(initial?.filters?.createdWithinDays));
  const [createdDays,     setCreatedDays]     = useState(initial?.filters?.createdWithinDays ?? 7);
  const [useModifiedDays, setUseModifiedDays] = useState(!!(initial?.filters?.modifiedWithinDays));
  const [modifiedDays,    setModifiedDays]    = useState(initial?.filters?.modifiedWithinDays ?? 7);

  /** Référence vers le conteneur de la dialog — utilisé pour le focus trap */
  const dialogRef = useRef<HTMLDivElement>(null);

  /**
   * Capture l'élément actif PENDANT la phase de rendu (avant le commit DOM + autoFocus).
   * useEffect serait trop tardif — autoFocus aurait déjà déplacé le focus sur l'input.
   * Ce ref est initialisé une seule fois grâce au guard `=== null`.
   */
  const prevFocusRef = useRef<HTMLElement | null>(null);
  if (prevFocusRef.current === null && typeof document !== 'undefined') {
    prevFocusRef.current = document.activeElement as HTMLElement;
  }

  /** Restaure le focus sur l'élément déclencheur à la fermeture de la modal (WCAG 2.4.3) */
  useEffect(() => {
    const trigger = prevFocusRef.current;
    return () => {
      trigger?.focus();
    };
  }, []);

  /**
   * Gère la navigation clavier à l'intérieur de la modal.
   * - Escape : ferme la modal
   * - Tab / Shift+Tab : confine le focus dans la modal (WCAG 2.1.2)
   */
  const handleDialogKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === 'Escape') { onCancel(); return; }
    if (e.key !== 'Tab') return;
    // Récupère tous les éléments focusables dans la dialog
    const focusable = dialogRef.current?.querySelectorAll<HTMLElement>(
      'button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    if (!focusable || focusable.length === 0) return;
    const arr   = Array.from(focusable);
    const first = arr[0];
    const last  = arr[arr.length - 1];
    if (e.shiftKey) {
      // Shift+Tab sur le premier élément → aller au dernier
      if (document.activeElement === first) { e.preventDefault(); last.focus(); }
    } else {
      // Tab sur le dernier élément → aller au premier
      if (document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  };

  /** Construit l'objet SmartFolderFilter et appelle onConfirm */
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

  /** Bascule la sélection d'un tag dans la liste des filtres */
  const toggleTag = (t: string) =>
    setSelectedTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60"
      onClick={onCancel}
      onKeyDown={e => e.key === 'Escape' && onCancel()}
    >
      {/* Conteneur dialog — role/aria-modal pour les lecteurs d'écran (WCAG 4.1.2) */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="smart-folder-modal-title"
        className="bg-white dark:bg-[#0d1117] border border-gray-200 dark:border-dark-700 rounded-xl w-full max-w-md mx-4 shadow-2xl"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleDialogKeyDown}
      >
        <div className="px-5 py-4 border-b border-gray-200 dark:border-dark-700 flex items-center gap-2">
          {/* Icône décorative — masquée aux lecteurs d'écran */}
          <Zap size={15} className="text-yellow-500 dark:text-yellow-400" aria-hidden="true" />
          <h2 id="smart-folder-modal-title" className="text-sm font-semibold text-gray-900 dark:text-white">
            {initial ? 'Modifier le dossier intelligent' : 'Nouveau dossier intelligent'}
          </h2>
        </div>
        <div className="px-5 py-4 space-y-4 max-h-[60vh] overflow-y-auto">
          {/* Champ nom du dossier */}
          <div>
            <label className="text-xs text-gray-500 dark:text-gray-400 mb-1.5 block">Nom</label>
            <input
              name="smart-folder-name"
              type="text"
              title="Nom du dossier"
              placeholder="Nom du dossier"
              value={name}
              onChange={e => setName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleSubmit()}
              maxLength={80}
              className="w-full px-3 py-2 bg-gray-50 dark:bg-[#111520] border border-gray-300 dark:border-dark-700 rounded-lg text-sm text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50"
              autoFocus
            />
          </div>
          <div className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest pt-1">Filtres</div>
          {/* Filtre par tags */}
          <div className="space-y-2">
            <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
              <input type="checkbox" checked={useTags} onChange={e => setUseTags(e.target.checked)} className="accent-yellow-500 w-3.5 h-3.5" />
              Par tags
            </label>
            {useTags && (
              <div className="ml-5 space-y-2">
                {allTags.length === 0 ? (
                  <p className="text-xs text-gray-400 dark:text-gray-500">Aucun tag existant dans tes notes</p>
                ) : (
                  <div className="flex flex-wrap gap-1">
                    {allTags.map(t => (
                      <button key={t} type="button" onClick={() => toggleTag(t)}
                        className={`text-xs px-2 py-0.5 rounded-full border transition-colors ${
                          selectedTags.includes(t)
                            ? 'bg-yellow-500/25 text-yellow-600 dark:text-yellow-300 border-yellow-500/50'
                            : 'bg-gray-100 dark:bg-[#111520] text-gray-500 dark:text-gray-400 border-gray-300 dark:border-dark-600 hover:border-yellow-500/30 hover:text-gray-700 dark:hover:text-gray-300'
                        }`}
                      >#{t}</button>
                    ))}
                  </div>
                )}
                <div className="flex gap-4 mt-1">
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                    <input type="radio" name="tagLogic" checked={tagLogic === 'or'}  onChange={() => setTagLogic('or')}  className="accent-yellow-500" />Au moins un
                  </label>
                  <label className="flex items-center gap-1.5 text-xs text-gray-500 dark:text-gray-400 cursor-pointer">
                    <input type="radio" name="tagLogic" checked={tagLogic === 'and'} onChange={() => setTagLogic('and')} className="accent-yellow-500" />Tous les tags
                  </label>
                </div>
              </div>
            )}
          </div>
          {/* Filtre épinglées */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none">
            <input type="checkbox" checked={usePinned} onChange={e => setUsePinned(e.target.checked)} className="accent-yellow-500 w-3.5 h-3.5" />
            Épinglées uniquement
          </label>
          {/* Filtre date de création */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none flex-wrap">
            <input type="checkbox" checked={useCreatedDays} onChange={e => setUseCreatedDays(e.target.checked)} className="accent-yellow-500 w-3.5 h-3.5" />
            Créées dans les
            {useCreatedDays && (
              <input type="number" min={1} max={365} value={createdDays}
                onChange={e => setCreatedDays(Math.max(1, Number(e.target.value)))}
                onClick={e => e.stopPropagation()}
                className="w-14 px-2 py-0.5 bg-gray-100 dark:bg-[#0d1117] border border-gray-300 dark:border-dark-600 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50 text-center"
              />
            )}
            derniers jours
          </label>
          {/* Filtre date de modification */}
          <label className="flex items-center gap-2 text-sm text-gray-700 dark:text-gray-300 cursor-pointer select-none flex-wrap">
            <input type="checkbox" checked={useModifiedDays} onChange={e => setUseModifiedDays(e.target.checked)} className="accent-yellow-500 w-3.5 h-3.5" />
            Modifiées dans les
            {useModifiedDays && (
              <input type="number" min={1} max={365} value={modifiedDays}
                onChange={e => setModifiedDays(Math.max(1, Number(e.target.value)))}
                onClick={e => e.stopPropagation()}
                className="w-14 px-2 py-0.5 bg-gray-100 dark:bg-[#0d1117] border border-gray-300 dark:border-dark-600 rounded text-xs text-gray-900 dark:text-white focus:outline-none focus:ring-1 focus:ring-yellow-500/50 text-center"
              />
            )}
            derniers jours
          </label>
        </div>
        {/* Boutons Annuler / Créer */}
        <div className="px-5 py-3 border-t border-gray-200 dark:border-dark-700 flex justify-end gap-2">
          <button type="button" onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 dark:hover:text-white transition-colors">Annuler</button>
          <button type="button" onClick={handleSubmit} className="px-4 py-1.5 text-sm bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30 rounded-lg transition-colors flex items-center gap-1.5">
            <Zap size={12} />{initial ? 'Enregistrer' : 'Créer'}
          </button>
        </div>
      </div>
    </div>
  );
}
