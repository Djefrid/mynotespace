/**
 * ============================================================================
 * HOOK D'AUTHENTIFICATION - Gestion de la connexion admin
 * ============================================================================
 *
 * Ce hook React gère l'authentification Firebase pour le panneau admin :
 * - Écoute l'état de connexion (connecté/déconnecté)
 * - Fournit les fonctions signIn() et signOut()
 * - Vérifie si l'utilisateur connecté est l'admin autorisé
 *
 * Les emails admins autorisés sont définis dans .env.local :
 *   NEXT_PUBLIC_ADMIN_EMAIL   — admin principal
 *   NEXT_PUBLIC_ADMIN_EMAIL_2 — admin secondaire (optionnel)
 * ============================================================================
 */

"use client";

import { useState, useEffect } from 'react';
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithRedirect,
  getRedirectResult,
  sendEmailVerification,
  User
} from 'firebase/auth';
import { auth, isFirebaseConfigured } from './config';

/**
 * Hook personnalisé pour gérer l'authentification Firebase.
 *
 * Retourne :
 * - user : L'utilisateur connecté (ou null)
 * - loading : true pendant la vérification initiale de l'état de connexion
 * - signIn(email, password) : Fonction pour se connecter
 * - signOut() : Fonction pour se déconnecter
 * - isAdmin : true si l'email de l'utilisateur correspond à NEXT_PUBLIC_ADMIN_EMAIL
 */
export function useAuth() {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Si Firebase n'est pas configuré, on arrête le chargement immédiatement
    if (!isFirebaseConfigured || !auth) {
      setLoading(false);
      return;
    }

    // Traite le résultat d'un signInWithRedirect (mobile Google OAuth).
    // Doit être appelé au montage — si un redirect Google vient de se terminer,
    // onAuthStateChanged se déclenche automatiquement avec l'utilisateur.
    // getRedirectResult() permet de capturer les erreurs éventuelles du redirect.
    getRedirectResult(auth).catch(() => {
      // Erreurs silencieuses — onAuthStateChanged gère l'état final
    });

    // onAuthStateChanged écoute les changements d'état de connexion en temps réel
    // (connexion, déconnexion, expiration de session, etc.)
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      setUser(user);
      setLoading(false);
    });

    // Cleanup : arrête d'écouter quand le composant est démonté
    return () => unsubscribe();
  }, []);

  /**
   * Connecte l'utilisateur avec email et mot de passe.
   * @returns { user, error } - L'utilisateur connecté ou un message d'erreur
   */
  const signIn = async (email: string, password: string) => {
    if (!auth) {
      return { user: null, error: 'Firebase non configuré' };
    }
    try {
      const result = await signInWithEmailAndPassword(auth, email, password);
      return { user: result.user, error: null };
    } catch (error) {
      return { user: null, error: (error as Error).message };
    }
  };

  /**
   * Connecte l'utilisateur via son compte Google.
   * - Desktop : signInWithPopup (UX immédiate, pas de rechargement de page)
   * - Mobile  : signInWithRedirect (les mobiles bloquent les popups — Safari iOS
   *             et Chrome Android empêchent window.open() sans geste utilisateur direct)
   *
   * Après le redirect mobile, getRedirectResult() dans le useEffect récupère
   * automatiquement le résultat et onAuthStateChanged déclenche la redirection vers /admin.
   *
   * @returns { user, error } - L'utilisateur connecté (desktop) ou null (mobile redirect)
   */
  const signInWithGoogle = async () => {
    if (!auth) {
      return { user: null, error: 'Firebase non configuré' };
    }
    try {
      const provider = new GoogleAuthProvider();

      // Détection mobile — userAgent couvre Android, iPhone, iPad et autres
      const isMobile = typeof navigator !== 'undefined' &&
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);

      if (isMobile) {
        // Sur mobile : redirige vers Google puis revient sur la page
        // Le résultat est traité par getRedirectResult() dans le useEffect au retour
        await signInWithRedirect(auth, provider);
        return { user: null, error: null }; // La page sera redirigée — pas de retour ici
      }

      // Sur desktop : popup classique (résultat immédiat)
      const result = await signInWithPopup(auth, provider);
      return { user: result.user, error: null };
    } catch (error) {
      return { user: null, error: (error as Error).message };
    }
  };

  /**
   * Envoie un email de vérification à l'utilisateur connecté.
   * Utilisé quand un compte email/mot de passe vient d'être créé ou
   * quand email_verified === false après connexion.
   * @returns { error } - null si succès, message d'erreur sinon
   */
  const sendVerificationEmail = async () => {
    if (!auth?.currentUser) {
      return { error: 'Aucun utilisateur connecté' };
    }
    try {
      await sendEmailVerification(auth.currentUser);
      return { error: null };
    } catch (error) {
      return { error: (error as Error).message };
    }
  };

  /**
   * Déconnecte l'utilisateur actuel.
   * @returns { error } - null si succès, message d'erreur sinon
   */
  const signOut = async () => {
    if (!auth) {
      return { error: 'Firebase non configuré' };
    }
    try {
      await firebaseSignOut(auth);
      return { error: null };
    } catch (error) {
      return { error: (error as Error).message };
    }
  };

  // Vérifie si l'utilisateur connecté est l'un des admins autorisés
  // NEXT_PUBLIC_ADMIN_EMAIL  = admin principal
  // NEXT_PUBLIC_ADMIN_EMAIL_2 = admin secondaire (optionnel)
  const adminEmails = [
    process.env.NEXT_PUBLIC_ADMIN_EMAIL,
    process.env.NEXT_PUBLIC_ADMIN_EMAIL_2,
  ].filter(Boolean); // retire les valeurs undefined/vides
  const isAdmin = !!user?.email && adminEmails.includes(user.email);

  return { user, loading, signIn, signInWithGoogle, signOut, sendVerificationEmail, isAdmin };
}
