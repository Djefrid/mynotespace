/**
 * ============================================================================
 * PAGE NOTES — app/notes/page.tsx
 * ============================================================================
 *
 * Page principale de mynotespace.
 * Charge l'éditeur de notes complet (NotesEditor) après vérification d'auth.
 *
 * Garde d'authentification :
 *   - Si loading → spinner
 *   - Si non connecté ou non admin → redirige vers /login
 *   - Si connecté et admin → affiche NotesEditor
 *
 * NotesEditor est chargé en dynamic import (SSR: false) car il contient :
 *   - TipTap editor (manipulation DOM directe)
 *   - Excalidraw (SSR-incompatible, accède à window)
 *   - localStorage (côté client uniquement)
 * ============================================================================
 */

'use client';

import { useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { NotesEditorErrorBoundary } from '@/components/NotesEditorErrorBoundary';

/**
 * NotesEditor chargé dynamiquement côté client uniquement.
 * Spinner affiché pendant le chargement du chunk JS (TipTap + Excalidraw = ~500 kB).
 */
const NotesEditor = dynamic(() => import('@/components/NotesEditor'), {
  ssr: false,
  loading: () => (
    // Écran de chargement pendant l'initialisation de l'éditeur
    <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-700">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-sm">Chargement de l&apos;éditeur…</p>
      </div>
    </div>
  ),
});

/**
 * Page principale — affiche l'éditeur Notes après vérification d'authentification.
 */
export default function NotesPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  useEffect(() => {
    if (status === 'unauthenticated') {
      router.replace('/login');
    }
  }, [status, router]);

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white dark:bg-dark-700">
        <div className="w-8 h-8 border-2 border-primary-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return null;
  }

  // ── Éditeur Notes ─────────────────────────────────────────────────────────
  return (
    <main id="main-content">
      {/* Error Boundary : capture les crashs TipTap/Excalidraw → fallback élégant */}
      <NotesEditorErrorBoundary>
        <NotesEditor />
      </NotesEditorErrorBoundary>
    </main>
  );
}
