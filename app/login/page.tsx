/**
 * ============================================================================
 * PAGE DE CONNEXION — app/login/page.tsx
 * ============================================================================
 *
 * Page de connexion à mynotespace.
 * Supporte deux méthodes d'authentification Firebase :
 *   1. Email + mot de passe (signInWithEmailAndPassword)
 *   2. Google OAuth (signInWithPopup desktop / signInWithRedirect mobile)
 *
 * Garde de sécurité :
 *   Si l'utilisateur est déjà connecté ET est admin → redirige vers /notes.
 *   Seuls les emails listés dans NEXT_PUBLIC_ADMIN_EMAIL[_2] peuvent accéder.
 *
 * getRedirectResult :
 *   Appelé au montage pour capturer le résultat du signInWithRedirect Google
 *   sur mobile (le hook useAuth() le gère aussi pour éviter les doublons).
 * ============================================================================
 */

'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getRedirectResult } from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useAuth } from '@/lib/firebase/hooks';

/**
 * Page de connexion.
 * Affiche un formulaire email/mdp + bouton Google.
 * Redirige vers /notes si déjà authentifié admin.
 */
export default function LoginPage() {
  const router = useRouter();
  const { user, loading, isAdmin, signIn, signInWithGoogle } = useAuth();

  /** Champ email du formulaire */
  const [email, setEmail]       = useState('');
  /** Champ mot de passe du formulaire */
  const [password, setPassword] = useState('');
  /** Message d'erreur affiché sous le formulaire */
  const [error, setError]       = useState('');
  /** État de chargement pendant la tentative de connexion */
  const [isLogging, setIsLogging] = useState(false);

  // ── Capture du résultat de redirect Google (mobile) ──────────────────────
  // getRedirectResult est aussi appelé dans useAuth(), mais on le répète ici
  // pour gérer les erreurs spécifiques à la page de login.
  useEffect(() => {
    if (auth) {
      getRedirectResult(auth).catch(() => {
        // Silencieux — onAuthStateChanged gère l'état final
      });
    }
  }, []);

  // ── Redirection si déjà connecté ─────────────────────────────────────────
  useEffect(() => {
    if (!loading && user && isAdmin) {
      router.replace('/notes');
    }
  }, [user, loading, isAdmin, router]);

  /**
   * Soumet le formulaire de connexion email/mdp.
   * Affiche un message d'erreur si les identifiants sont incorrects.
   */
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLogging(true);
    const { error: signInError } = await signIn(email, password);
    if (signInError) {
      setError('Email ou mot de passe incorrect.');
    }
    setIsLogging(false);
  };

  /**
   * Lance la connexion Google.
   * Desktop : popup | Mobile : redirect (retour capturé par getRedirectResult).
   */
  const handleGoogle = async () => {
    setError('');
    setIsLogging(true);
    const { error: googleError } = await signInWithGoogle();
    if (googleError) {
      setError('Connexion Google annulée ou échouée.');
      setIsLogging(false);
    }
    // Sur mobile : la page est redirigée → pas de setIsLogging(false)
  };

  // ── Affichage pendant la vérification de l'état d'auth ───────────────────
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900">
        <div className="w-8 h-8 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <main
      id="main-content"
      className="min-h-screen flex items-center justify-center bg-slate-900 px-4"
    >
      <div className="w-full max-w-sm">

        {/* En-tête */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white tracking-tight">
            MyNoteSpace
          </h1>
          <p className="text-slate-400 text-sm mt-2">Connexion requise</p>
        </div>

        {/* Formulaire email / mot de passe */}
        <form
          onSubmit={handleSubmit}
          className="bg-slate-800 rounded-2xl p-6 shadow-xl border border-slate-700 space-y-4"
        >

          {/* Champ email */}
          <div>
            <label htmlFor="email" className="block text-sm text-slate-300 mb-1">
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="admin@exemple.com"
            />
          </div>

          {/* Champ mot de passe */}
          <div>
            <label htmlFor="password" className="block text-sm text-slate-300 mb-1">
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              autoComplete="current-password"
              className="w-full px-3 py-2 bg-slate-700 border border-slate-600 rounded-lg text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              placeholder="••••••••"
            />
          </div>

          {/* Message d'erreur */}
          {error && (
            <p
              role="alert"
              aria-live="polite"
              className="text-red-400 text-sm text-center"
            >
              {error}
            </p>
          )}

          {/* Bouton soumettre */}
          <button
            type="submit"
            disabled={isLogging}
            className="w-full py-2 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg font-medium text-sm transition-colors"
          >
            {isLogging ? 'Connexion…' : 'Se connecter'}
          </button>

          {/* Séparateur */}
          <div className="relative flex items-center gap-3">
            <div className="flex-1 h-px bg-slate-600" />
            <span className="text-slate-500 text-xs">ou</span>
            <div className="flex-1 h-px bg-slate-600" />
          </div>

          {/* Bouton Google */}
          <button
            type="button"
            onClick={handleGoogle}
            disabled={isLogging}
            aria-label="Se connecter avec Google"
            className="w-full py-2 bg-white hover:bg-gray-100 disabled:opacity-50 disabled:cursor-not-allowed text-gray-800 rounded-lg font-medium text-sm transition-colors flex items-center justify-center gap-2"
          >
            {/* Icône Google SVG */}
            <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
              <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.875 2.684-6.615z"/>
              <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332A8.997 8.997 0 0 0 9 18z"/>
              <path fill="#FBBC05" d="M3.964 10.71A5.41 5.41 0 0 1 3.682 9c0-.593.102-1.17.282-1.71V4.958H.957A8.996 8.996 0 0 0 0 9c0 1.452.348 2.827.957 4.042l3.007-2.332z"/>
              <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0A8.997 8.997 0 0 0 .957 4.958L3.964 7.29C4.672 5.163 6.656 3.58 9 3.58z"/>
            </svg>
            Continuer avec Google
          </button>

        </form>
      </div>
    </main>
  );
}
