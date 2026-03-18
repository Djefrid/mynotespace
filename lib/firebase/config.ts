/**
 * ============================================================================
 * CONFIGURATION FIREBASE — lib/firebase/config.ts
 * ============================================================================
 *
 * Initialise Firebase (Auth + Firestore + Storage) pour mynotespace.
 * Utilise le même projet Firebase que le portfolio (portfolio-8d07b)
 * afin de partager les mêmes collections adminNotes, adminFolders, adminTags.
 *
 * Variables requises dans .env.local :
 *   NEXT_PUBLIC_FIREBASE_API_KEY
 *   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN
 *   NEXT_PUBLIC_FIREBASE_PROJECT_ID
 *   NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET
 *   NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID
 *   NEXT_PUBLIC_FIREBASE_APP_ID
 *   NEXT_PUBLIC_SITE_URL (ex : https://notes.djefrid.ca)
 *
 * authDomain en production :
 *   Utilise le hostname de NEXT_PUBLIC_SITE_URL (notes.djefrid.ca) pour
 *   que le proxy /__/auth/* fonctionne en same-origin — requis pour
 *   getRedirectResult() sur mobile (Safari iOS, Chrome Android).
 * ============================================================================
 */

import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import {
  getFirestore, initializeFirestore, Firestore,
  persistentLocalCache, persistentMultipleTabManager,
} from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

/**
 * authDomain dynamique :
 *   - En production : hostname du site (notes.djefrid.ca) → same-origin cookies
 *   - En développement : domaine Firebase par défaut (portfolio-8d07b.firebaseapp.com)
 */
const authDomain = (() => {
  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL;
  if (process.env.NODE_ENV === 'production' && siteUrl) {
    try {
      return new URL(siteUrl).hostname; // 'notes.djefrid.ca'
    } catch {
      return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
    }
  }
  return process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
})();

/** Configuration Firebase depuis les variables d'environnement */
const firebaseConfig = {
  apiKey:            process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain,
  projectId:         process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket:     process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId:             process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

/**
 * Vérifie que les 6 variables Firebase requises sont présentes.
 * Permet d'afficher une page d'erreur claire si .env.local est absent.
 * Inclut les 3 essentielles (apiKey, projectId, authDomain) + les 3
 * supplémentaires (storageBucket, messagingSenderId, appId) requises
 * pour Storage et App Check.
 */
export const isFirebaseConfigured = Boolean(
  firebaseConfig.apiKey &&
  firebaseConfig.projectId &&
  firebaseConfig.authDomain &&
  firebaseConfig.storageBucket &&
  firebaseConfig.messagingSenderId &&
  firebaseConfig.appId
);

// Instances Firebase (null si variables manquantes)
let app: FirebaseApp | null = null;
let auth: Auth | null = null;
let db: Firestore | null = null;
let storage: FirebaseStorage | null = null;

/**
 * Initialise Firebase une seule fois.
 * getApps() évite les doublons lors du hot reload Next.js en développement.
 *
 * Stratégie Firestore :
 *   - Premier démarrage (côté client) → initializeFirestore avec
 *     persistentLocalCache pour le cache offline + multi-onglets.
 *   - Hot reload Next.js ou SSR → getFirestore sur l'app déjà initialisée.
 *   - Côté serveur (SSR) → pas de persistance (IndexedDB indisponible).
 */
if (isFirebaseConfigured) {
  const isFirstInit = getApps().length === 0;
  app  = isFirstInit ? initializeApp(firebaseConfig) : getApps()[0];
  auth = getAuth(app);

  // Persistance locale uniquement côté client (IndexedDB requis)
  const canPersist = typeof window !== 'undefined';
  if (isFirstInit && canPersist) {
    // persistentLocalCache : cache Firestore sur l'appareil → données disponibles offline
    // persistentMultipleTabManager : synchronise le cache entre les onglets ouverts
    db = initializeFirestore(app, {
      localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager(),
      }),
    });
  } else {
    // SSR ou app déjà initialisée (hot reload) → instance existante sans persistance
    db = getFirestore(app);
  }

  if (firebaseConfig.storageBucket) {
    try { storage = getStorage(app); } catch { /* Storage non disponible */ }
  }
}

export { app, auth, db, storage };
export default app;
