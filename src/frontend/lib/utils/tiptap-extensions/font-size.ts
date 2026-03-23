/**
 * ============================================================================
 * EXTENSION TIPTAP — lib/tiptap-extensions/font-size.ts
 * ============================================================================
 *
 * Extension de taille de police personnalisée pour TipTap.
 * Complète l'extension `TextStyle` de `@tiptap/extension-text-style`
 * (obligatoire comme dépendance).
 *
 * Fonctionnement :
 *   - Ajoute l'attribut `fontSize` sur le mark `textStyle`
 *   - parseHTML : lit `element.style.fontSize` (ex : "12pt", "1.2em")
 *   - renderHTML : génère `style="font-size: 12pt"` sur les spans textStyle
 *   - setFontSize(size)  : applique la taille (ex: "12pt", "16px")
 *   - unsetFontSize()    : supprime la taille + retire le mark si vide
 *                          (`removeEmptyTextStyle` évite des spans orphelins)
 *
 * Intégration avec l'éditeur :
 *   - La toolbar lit la valeur via `editor.getAttributes('textStyle').fontSize`
 *   - Affiche la liste FONT_SIZES dans un <select> (8pt à 72pt)
 *   - La valeur stockée est en points (ex : "12pt") car c'est le format
 *     standard Word — plus lisible que les rem/px
 *
 * Augmentation du module @tiptap/core :
 *   Déclare `setFontSize` et `unsetFontSize` dans l'interface Commands
 *   pour que TypeScript accepte ces commandes sans erreur de type.
 *
 * Note : TipTap 3 fournit nativement FontFamily, FontSize, LineHeight
 * via `@tiptap/extension-text-style`. Cette extension custom est conservée
 * pour garantir la compatibilité avec le format "pt" utilisé dans la toolbar.
 * ============================================================================
 */

import { Extension } from '@tiptap/core';
import '@tiptap/extension-text-style';

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    fontSize: {
      /** Applique une taille de police (ex: "12pt", "16px", "1.2em") */
      setFontSize: (size: string) => ReturnType;
      /** Supprime la taille de police et retire le mark textStyle si vide */
      unsetFontSize: () => ReturnType;
    };
  }
}

export const FontSize = Extension.create({
  name: 'fontSize',

  addOptions() {
    return { types: ['textStyle'] };
  },

  /**
   * Enregistre l'attribut `fontSize` sur le mark `textStyle`.
   * - parseHTML : extrait la valeur CSS `font-size` depuis le style inline
   * - renderHTML : génère `style="font-size: Xpt"` sur le span textStyle
   */
  addGlobalAttributes() {
    return [
      {
        types: this.options.types,
        attributes: {
          fontSize: {
            default: null,
            parseHTML: element => element.style.fontSize || null,
            renderHTML: attributes => {
              if (!attributes.fontSize) return {};
              return { style: `font-size: ${attributes.fontSize}` };
            },
          },
        },
      },
    ];
  },

  addCommands() {
    return {
      /**
       * Applique la taille de police via setMark sur textStyle.
       * Utilise `chain()` pour combiner plusieurs opérations atomiquement.
       */
      setFontSize: (size: string) => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: size }).run();
      },
      /**
       * Supprime la taille de police (fontSize: null).
       * `removeEmptyTextStyle` retire le span <span style=""> vide
       * qui resterait sans aucun attribut de style.
       */
      unsetFontSize: () => ({ chain }) => {
        return chain().setMark('textStyle', { fontSize: null }).removeEmptyTextStyle().run();
      },
    };
  },
});
