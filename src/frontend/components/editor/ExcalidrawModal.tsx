/**
 * ============================================================================
 * MODAL EXCALIDRAW — components/notes/ExcalidrawModal.tsx
 * ============================================================================
 *
 * Modal plein-écran pour dessiner avec Excalidraw.
 * Export → PNG → Firebase Storage → image inline dans l'éditeur TipTap.
 *
 * Props :
 *   excalidrawModal     — état courant (null = fermé)
 *   setExcalidrawModal  — setter (null pour fermer)
 *   insertExcalidraw    — exporte la scène et l'insère dans l'éditeur
 *   uploadProgress      — progression upload Firebase (0-100 | null)
 *   excalidrawApiRef    — ref vers l'API impérative Excalidraw (pour export)
 *   ExcalidrawComponent — composant Excalidraw chargé dynamiquement (SSR-safe)
 * ============================================================================
 */

"use client";

import { Pencil, X } from 'lucide-react';
import type { MutableRefObject, ComponentType } from 'react';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Données du modal Excalidraw */
export interface ExcalidrawModalState {
  open:         boolean;
  initialData?: Record<string, unknown>;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function ExcalidrawModal({
  excalidrawModal,
  setExcalidrawModal,
  insertExcalidraw,
  uploadProgress,
  excalidrawApiRef,
  ExcalidrawComponent,
}: {
  excalidrawModal:     ExcalidrawModalState | null;
  setExcalidrawModal:  (m: ExcalidrawModalState | null) => void;
  insertExcalidraw:    () => void;
  uploadProgress:      number | null;
  excalidrawApiRef:    MutableRefObject<ExcalidrawImperativeAPI | null>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ExcalidrawComponent: ComponentType<any>;
}) {
  if (!excalidrawModal?.open) return null;

  return (
    <div className="fixed inset-0 z-[200] flex flex-col bg-gray-50 dark:bg-dark-950">
      {/* ── Header ── */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-200 dark:border-dark-800 shrink-0 bg-white dark:bg-dark-900">
        <Pencil size={14} className="text-yellow-500 dark:text-yellow-400" />
        <span className="text-sm font-semibold text-gray-800 dark:text-gray-200">Dessin</span>
        <span className="text-xs text-gray-500">
          Glissez-déposez un fichier .excalidraw pour l&apos;ouvrir
        </span>
        <div className="ml-auto flex items-center gap-2">
          {/* Progression upload Firebase */}
          {uploadProgress !== null && (
            <span className="text-xs text-yellow-500 dark:text-yellow-400">{uploadProgress}%</span>
          )}
          {/* Bouton export → insérer dans la note */}
          <button
            type="button"
            onClick={insertExcalidraw}
            className="text-xs px-3 py-1.5 rounded bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30 transition-colors font-medium"
          >
            Insérer dans la note
          </button>
          {/* Bouton fermer */}
          <button
            type="button"
            title="Fermer"
            onClick={() => setExcalidrawModal(null)}
            className="p-1 text-gray-400 hover:text-gray-700 dark:hover:text-white rounded transition-colors"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* ── Canvas Excalidraw ── */}
      <div className="flex-1 overflow-hidden">
        <ExcalidrawComponent
          excalidrawAPI={(api: ExcalidrawImperativeAPI) => { excalidrawApiRef.current = api; }}
          initialData={excalidrawModal.initialData}
          theme="dark"
          UIOptions={{ canvasActions: { saveToActiveFile: false, loadScene: false } }}
        />
      </div>
    </div>
  );
}
