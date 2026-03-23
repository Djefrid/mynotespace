"use client";

interface ConfirmModalProps {
  /** Titre affiché en haut de la modale */
  title: string;
  /** Message explicatif */
  message: string;
  /** Libellé du bouton de confirmation (défaut : "Confirmer") */
  confirmLabel?: string;
  /** Variante de couleur du bouton (défaut : "danger") */
  variant?: 'danger' | 'warning';
  /** Appelé quand l'utilisateur confirme */
  onConfirm: () => void;
  /** Appelé quand l'utilisateur annule */
  onCancel: () => void;
}

/**
 * Modale de confirmation générique — remplace window.confirm().
 * Usage : conditionner l'affichage avec un état boolean (showModal).
 */
export default function ConfirmModal({
  title,
  message,
  confirmLabel = 'Confirmer',
  variant = 'danger',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  const btnClass =
    variant === 'danger'
      ? 'bg-red-600 hover:bg-red-500 text-white'
      : 'bg-yellow-600 hover:bg-yellow-500 text-white';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-labelledby="confirm-modal-title"
    >
      <div className="bg-white dark:bg-[#111520] border border-gray-200 dark:border-dark-600 rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
        <h2
          id="confirm-modal-title"
          className="text-base font-semibold text-gray-900 dark:text-white mb-2"
        >
          {title}
        </h2>
        <p className="text-sm text-gray-500 dark:text-gray-400 mb-6">{message}</p>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 text-sm rounded-lg border border-gray-300 dark:border-dark-600 text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#1a2030] transition-colors"
          >
            Annuler
          </button>
          <button
            type="button"
            onClick={onConfirm}
            className={`px-4 py-2 text-sm rounded-lg font-medium transition-colors ${btnClass}`}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
