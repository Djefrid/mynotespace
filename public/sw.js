/**
 * ============================================================================
 * SERVICE WORKER — public/sw.js
 * ============================================================================
 *
 * Service Worker pour mynotespace PWA.
 * Requis par Chrome pour activer le bouton d'installation PWA.
 *
 * Stratégie de cache :
 *   - Install : met en cache la page /notes et les assets essentiels
 *   - Fetch : Network First (réseau prioritaire, cache en fallback si offline)
 *
 * Exclusions du cache (ne pas intercepter) :
 *   - Firebase, Firestore, Google APIs → temps réel requis
 *   - /__/auth/* → proxy Firebase Auth (doit passer direct au serveur Next.js)
 *   - chrome-extension://, moz-extension:// → schémas non cachéables
 * ============================================================================
 */

/** Nom du cache — incrémenter pour invalider l'ancien cache */
const CACHE_NAME = 'mynotespace-v1';

/** Assets précachés lors de l'installation */
const PRECACHE_URLS = [
  '/notes',
  '/login',
  '/icon-192.png',
  '/icon-512.png',
];

/**
 * Événement install — précache les assets essentiels.
 * skipWaiting : active immédiatement sans attendre la fermeture des onglets.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(PRECACHE_URLS))
  );
  self.skipWaiting();
});

/**
 * Événement activate — supprime les anciens caches.
 * clients.claim : prend le contrôle de tous les onglets immédiatement.
 */
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

/**
 * Événement fetch — Network First avec fallback cache.
 * Exclusions critiques : Firebase, Google APIs, Auth handler, extensions navigateur.
 */
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Ne pas intercepter ces requêtes (critique pour Firebase Auth et Firestore)
  if (
    url.protocol === 'chrome-extension:' ||
    url.protocol === 'moz-extension:' ||
    url.pathname.startsWith('/__/auth/') ||   // Firebase Auth redirect handler
    url.hostname.includes('firebase') ||
    url.hostname.includes('firestore') ||
    url.hostname.includes('googleapis') ||
    url.hostname.includes('google.com') ||
    url.hostname.includes('gstatic.com') ||
    url.hostname.includes('vercel') ||
    event.request.method !== 'GET'
  ) {
    return;
  }

  // Network First : essaie le réseau, cache en fallback si offline
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const responseClone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, responseClone));
        return response;
      })
      .catch(() => caches.match(event.request))
  );
});
