/**
 * ============================================================================
 * SERVICE WORKER — public/sw.js  (v5)
 * ============================================================================
 *
 * Service Worker pour mynotespace PWA.
 * Requis par Chrome pour activer le bouton d'installation PWA.
 *
 * Stratégie de cache :
 *   - Install  : précache les pages essentielles + icônes PWA (CacheFirst)
 *   - Fetch    : Network First (réseau prioritaire, cache fallback offline)
 *   - Icônes   : CacheFirst → évite de re-télécharger à chaque démarrage PWA
 *   - Sync     : Background Sync API — retente les sauvegardes en attente
 *                quand la connectivité est restaurée
 *
 * Exclusions du cache (ne pas intercepter) :
 *   - Firebase, Firestore, Google APIs → temps réel requis
 *   - /__/auth/* → proxy Firebase Auth (doit passer direct au serveur Next.js)
 *   - chrome-extension://, moz-extension:// → schémas non cachéables
 * ============================================================================
 */

/** Nom du cache — incrémenter invalide l'ancien cache sur les appareils existants */
const CACHE_NAME = 'mynotespace-v5';

/**
 * Assets précachés lors de l'installation.
 * Les icônes PWA sont générées via des routes API → précachées pour éviter
 * le rechargement réseau à chaque ouverture de l'app en mode standalone.
 */
const PRECACHE_URLS = [
  '/notes',
  '/login',
  '/api/pwa-icon?size=192',
  '/api/pwa-icon?size=512',
];

/**
 * Préfixes d'URL pour la stratégie CacheFirst.
 * Ces assets changent rarement — inutile de toujours passer par le réseau.
 */
const CACHE_FIRST_PATTERNS = [
  '/api/pwa-icon',
  '/_next/static/',
];

/**
 * Événement install — précache les assets essentiels.
 * skipWaiting : active immédiatement sans attendre la fermeture des onglets.
 */
self.addEventListener('install', (event) => {
  event.waitUntil(
    // addAll() avec gestion d'erreur individuelle pour ne pas bloquer sur une icône
    caches.open(CACHE_NAME).then((cache) =>
      Promise.allSettled(PRECACHE_URLS.map(url => cache.add(url)))
    )
  );
  self.skipWaiting();
});

/**
 * Événement activate — supprime les anciens caches (version précédente).
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
 * Événement fetch — stratégie adaptée par type de ressource.
 * - CacheFirst pour les assets statiques et icônes (changent rarement)
 * - NetworkFirst pour tout le reste (données fraîches prioritaires)
 *
 * Exclusions critiques : Firebase, Google APIs, Auth handler, extensions.
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

  // ── CacheFirst : assets qui changent rarement ──────────────────────────────
  // Sert directement depuis le cache → zéro latence réseau.
  // Met à jour le cache en arrière-plan si la réponse est obsolète.
  const isCacheFirst = CACHE_FIRST_PATTERNS.some(p => url.pathname.startsWith(p));
  if (isCacheFirst) {
    event.respondWith(
      caches.match(event.request).then((cached) => {
        if (cached) {
          // Mise à jour silencieuse en arrière-plan (Stale-While-Revalidate)
          fetch(event.request).then((fresh) => {
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, fresh));
          }).catch(() => {/* réseau indisponible — cache actuel conservé */});
          return cached;
        }
        // Pas en cache → réseau, puis mise en cache
        return fetch(event.request).then((response) => {
          const clone = response.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          return response;
        });
      })
    );
    return;
  }

  // ── NetworkFirst : données fraîches prioritaires ───────────────────────────
  // Essaie le réseau d'abord, cache en fallback si offline.
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

/**
 * Événement sync — Background Sync API.
 * Déclenché automatiquement quand la connectivité est restaurée après une
 * perte de réseau. Permet de rejouer les sauvegartes de notes en attente.
 *
 * Utilisation :
 *   Dans le code app : navigator.serviceWorker.ready.then(reg =>
 *     reg.sync.register('sync-notes'));
 *   Le SW reçoit cet événement dès que l'appareil est de nouveau en ligne.
 *
 * Note : Background Sync est supporté sur Chrome/Android. Sur iOS Safari,
 * les sauvegardes Firebase (Firestore SDK) retentent automatiquement.
 */
self.addEventListener('sync', (event) => {
  if (event.tag === 'sync-notes') {
    // Firestore SDK gère lui-même la retry automatique des écritures en attente
    // (file d'attente interne Firestore). Ce handler est un point d'extension
    // pour des logiques de sync custom futures (ex: IndexedDB → Firestore).
    event.waitUntil(Promise.resolve());
  }
});
