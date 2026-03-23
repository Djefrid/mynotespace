/**
 * ============================================================================
 * ERROR BOUNDARY — components/NotesEditorErrorBoundary.tsx
 * ============================================================================
 *
 * Composant React Error Boundary qui capture les erreurs JavaScript non
 * gérées dans l'arbre des composants enfants (notamment NotesEditor).
 *
 * Sans ce composant, une erreur dans TipTap (ex: regex invalide dans un
 * plugin de syntaxe, erreur Excalidraw, crash extension) ferait afficher
 * une page blanche à l'utilisateur sans explication.
 *
 * Avec ce composant, l'utilisateur voit un message clair et un bouton
 * "Recharger" pour récupérer sans perdre l'état Firestore (les notes
 * sont persistées côté serveur).
 *
 * Note : les Error Boundaries doivent être des class components (React 18).
 * Les hooks ne supportent pas encore componentDidCatch().
 * ============================================================================
 */

"use client";

import { Component, ErrorInfo, ReactNode } from 'react';

interface Props {
  /** Contenu à protéger (NotesEditor et ses enfants) */
  children: ReactNode;
}

interface State {
  /** true si une erreur non gérée a été capturée */
  hasError: boolean;
  /** Message d'erreur pour affichage en mode développement */
  errorMessage: string;
}

/**
 * Capture les erreurs React dans l'arbre des enfants.
 * Affiche un fallback élégant au lieu d'une page blanche.
 */
export class NotesEditorErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, errorMessage: '' };
  }

  /**
   * Mis à jour de l'état lors d'une erreur.
   * Déclenché pendant le rendu, avant componentDidCatch.
   */
  static getDerivedStateFromError(error: Error): State {
    return {
      hasError:     true,
      errorMessage: error.message ?? 'Erreur inconnue',
    };
  }

  /**
   * Journalise l'erreur et les infos de contexte.
   * En production, on pourrait envoyer vers Sentry ou un service de logs.
   */
  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[NotesEditorErrorBoundary] Erreur capturée :', error, info);
  }

  /** Recharge la page pour rétablir l'état normal de l'éditeur */
  handleReload = () => {
    window.location.reload();
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-full gap-6 text-center p-8">
          {/* Icône d'erreur */}
          <div className="text-5xl">⚠️</div>

          {/* Message principal */}
          <div>
            <h2 className="text-gray-900 dark:text-white text-lg font-semibold mb-2">
              L&apos;éditeur a rencontré une erreur
            </h2>
            <p className="text-gray-500 dark:text-gray-400 text-sm max-w-sm">
              Une erreur inattendue s&apos;est produite. Vos notes sont en sécurité —
              elles ont été sauvegardées automatiquement.
            </p>
            {/* Message technique visible en dev uniquement */}
            {process.env.NODE_ENV === 'development' && (
              <p className="text-red-500 dark:text-red-400 text-xs mt-2 font-mono">
                {this.state.errorMessage}
              </p>
            )}
          </div>

          {/* Bouton de récupération */}
          <button
            type="button"
            onClick={this.handleReload}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-400 text-black font-medium rounded-lg text-sm transition-colors"
          >
            Recharger l&apos;éditeur
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
