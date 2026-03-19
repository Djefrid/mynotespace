/**
 * ============================================================================
 * HOOK AUTOCOMPLÉTION TITRE — hooks/notes/useTitleAutocomplete.ts
 * ============================================================================
 *
 * Gère l'autocomplétion des tags (#tag) dans le champ titre.
 * Identique à la logique contenu, mais opère sur un <input> HTML (pas TipTap).
 *
 * Fonctionnalités :
 *   - Détection "#partial" dans le titre → popup de suggestions
 *   - Navigation ↑↓ · Tab · Enter (accepte) · Escape (ferme)
 *   - Remplacement du "#partial" par le tag complet dans l'input
 *
 * Paramètres reçus :
 *   allTags          — tous les tags connus (pour suggestions)
 *   title            — valeur courante du titre
 *   content          — contenu HTML courant (pour autosave après remplacement)
 *   setTitle         — setter du titre (useState stable)
 *   scheduleAutoSave — planifie une sauvegarde différée
 *   titleRef         — ref vers l'<input> du titre (pour positionner le curseur)
 * ============================================================================
 */

import { useState, useCallback } from 'react';
import type { MutableRefObject } from 'react';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useTitleAutocomplete({
  allTags,
  title,
  content,
  setTitle,
  scheduleAutoSave,
  titleRef,
}: {
  /** Tous les tags connus (union notes + manuels) */
  allTags:          string[];
  /** Valeur courante du titre */
  title:            string;
  /** Contenu HTML courant (nécessaire pour l'autosave après remplacement) */
  content:          string;
  /** Setter du titre — stable (useState) */
  setTitle:         (v: string) => void;
  /** Planifie une sauvegarde différée après modification du titre */
  scheduleAutoSave: (t: string, c: string) => void;
  /** Ref vers l'<input> du titre — pour repositionner le curseur */
  titleRef:         MutableRefObject<HTMLInputElement | null>;
}) {

  // ── État suggestions ────────────────────────────────────────────────────────
  /** Suggestions de tags affichées sous le titre */
  const [titleSuggs,   setTitleSuggs]   = useState<string[]>([]);
  /** Index de la suggestion mise en avant (−1 = aucune) */
  const [titleSuggIdx, setTitleSuggIdx] = useState(-1);

  // ── Appliquer une suggestion ────────────────────────────────────────────────
  /**
   * Remplace le "#partial" avant le curseur dans le titre par "#tag ".
   * Repositionne le curseur immédiatement après le tag inséré.
   */
  const applyTitleSugg = useCallback((item: string) => {
    const el = titleRef.current;
    if (!el) return;
    const cursor     = el.selectionStart ?? title.length;
    const textBefore = title.slice(0, cursor);
    const tagMatch   = textBefore.match(/#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)?$/);
    if (tagMatch) {
      const start    = cursor - tagMatch[0].length;
      const newTitle = title.slice(0, start) + '#' + item + ' ' + title.slice(cursor);
      setTitle(newTitle);
      scheduleAutoSave(newTitle, content);
      // setTimeout 0 → le DOM est mis à jour avant le repositionnement du curseur
      setTimeout(() => {
        const p = start + item.length + 2;
        el.setSelectionRange(p, p);
      }, 0);
    }
    setTitleSuggs([]);
    setTitleSuggIdx(-1);
  }, [title, content, setTitle, scheduleAutoSave, titleRef]);

  // ── Navigation clavier ──────────────────────────────────────────────────────
  /**
   * Gère ↑↓ Tab Enter Escape dans le champ titre quand les suggestions sont ouvertes.
   * À brancher sur `onKeyDown` de l'<input> titre.
   */
  const handleTitleSuggKey = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (titleSuggs.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setTitleSuggIdx(i => Math.min(i + 1, titleSuggs.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setTitleSuggIdx(i => Math.max(i - 1, -1));
    } else if ((e.key === 'Tab' || e.key === 'Enter') && titleSuggIdx >= 0) {
      e.preventDefault();
      applyTitleSugg(titleSuggs[titleSuggIdx]);
    } else if (e.key === 'Tab' && titleSuggIdx === -1) {
      // Tab sans sélection → accepte la première suggestion
      e.preventDefault();
      applyTitleSugg(titleSuggs[0]);
    } else if (e.key === 'Escape') {
      setTitleSuggs([]);
    }
  };

  // ── Handler de changement de titre ─────────────────────────────────────────
  /**
   * Appelé à chaque frappe dans l'<input> titre.
   * Met à jour le titre, planifie l'autosave, puis détecte les "#partial".
   */
  const handleTitleChange = (v: string) => {
    setTitle(v);
    scheduleAutoSave(v, content);

    const el         = titleRef.current;
    const cursor     = el?.selectionStart ?? v.length;
    const textBefore = v.slice(0, cursor);

    // Détection hashtag
    const tagMatch = textBefore.match(/#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)?$/);
    if (tagMatch) {
      const partial  = (tagMatch[1] ?? '').toLowerCase();
      const filtered = partial
        ? allTags.filter(t => t.includes(partial) && t !== partial)
        : allTags;
      if (filtered.length > 0) {
        setTitleSuggs(filtered.slice(0, 6));
        setTitleSuggIdx(-1);
        return;
      }
    }

    setTitleSuggs([]);
  };

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    titleSuggs,
    titleSuggIdx,
    setTitleSuggs,
    setTitleSuggIdx,
    applyTitleSugg,
    handleTitleSuggKey,
    handleTitleChange,
  };
}
