/**
 * ============================================================================
 * POPUP LIEN BUBBLE MENU — components/notes/BubbleLinkPopup.tsx
 * ============================================================================
 *
 * Popup d'édition de lien affichée dans le BubbleMenu TipTap.
 * Apparaît quand l'utilisateur clique sur le bouton lien du BubbleMenu.
 *
 * Props :
 *   open           — true = popup visible
 *   value          — valeur courante du champ URL
 *   onChange       — met à jour la valeur URL
 *   onConfirm      — applique le lien (Enter ou clic OK)
 *   onClose        — ferme la popup sans appliquer
 * ============================================================================
 */

"use client";

// ── Composant ─────────────────────────────────────────────────────────────────

export default function BubbleLinkPopup({
  open,
  value,
  onChange,
  onConfirm,
  onClose,
}: {
  open:      boolean;
  value:     string;
  onChange:  (v: string) => void;
  onConfirm: () => void;
  onClose:   () => void;
}) {
  if (!open) return null;

  return (
    <div
      className="absolute top-full left-1/2 -translate-x-1/2 mt-1 z-50 bg-white dark:bg-dark-800 border border-gray-200 dark:border-dark-600 rounded-lg p-2 shadow-xl flex gap-1.5 min-w-[200px]"
      onMouseDown={e => e.stopPropagation()}
    >
      {/* Champ URL */}
      <input
        name="bubble-link-url"
        autoFocus
        value={value}
        onChange={e => onChange(e.target.value)}
        onKeyDown={e => {
          if (e.key === 'Enter')  { onConfirm(); }
          if (e.key === 'Escape') { onClose(); }
        }}
        placeholder="https://..."
        className="flex-1 text-xs bg-gray-100 dark:bg-dark-700 text-gray-800 dark:text-gray-200 placeholder-gray-400 rounded px-2 py-1 focus:outline-none border border-gray-300 dark:border-dark-600 focus:border-yellow-500/50"
      />
      {/* Bouton OK */}
      <button
        type="button"
        onMouseDown={e => {
          e.preventDefault();
          onConfirm();
        }}
        className="text-xs px-2 py-1 bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/30 rounded transition-colors"
      >
        OK
      </button>
    </div>
  );
}
