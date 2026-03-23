/**
 * ============================================================================
 * EXTENSION TIPTAP — lib/tiptap-extensions/indent.ts
 * ============================================================================
 *
 * Extension d'indentation personnalisée pour TipTap (style Word).
 * Ajoute les commandes `indent` et `outdent` sur Tab / Shift+Tab
 * pour les blocs de texte (paragraphe, titre, citation).
 *
 * Fonctionnement :
 *   - L'indentation est stockée comme attribut `indent` (valeur en px)
 *     sur chaque nœud de bloc supporté
 *   - Rendue en CSS : `style="margin-left: Xpx"`
 *   - Parsed depuis le HTML existant via `element.style.marginLeft`
 *   - Pas de retrait négatif : minimum 0px
 *   - Maximum : 280px (7 niveaux à 40px chacun)
 *
 * Priorité 100 (basse) :
 *   Le Tab est traité en DERNIER par rapport aux extensions de listes
 *   (StarterKit, TaskList). Quand le curseur est dans une liste, Tab
 *   doit déclencher le sink/lift natif de TipTap (indenter la liste),
 *   pas l'indent de paragraphe.
 *
 * Types supportés :
 *   - BLOCK_TYPES (paragraph, heading, blockquote) → indent via margin-left
 *   - LIST_TYPES (listItem, taskItem) → Tab laissé aux extensions liste
 *
 * Augmentation du module @tiptap/core :
 *   Déclare les commandes `indent` / `outdent` dans l'interface Commands
 *   pour que TypeScript accepte `editor.commands.indent()` sans erreur.
 * ============================================================================
 */

import { Extension } from '@tiptap/core';
import type { EditorState } from '@tiptap/pm/state';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    indent: {
      /** Augmente le retrait de INDENT_STEP px (Tab hors liste) */
      indent: () => ReturnType;
      /** Réduit le retrait de INDENT_STEP px (Shift+Tab hors liste) */
      outdent: () => ReturnType;
    };
  }
}

/** Valeur d'un niveau d'indentation en pixels */
const INDENT_STEP = 40;
/** Valeur maximale d'indentation (7 niveaux × 40px) */
const MAX_INDENT  = 280;

/** Nœuds de type liste — Tab leur appartient (sink/lift list item natif TipTap) */
const LIST_TYPES = ['listItem', 'taskItem'];
/** Nœuds qui acceptent l'indent custom via margin-left */
const BLOCK_TYPES = ['paragraph', 'heading', 'blockquote'];

/**
 * Vérifie si la sélection courante est entièrement à l'intérieur d'une liste.
 * Remonte l'arbre ProseMirror depuis `$from` jusqu'à la racine.
 * @param state - L'état courant de l'éditeur ProseMirror
 * @returns true si le curseur est dans un listItem ou taskItem
 */
function isInList(state: EditorState): boolean {
  const { $from } = state.selection;
  for (let d = $from.depth; d > 0; d--) {
    const node = $from.node(d);
    if (LIST_TYPES.includes(node.type.name)) return true;
  }
  return false;
}

export const Indent = Extension.create({
  name: 'indent',

  // Priorité basse pour que Tab soit d'abord traité par les extensions de listes
  priority: 100,

  addOptions() {
    return { types: [...BLOCK_TYPES] };
  },

  /**
   * Enregistre l'attribut `indent` sur tous les types de blocs supportés.
   * - parseHTML : lit `style.marginLeft` depuis le HTML collé ou importé
   * - renderHTML : génère `style="margin-left: Xpx"` dans le HTML TipTap
   */
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          indent: {
            default: 0,
            parseHTML: element => {
              const ml = parseInt(element.style.marginLeft || '0', 10);
              return isNaN(ml) ? 0 : ml;
            },
            renderHTML: attributes => {
              if (!attributes.indent) return {};
              return { style: `margin-left: ${attributes.indent}px` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      /**
       * Augmente le retrait de tous les blocs dans la sélection.
       * Plafonne à MAX_INDENT (280px).
       */
      indent: () => ({ tr, state, dispatch }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            const current = (node.attrs.indent as number) || 0;
            const next    = Math.min(current + INDENT_STEP, MAX_INDENT);
            if (next !== current) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
              changed = true;
            }
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      },

      /**
       * Réduit le retrait de tous les blocs dans la sélection.
       * Plancher à 0 (pas de retrait négatif).
       */
      outdent: () => ({ tr, state, dispatch }) => {
        const { from, to } = state.selection;
        let changed = false;
        state.doc.nodesBetween(from, to, (node, pos) => {
          if (this.options.types.includes(node.type.name)) {
            const current = (node.attrs.indent as number) || 0;
            const next    = Math.max(current - INDENT_STEP, 0);
            if (next !== current) {
              tr.setNodeMarkup(pos, undefined, { ...node.attrs, indent: next });
              changed = true;
            }
          }
        });
        if (changed && dispatch) dispatch(tr);
        return changed;
      },
    };
  },

  addKeyboardShortcuts() {
    return {
      // Tab hors liste → indent de paragraphe
      // En liste → `return false` laisse passer aux extensions TipTap (sink/lift)
      Tab: ({ editor }) => {
        if (isInList(editor.state)) return false;
        return editor.commands.indent();
      },
      'Shift-Tab': ({ editor }) => {
        if (isInList(editor.state)) return false;
        return editor.commands.outdent();
      },
    };
  },
});
