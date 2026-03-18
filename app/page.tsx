/**
 * ============================================================================
 * PAGE RACINE — app/page.tsx
 * ============================================================================
 *
 * Page d'accueil : redirige immédiatement vers /notes.
 * La garde d'authentification est gérée dans app/notes/page.tsx —
 * si non connecté, l'utilisateur sera redirigé vers /login.
 * ============================================================================
 */

import { redirect } from 'next/navigation';

/**
 * Redirige la racine vers /notes.
 * Redirect permanente (308) — le navigateur mémorise et va directement à /notes.
 */
export default function HomePage() {
  redirect('/notes');
}
