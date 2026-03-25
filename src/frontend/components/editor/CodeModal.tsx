/**
 * ============================================================================
 * MODAL BLOC DE CODE — components/notes/CodeModal.tsx
 * ============================================================================
 *
 * Modal d'édition d'un bloc de code TipTap.
 * Modes :
 *   - Création  : `isEdit = false` — bloc vide à insérer
 *   - Édition   : `isEdit = true`  — remplace le bloc existant (from/to ProseMirror)
 *
 * Props :
 *   codeModal        — état courant du modal (null = fermé)
 *   setCodeModal     — setter de l'état (null pour fermer)
 *   codeModalCopied  — true pendant ~1.5s après copie (feedback visuel)
 *   setCodeModalCopied
 *   applyCodeModal   — applique le contenu dans l'éditeur TipTap
 *   languages        — liste des langages dispo (LANGUAGES depuis notes-types)
 * ============================================================================
 */

"use client";

import { Code2, X } from 'lucide-react';
import type { LANGUAGES } from '@/lib/notes-types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** État interne du modal */
export interface CodeModalState {
  open:   boolean;
  code:   string;
  lang:   string;
  isEdit: boolean;
  from:   number;
  to:     number;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function CodeModal({
  codeModal,
  setCodeModal,
  codeModalCopied,
  setCodeModalCopied,
  applyCodeModal,
  languages,
}: {
  codeModal:            CodeModalState | null;
  setCodeModal:         (m: CodeModalState | null | ((prev: CodeModalState | null) => CodeModalState | null)) => void;
  codeModalCopied:      boolean;
  setCodeModalCopied:   (v: boolean) => void;
  applyCodeModal:       () => void;
  /** Liste des langages dispo — LANGUAGES depuis lib/notes-types */
  languages:            typeof LANGUAGES;
}) {
  if (!codeModal?.open) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={() => setCodeModal(null)}
    >
      <div
        className="bg-white dark:bg-[#080c14] border border-gray-200 dark:border-dark-700 rounded-xl shadow-2xl w-[700px] max-w-[95vw] flex flex-col max-h-[80vh]"
        onClick={e => e.stopPropagation()}
      >
        {/* ── Header ── */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-100 dark:border-dark-800 shrink-0">
          <Code2 size={14} className="text-yellow-500 dark:text-yellow-400" />
          <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">
            {codeModal.isEdit ? 'Modifier le bloc de code' : 'Nouveau bloc de code'}
          </span>
          <div className="ml-auto flex items-center gap-2">
            {/* Sélecteur de langage */}
            <select
              title="Langage du bloc de code"
              value={codeModal.lang}
              onChange={e => setCodeModal(m => m ? { ...m, lang: e.target.value } : m)}
              className="text-xs bg-gray-100 dark:bg-[#111520] text-gray-700 dark:text-gray-300 border border-gray-300 dark:border-dark-600 rounded px-2 py-1 focus:outline-none focus:border-yellow-500/50 cursor-pointer"
            >
              {languages.map(l => <option key={l.value} value={l.value}>{l.label}</option>)}
            </select>
            {/* Bouton fermer */}
            <button
              type="button"
              title="Fermer"
              onClick={() => setCodeModal(null)}
              className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded transition-colors"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Zone de code ── */}
        <textarea
          value={codeModal.code}
          onChange={e => setCodeModal(m => m ? { ...m, code: e.target.value } : m)}
          onKeyDown={e => {
            if (e.key === 'Tab') {
              // Indentation par 2 espaces au lieu de changer de focus
              e.preventDefault();
              const el    = e.currentTarget;
              const start = el.selectionStart ?? 0;
              const end   = el.selectionEnd   ?? 0;
              const next  = el.value.substring(0, start) + '  ' + el.value.substring(end);
              setCodeModal(m => m ? { ...m, code: next } : m);
              setTimeout(() => { el.selectionStart = el.selectionEnd = start + 2; }, 0);
            } else if (e.key === 'Escape') {
              setCodeModal(null);
            }
          }}
          placeholder="Écrivez votre code ici…"
          autoFocus
          spellCheck={false}
          className="code-modal-textarea flex-1 bg-gray-950 dark:bg-[#080c14] text-gray-100 dark:text-gray-200 text-sm px-4 py-3 resize-none focus:outline-none min-h-[320px] overflow-y-auto"
        />

        {/* ── Footer ── */}
        <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 dark:border-dark-800 shrink-0">
          {/* Bouton copier */}
          <button
            type="button"
            onClick={() => {
              if (!codeModal.code) return;
              navigator.clipboard.writeText(codeModal.code).then(() => {
                setCodeModalCopied(true);
                setTimeout(() => setCodeModalCopied(false), 1500);
              });
            }}
            className="text-xs text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            {codeModalCopied ? <span className="text-green-500 dark:text-green-400">✓ Copié</span> : 'Copier'}
          </button>
          <div className="flex items-center gap-2">
            {/* Annuler */}
            <button
              type="button"
              onClick={() => setCodeModal(null)}
              className="text-xs px-3 py-1.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-[#111520] transition-colors"
            >
              Annuler
            </button>
            {/* Insérer / Mettre à jour */}
            <button
              type="button"
              onClick={applyCodeModal}
              className="text-xs px-3 py-1.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30 transition-colors font-medium"
            >
              {codeModal.isEdit ? 'Mettre à jour' : 'Insérer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
