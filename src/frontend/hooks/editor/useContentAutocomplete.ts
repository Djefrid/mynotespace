/**
 * ============================================================================
 * HOOK AUTOCOMPLÉTION CONTENU — hooks/notes/useContentAutocomplete.ts
 * ============================================================================
 *
 * Gère la détection et l'application des suggestions dans l'éditeur TipTap :
 *   - Tags (#tag, #partial) → popup de suggestions
 *   - Slash commands (/h1, /ul…) → menu contextuel
 *
 * Utilise `editorRef` (MutableRefObject) plutôt qu'une instance Editor directe
 * pour éviter la dépendance circulaire avec useNoteEditor :
 *   - useNoteEditor a besoin des refs de ce hook pour ses editorProps
 *   - Ce hook a besoin de l'éditeur pour ses callbacks
 * Solution : l'éditeur est partagé via un ref commun créé dans NotesEditor.
 *
 * Refs anti-stale-closure :
 *   detectAtCursorRef, applySuggestionRef, applySlashRef, suggestionsRef,
 *   suggestionIdxRef, slashMenuRef, slashIdxRef → passés à useNoteEditor
 *   pour que les editorProps (handleKeyDown, onUpdate) y accèdent sans stale.
 * ============================================================================
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { SLASH_CMDS } from '@/lib/notes-types';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useContentAutocomplete({
  editorRef,
  allTags,
}: {
  /** Ref partagée vers l'instance TipTap — créée dans NotesEditor, peuplée par useNoteEditor */
  editorRef: MutableRefObject<Editor | null>;
  /** Liste de tous les tags connus (union notes + manuels) */
  allTags:   string[];
}) {

  // ── État suggestions de tags ────────────────────────────────────────────────
  const [suggestions,   setSuggestions]   = useState<string[]>([]);
  const [suggestionIdx, setSuggestionIdx] = useState(-1);

  // ── État slash commands ─────────────────────────────────────────────────────
  const [slashMenu,   setSlashMenu]   = useState(false);
  const [slashFilter, setSlashFilter] = useState('');
  const [slashIdx,    setSlashIdx]    = useState(0);

  // ── Refs anti-stale-closure ─────────────────────────────────────────────────
  // Transmises à useNoteEditor pour ses editorProps (handleKeyDown, onUpdate, onSelectionUpdate).
  const suggestionsRef     = useRef<string[]>([]);
  const suggestionIdxRef   = useRef(-1);
  const applySuggestionRef = useRef<(item: string) => void>(() => {});
  const slashMenuRef       = useRef(false);
  const slashIdxRef        = useRef(0);
  const applySlashRef      = useRef<(idx: number) => void>(() => {});
  const detectAtCursorRef  = useRef<() => void>(() => {});

  // Synchronisation state → ref
  useEffect(() => { suggestionsRef.current   = suggestions;   }, [suggestions]);
  useEffect(() => { suggestionIdxRef.current = suggestionIdx; }, [suggestionIdx]);
  useEffect(() => { slashMenuRef.current     = slashMenu;     }, [slashMenu]);
  useEffect(() => { slashIdxRef.current      = slashIdx;      }, [slashIdx]);

  /** Reset l'index de navigation quand les suggestions changent */
  useEffect(() => { setSuggestionIdx(-1); }, [suggestions]);

  // ── Détection au curseur ────────────────────────────────────────────────────
  /**
   * Analyse le texte avant le curseur.
   * Utilise editorRef.current pour ne pas recréer la closure à chaque render.
   * Priorité 0 : slash command → ouvre menu.
   * Priorité 1 : hashtag → affiche suggestions.
   */
  const detectAtCursor = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || editor.isDestroyed) return;
    const { $from } = editor.state.selection;
    const textBefore = $from.parent.textContent.slice(0, $from.parentOffset);

    // Priorité 0 : slash command en début de paragraphe
    const slashMatch = textBefore.match(/^\/([a-zA-Z]*)$/);
    if (slashMatch) {
      setSlashFilter(slashMatch[1].toLowerCase());
      setSlashMenu(true);
      setSlashIdx(0);
      return;
    }
    if (slashMenuRef.current) setSlashMenu(false);

    // Priorité 1 : hashtag
    const tagMatch = textBefore.match(/#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)?$/);
    if (tagMatch) {
      const partial = (tagMatch[1] ?? '').toLowerCase();
      const filtered = partial
        ? allTags.filter(t => t.includes(partial) && t !== partial)
        : allTags;
      setSuggestions(filtered.slice(0, 6));
      return;
    }

    setSuggestions([]);
  }, [editorRef, allTags]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { detectAtCursorRef.current = detectAtCursor; }, [detectAtCursor]);

  // ── Appliquer une suggestion de tag ────────────────────────────────────────
  /**
   * Remplace le "#partial" avant le curseur par "#tag " complet.
   * Utilise editorRef.current pour accéder à l'éditeur stable.
   */
  const applySuggestion = useCallback((item: string) => {
    const editor = editorRef.current;
    if (!editor) return;
    const { state } = editor;
    const { from }  = state.selection;
    const textBefore = state.selection.$from.parent.textContent.slice(0, state.selection.$from.parentOffset);
    const m = textBefore.match(/#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)?$/);
    if (m) {
      editor.chain().focus()
        .deleteRange({ from: from - m[0].length, to: from })
        .insertContent(`#${item} `)
        .run();
    }
    setSuggestions([]);
  }, [editorRef]);

  useEffect(() => { applySuggestionRef.current = applySuggestion; }, [applySuggestion]);

  // ── Appliquer une slash command ─────────────────────────────────────────────
  /**
   * Applique la commande filtrée à l'index `idx`.
   * Supprime d'abord le "/" + filtre, puis insère le nœud TipTap.
   */
  const applySlashCommand = useCallback((idx: number) => {
    const editor = editorRef.current;
    if (!editor) return;
    const filteredCmds = SLASH_CMDS.filter(c =>
      !slashFilter || c.id.startsWith(slashFilter) || c.label.toLowerCase().startsWith(slashFilter)
    );
    const cmd = filteredCmds[idx];
    if (!cmd) { setSlashMenu(false); return; }
    const { state } = editor;
    const { from, $from } = state.selection;
    const blockStart = from - $from.parentOffset;
    editor.chain().focus().deleteRange({ from: blockStart, to: from }).run();
    cmd.apply(editor);
    setSlashMenu(false);
  }, [editorRef, slashFilter]);

  useEffect(() => { applySlashRef.current = applySlashCommand; }, [applySlashCommand]);

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    suggestions,   setSuggestions,
    suggestionIdx, setSuggestionIdx,
    slashMenu,     setSlashMenu,
    slashFilter,
    slashIdx,      setSlashIdx,
    detectAtCursor,
    applySuggestion,
    applySlashCommand,
    suggestionsRef,
    suggestionIdxRef,
    applySuggestionRef,
    slashMenuRef,
    slashIdxRef,
    applySlashRef,
    detectAtCursorRef,
  };
}
