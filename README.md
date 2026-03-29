# MyNoteSpace

> Éditeur de notes riche personnel — PWA installable sur mobile et desktop.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![TipTap](https://img.shields.io/badge/TipTap-3-purple)
![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon-blue?logo=postgresql)
![PWA](https://img.shields.io/badge/PWA-installable-green)

**URL de production :** https://notes.djefrid.ca

---

## Table des matières

- [Fonctionnalités](#fonctionnalités)
- [Stack](#stack)
- [Structure du projet](#structure-du-projet)
- [Installation](#installation)
- [Configuration R2 Cloudflare](#configuration-r2-cloudflare)
- [Déploiement Vercel](#déploiement-vercel)
- [Scripts](#scripts)
- [Tests](#tests)
- [Points techniques](#points-techniques)

---

## Fonctionnalités

### Éditeur TipTap — style Word complet
- **Toolbar Ribbon 4 onglets** : Accueil / Insertion / Paragraphe / Outils
- Police (famille, taille), styles (gras, italic, souligné, barré), couleurs, surlignage
- Tableaux, listes (ul/ol/tâches), blockquotes, règles horizontales
- Équations LaTeX inline via KaTeX (`$$formule$$`)
- Blocs de code avec coloration syntaxique (16 langages, chargés en lazy après mount)
- Indentation style Word (Tab/Shift+Tab)
- Liens style Word (bleu + souligné) — validation XSS (bloque `javascript:` / `data:`)
- **Compteur mots / caractères** dans l'onglet Outils

### Organisation
- **Dossiers** arborescents (sous-dossiers supportés)
- **Dossiers intelligents** — filtres dynamiques (tags, épinglées, dates)
- **Tags** auto-extraits depuis le contenu (#tag)
- **Corbeille** avec restauration (auto-purge 30 jours via Inngest)
- **Inbox** — notes sans dossier
- **Épinglées** — vue filtrée

### Productivité
- **Autosave 1s** après dernière frappe + Ctrl+S immédiat — envoie `{ html, json, plainText }` à chaque save
- **Slash commands** : `/h1`, `/ul`, `/code`, `/table`, etc.
- **Autocomplétion #tags** avec fuzzy match
- **Focus mode** — éditeur plein écran sans distraction
- **Recherche** full-text 3 couches : Typesense → PostgreSQL tsvector + GIN → ILIKE (fallback automatique)
- **Thème clair / sombre** — bascule en un clic, préférence système respectée

### Import / Export
- **DOCX** : import (mammoth) + export (@turbodocx/html-to-docx)
- **PDF** : extraction texte (pdfjs-dist)
- **Markdown** : export (turndown)
- **JSON** : export complet du workspace
- **Excalidraw** : dessin intégré inline
- **Images** inline via Cloudflare R2 (paste, drag-drop, upload)
  - Compression automatique avant upload (browser-image-compression — max 1 Mo / 1920px)
  - **Compression Sharp server-side** sur `/api/upload/from-url` — conversion WebP 82%, max 1920px, strip EXIF ; SVG/GIF conservés tels quels ; fail-open (l'upload réussit même si Sharp échoue)
  - **Re-upload automatique** des images externes au collage — les URLs Firebase ou autres sources externes sont silencieusement ré-uploadées vers R2
  - **Suppression automatique des images orphelines** — image retirée du contenu = supprimée de R2 (Inngest background job)
  - **Upload multipart R2** pour les fichiers >= 10 Mo (chunks de 10 MiB, URLs présignées, assemblage côté R2)
- **Fichiers joints** via Cloudflare R2

### Réglages in-app (modal)
- **Modal tabbée** — s'ouvre sur la même page, 7 sections : Compte, Sécurité, Apparence, Espace de travail, Membres, Données, Danger
- Modifier le nom sans re-login (JWT update)
- Changer le mot de passe (Argon2id, rate-limited) avec **toggle visibilité**
- Statistiques du workspace (notes, dossiers, tags, fichiers, stockage)
- Gestion des membres (rôles, suppression) — OWNER uniquement
- Configuration durée de session + déconnexion forcée de tous les membres
- Export JSON de toutes les données
- Suppression de compte avec confirmation (cascade complète)
- Accès depuis l'avatar en haut à droite ou via la Command Palette

### PWA
- Installable sur iOS, Android, Chrome desktop
- Fonctionnement offline (cache Network First + CacheFirst pour icônes)
- **Background Sync API** — SW notifie les clients → NotesEditor re-tente l'autosave
- Service Worker v5

### Sécurité
- **CSP nonce-based** par requête dans `middleware.ts`
- **`import 'server-only'`** sur tous les modules backend — empêche les imports accidentels côté client
- **Argon2id (OWASP 2025)** pour tous les nouveaux mots de passe (`@node-rs/argon2` — binaire Rust natif, 19 MiB memory cost) — migration progressive silencieuse depuis bcrypt au login
- **Rate limiting** brute-force sur login (10 req/15min par IP via Upstash Redis)
- **Rate limiting** sur 8 routes distinctes — auth (5/15min), create (30/min), autosave (180/min), list (120/min), search (60/min), presign (20/min), from-url (60/min), read (120/min)
- **Headers 429 standard** : `Retry-After` + `X-RateLimit-Remaining` sur toutes les réponses rate-limited
- **Validation magic bytes** sur `/api/upload/from-url` — vérifie la vraie signature binaire du fichier (pas le Content-Type déclaré)
- **Zod** sur tous les inputs API (prévention operator injection Prisma)
- **X-Frame-Options: DENY** + frame-ancestors CSP
- **DOMPurify** sur import DOCX (XSS stored)
- **Protection SSRF** sur `POST /api/upload/from-url` — bloque localhost et toutes les plages IP privées
- **Validation URL XSS** sur les liens TipTap — `normalizeUrl()` bloque `javascript:`, `data:`, `vbscript:`
- **Server Actions** restreintes au domaine de production (`allowedOrigins`)
- `poweredByHeader: false` — supprime le header `X-Powered-By: Next.js`
- **Fix signOut prod** : `redirect: false` + `router.push('/login')` partout
- Toutes les déconnexions (idle timeout, sidebar, profil) redirigent vers `/login`
- Cascade delete : workspace → notes/dossiers/tags/fichiers → user
- **Modales de confirmation** sur toutes les actions irréversibles
- **Isolation workspace renforcée** — toutes les requêtes Prisma filtrent par `workspaceId` (protection IDOR)
- **Toggle visibilité mot de passe** sur les pages login et inscription (Eye/EyeOff, aria-label dynamique)

### Stockage du contenu — JSON TipTap comme source de vérité
La table `NoteContent` stocke 3 colonnes complémentaires depuis mars 2026 :

| Colonne | Type | Rôle |
|---|---|---|
| `json` | JsonB (nullable) | Arbre ProseMirror natif — **source de vérité** pour le chargement éditeur |
| `html` | Text | Dérivé cache — utilisé pour les exports DOCX/PDF/Markdown |
| `plainText` | Text | Dérivé texte brut — Typesense, preview NoteCard |

**Hiérarchie (du plus autoritaire au plus dérivé) :**
```
json       ← SOURCE DE VÉRITÉ  (editor.getJSON())
  ↓
html       ← CACHE DÉRIVÉ      (editor.getHTML(), pour exports)
  ↓
plainText  ← INDEX RECHERCHE   (editor.getText(), pour Typesense + NoteCard)
```

- **Chargement** : `setContent(json ?? html)` — préfère JSON (zéro re-parse HTML), fallback HTML pour notes sans JSON
- **Autosave** : `{ html, json, plainText }` envoyés à chaque frappe (`onUpdate`) **et** après chaque insertion (image, fichier, Excalidraw, import DOCX/PDF)
- **Règle stricte** : tout chemin qui modifie le contenu de l'éditeur doit envoyer `{ html, json, plainText }` à `scheduleAutoSave` — jamais une simple chaîne HTML
- **Recherche** : `plainText` DB utilisé en priorité dans Typesense, `stripHtml(html)` en fallback

> **Piège historique (corrigé 2026-03-25)** : l'effet de sync multi-appareil comparait `note.content` (plainText liste API) avec `content` (HTML complet). La comparaison était toujours vraie → `setContent(plainText)` écrasait le contenu toutes les 30s → les images disparaissaient. L'effet ne synchronise plus que le titre depuis la liste ; le contenu riche est exclusivement chargé via `GET /api/notes/[id]`.

### Performance
- `shouldRerenderOnTransaction: false` dans TipTap — zéro re-render parent à chaque frappe
- `useEditorState` dans EditorToolbar — souscription sélective
- `React.memo` sur NoteCard
- `optimizePackageImports` Next.js — tree-shaking lucide-react + framer-motion
- Image compression avant upload R2
- **Lazy-load langages lowlight** — 15 grammaires (~150 kB) chargées après mount, seul `plaintext` au démarrage
- **Debounce detectAtCursor 80ms** — autocomplétion tags/slash commands sans appel à chaque frappe
- **Upload drop parallèle** — `Promise.all` au lieu d'une boucle séquentielle

### Accessibilité
- `role="navigation"` + `aria-label` sur la sidebar
- Skip link WCAG 2.4.1
- `role="dialog" aria-modal="true"` + focus trap sur les modales
- Focus restauré automatiquement à la fermeture des modales
- `aria-hidden="true"` sur les icônes décoratives
- `aria-busy="true"` + skeleton loading pendant le chargement
- `maxLength` sur tous les champs texte
- `role="textbox"` + `aria-multiline="true"` + `aria-label` sur la zone d'édition TipTap

---

## Stack

| Couche | Technologie |
|---|---|
| Framework | Next.js 14 (App Router) |
| Langage | TypeScript strict |
| Style | Tailwind CSS + next-themes (dark mode) |
| Auth | Auth.js v5 — JWT, credentials + Google OAuth |
| Base de données | Neon PostgreSQL + Prisma 7 |
| Stockage fichiers | Cloudflare R2 (`assets.djefrid.ca`) |
| Recherche | Typesense + PostgreSQL FTS (tsvector + GIN + unaccent) |
| Rate limiting | Upstash Redis (fail-open) |
| Jobs async | Inngest v4 (5 fonctions) |
| Éditeur | TipTap 3 (26 extensions) |
| Hachage MDP | @node-rs/argon2 (Argon2id) + bcryptjs (legacy) |
| Compression images | Sharp (server-side WebP) + browser-image-compression (client) |
| Tests | Vitest + Testing Library |
| Déploiement | Vercel |

---

## Structure du projet

```
mynotespace/
├── app/
│   ├── layout.tsx                    — layout racine
│   ├── globals.css                   — styles globaux + TipTap (light/dark)
│   ├── manifest.ts                   — PWA manifest
│   ├── (app)/
│   │   ├── layout.tsx                — layout authentifié
│   │   └── notes/page.tsx            — éditeur principal
│   ├── (public)/
│   │   ├── login/page.tsx            — connexion
│   │   └── page.tsx                  — landing
│   ├── not-found.tsx                 — page 404 personnalisée
│   └── api/
│       ├── notes/                    — CRUD notes + restore + content
│       ├── folders/                  — CRUD dossiers
│       ├── tags/                     — CRUD tags
│       ├── search/                   — recherche Typesense
│       ├── upload/
│       │   ├── presign/              — URL présignée R2 (rate limit: 20/min)
│       │   ├── from-url/             — re-upload image externe → R2 + compression Sharp (rate limit: 60/min)
│       │   └── multipart/
│       │       ├── start/            — initie upload multipart R2 (CreateMultipartUpload + URLs présignées)
│       │       └── complete/         — finalise upload multipart (CompleteMultipartUpload)
│       ├── attachments/              — pièces jointes
│       ├── auth/
│       │   ├── [...nextauth]/        — Auth.js handlers
│       │   ├── profile/              — PATCH modifier nom
│       │   ├── change-password/      — POST changer mot de passe
│       │   └── account/              — DELETE supprimer compte
│       ├── profile/stats/            — GET statistiques workspace
│       └── inngest/                  — webhooks Inngest
│
├── src/
│   ├── backend/
│   │   ├── auth/
│   │   │   ├── auth.ts               — NextAuth config (PrismaAdapter + JWT callbacks)
│   │   │   ├── auth.config.ts        — config partagée (pages, callbacks base)
│   │   │   └── session.ts            — requireSession(), requireWorkspaceId()
│   │   ├── db/prisma.ts              — client Prisma singleton
│   │   ├── integrations/
│   │   │   ├── r2/                   — client S3 Cloudflare R2
│   │   │   ├── typesense/            — client Typesense (lazy)
│   │   │   ├── redis/                — client Upstash Redis (lazy)
│   │   │   ├── inngest/              — client + fonctions Inngest
│   │   │   └── storage/upload.ts     — uploadNoteImage, uploadNoteFile
│   │   ├── services/                 — notes, folders, tags, search, attachments...
│   │   ├── validators/               — schémas Zod (notes, auth, upload...)
│   │   ├── policies/                 — autorisation (canAccessNote, etc.)
│   │   ├── repositories/             — accès DB bas niveau
│   │   ├── mappers/                  — DB entity → domain type
│   │   └── lib/
│   │       ├── rate-limit.ts         — checkRateLimit() par route
│   │       └── password.ts           — hashPassword() + verifyPassword() — Argon2id + migration bcrypt
│   │
│   ├── frontend/
│   │   ├── components/
│   │   │   ├── common/
│   │   │   │   ├── ConfirmModal.tsx  — modale confirmation générique
│   │   │   │   └── FlyToTrash.tsx   — animation fantôme → corbeille
│   │   │   ├── editor/
│   │   │   │   ├── NotesEditor.tsx  — orchestrateur principal (~700 lignes)
│   │   │   │   ├── NoteEditorColumn.tsx
│   │   │   │   ├── EditorToolbar.tsx
│   │   │   │   ├── BubbleLinkPopup.tsx
│   │   │   │   ├── CodeModal.tsx
│   │   │   │   └── ExcalidrawModal.tsx
│   │   │   ├── notes/
│   │   │   │   ├── NotesSidebar.tsx  — sidebar + modales dossier/tag
│   │   │   │   ├── NoteListColumn.tsx — liste + modale vider corbeille
│   │   │   │   ├── NoteEditorColumn.tsx
│   │   │   │   └── NoteCard.tsx
│   │   │   ├── folders/
│   │   │   │   ├── FolderTreeItem.tsx
│   │   │   │   └── SmartFolderModal.tsx
│   │   │   └── settings/
│   │   │       └── SettingsModal.tsx — modal réglages (remplace /profile)
│   │   ├── hooks/
│   │   │   ├── data/                 — useNotes, useNotesApi, useAdminNotes, useSearch,
│   │   │   │                           useProfileStats, useWorkspaceMembers, useWorkspaceSession
│   │   │   ├── editor/               — useNoteEditor, useAutosave, useImageFile...
│   │   │   └── ui/                   — useNoteSelection
│   │   ├── services/
│   │   │   └── notes-mutations-api.ts — toutes les mutations API
│   │   ├── providers/Providers.tsx
│   │   └── lib/
│   │       ├── api-client/           — fetch wrapper typé
│   │       ├── auth-client/          — helpers côté client
│   │       ├── multipart-upload.ts   — uploadMultipart() — flux chunked pour fichiers >= 10 Mo
│   │       └── utils/                — docx-utils, pdf-utils, tiptap-extensions
│   │
│   ├── domain/
│   │   ├── notes/                    — Note types, utils, constants, content utils
│   │   ├── folders/                  — Folder types
│   │   ├── tags/                     — Tag types
│   │   └── workspaces/               — Workspace types
│   │
│   └── shared/
│       ├── types/index.ts
│       └── utils/                    — cn(), dates, strings
│
├── prisma/
│   └── schema.prisma                 — User, Workspace, Note, Folder, Tag, Attachment
├── prisma.config.ts                  — URL DB (Prisma 7 pattern)
├── public/
│   ├── favicon.svg                   — logo bleu (carré arrondi + lignes blanches)
│   └── sw.js                         — Service Worker PWA
├── scripts/                          — migration, setup, maintenance
├── tests/unit/                       — tests unitaires Vitest
├── middleware.ts                     — CSP nonce + rate-limit login
├── next.config.js                    — headers sécurité + standalone output
├── tailwind.config.ts                — content: ['./app/**/*', './src/**/*']
└── .env.local                        — variables d'env (gitignored)
```

---

## Installation

```bash
npm install
cp .env.example .env.local
# Remplir les variables dans .env.local
npm run dev
# → http://localhost:3000
```

### Variables d'environnement

```env
# Base de données (Neon PostgreSQL)
DATABASE_URL=              # URL poolée (pgbouncer) — runtime Next.js
DATABASE_URL_UNPOOLED=     # URL directe — migrations uniquement

# Auth.js v5
AUTH_SECRET=               # npx auth secret
AUTH_URL=                  # http://localhost:3000 en dev (pas nécessaire sur Vercel — trustHost: true)

# Google OAuth (optionnel)
GOOGLE_CLIENT_ID=
GOOGLE_CLIENT_SECRET=

# Cloudflare R2
R2_ACCOUNT_ID=             # ID de compte Cloudflare
R2_ACCESS_KEY_ID=          # Clé d'accès R2
R2_SECRET_ACCESS_KEY=      # Secret R2
R2_BUCKET_NAME=            # mynotespace
R2_PUBLIC_URL=             # https://assets.djefrid.ca

# Typesense
TYPESENSE_HOST=            # ex: abc123.typesense.net (sans https://)
TYPESENSE_API_KEY=         # clé admin

# Upstash Redis
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Inngest
INNGEST_EVENT_KEY=
INNGEST_SIGNING_KEY=
```

> **Important :** Aucune variable `NEXT_PUBLIC_*` ne doit être présente en production. Ces variables sont exposées publiquement dans le bundle JavaScript client.

---

## Configuration R2 Cloudflare

### 1. CORS (obligatoire — upload direct browser → R2)

Dans R2 → bucket `mynotespace` → Settings → **CORS Policy** → Edit :

```json
[{
  "AllowedOrigins": [
    "http://localhost:3000",
    "https://notes.djefrid.ca"
  ],
  "AllowedMethods": ["PUT"],
  "AllowedHeaders": [
    "content-type",
    "content-length",
    "x-amz-checksum-crc32",
    "x-amz-sdk-checksum-algorithm"
  ],
  "MaxAgeSeconds": 3600
}]
```

### 2. Hotlink Protection (obligatoire — affichage images)

Cloudflare dashboard → zone `djefrid.ca` → **Rules** → **Configuration Rules** → Create rule :

- **Nom :** `Disable hotlink assets R2`
- **Filter :** `(http.host eq "assets.djefrid.ca")`
- **Setting :** Hotlink Protection → **Off**
- Cliquer **Deploy**

> Sans cette règle, les images uploadées dans R2 s'affichent en 403 dans l'app (Cloudflare bloque les requêtes cross-origin avec Referer).

---

## Déploiement Vercel

```bash
vercel --prod
```

1. Vercel Dashboard → Settings → Domains → Ajouter `notes.djefrid.ca`
2. DNS Cloudflare : `notes` CNAME → `cname.vercel-dns.com`
3. Ajouter toutes les variables d'env dans Vercel → Settings → Environment Variables

> **Sécurité :** Supprimer toute variable préfixée `NEXT_PUBLIC_` du dashboard Vercel. Ces variables sont injectées dans le bundle client et lisibles par n'importe quel visiteur.

---

## Scripts

```bash
# Définir mot de passe d'un utilisateur
npx tsx --env-file=.env.local scripts/set-password.ts <email> <password>

# Configurer la recherche full-text PostgreSQL (à faire 1× après déploiement)
# Active unaccent + crée unaccent_immutable + crée les 2 index GIN
npx tsx --env-file=.env.local scripts/setup-search.ts

# Réindexer toutes les notes dans Typesense
npx tsx --env-file=.env.local scripts/reindex-typesense.ts

# Remplir les extraits de notes manquants
npx tsx --env-file=.env.local scripts/backfill-note-excerpts.ts

# Configurer CORS R2 via API (nécessite token avec Bucket Settings Write)
npx tsx --env-file=.env.local scripts/setup-r2-cors.ts
```

---

## Tests

```bash
npm test          # vitest
npm run test:ui   # vitest avec interface
```

Tests unitaires dans `tests/unit/` :
- `utils.test.ts` — cn() (fusion classes Tailwind)
- `extractHashtags.test.ts` — parsing #tags
- `pdfUtils.test.ts` — extraction texte PDF
- `loginPage.test.tsx` — rendu page connexion
- `notesUtils.test.ts` — fonctions pures (stripHtml, fmtDate, applySmartFilters…)

Tests d'intégration dans `tests/integration/` :
- `notes/notes-crud.test.ts` — GET & POST /api/notes (auth, pagination, rate limit, Zod)
- `upload/presign.test.ts` — POST /api/upload/presign (auth, MIME, taille, R2)
- `upload/from-url.test.ts` — POST /api/upload/from-url (SSRF, auth, rate limit, MIME, magic bytes, Sharp fail-open)
- `auth/account.test.ts` — DELETE /api/auth/account (auth, confirmation, cascade)
- `auth/change-password.test.ts` — POST /api/auth/change-password (Argon2id mock)
- `auth/register.test.ts` — POST /api/auth/register (Argon2id mock)

**142 tests passent** — `npm run build` sans erreur.

---

## Points techniques

### Upload d'images — flux complet
1. Paste / drag / bouton → `useImageFile.ts`
2. `POST /api/upload/presign` → `{ uploadUrl, publicUrl }` (URL présignée R2, 5 min)
3. XHR PUT direct browser → R2 (suivi progression)
4. `publicUrl` (`https://assets.djefrid.ca/...`) insérée dans TipTap

### Re-upload automatique d'images externes
Au collage de contenu contenant des images externes (ex : notes copiées depuis une ancienne version Firebase) :
1. `handlePaste` dans `useNoteEditor.tsx` détecte les `<img src="...">` avec URL externe
2. `POST /api/upload/from-url { url, noteId }` — le serveur fetch l'image (contourne le CORS)
3. Validation MIME + taille (max 10 Mo), protection SSRF côté serveur
4. Upload direct vers R2 via `PutObjectCommand`, retourne l'URL publique
5. Sur 429 (rate limit) ou 413 (trop grande) : l'URL d'origine est conservée
6. Sur erreur de source inaccessible : l'image est retirée du contenu collé

### Argon2id — migration progressive depuis bcrypt

`src/backend/lib/password.ts` centralise toute la logique de hachage :

- **Nouveaux comptes** → hash Argon2id immédiatement (`hashPassword()`)
- **Comptes existants (bcrypt)** → vérifiés normalement au login, puis re-hashés silencieusement en Argon2id si le mot de passe est correct (`verifyPassword()` retourne `{ valid, needsRehash }`)
- **Paramètres OWASP 2025** : memoryCost 19 456 (19 MiB), timeCost 2, parallelism 1
- **Zéro downtime** — aucune migration forcée, aucune déconnexion des utilisateurs existants
- `@node-rs/argon2` (binaire Rust natif) déclaré dans `serverComponentsExternalPackages` — webpack ne tente pas de bundler le `.node`

### Compression Sharp — re-uploads d'images

Sur `POST /api/upload/from-url`, avant l'upload vers R2 :
1. SVG/GIF → conservés tels quels (SVG = XML, GIF = animation potentielle)
2. JPEG/PNG/WebP → conversion WebP 82% qualité, max 1920px (dimension longue), strip EXIF
3. Sharp échoue → fail-open : l'image originale est uploadée sans compression (l'upload n'échoue jamais à cause de Sharp)

### Upload multipart R2 — fichiers >= 10 Mo

Flux pour les fichiers volumineux :

1. `POST /api/upload/multipart/start` — `CreateMultipartUploadCommand` + génération des URLs présignées par chunk (`UploadPartCommand`, expiry 1h)
2. Client upload chaque chunk via PUT direct vers R2 (pas de transit serveur), collecte les `ETag`
3. `POST /api/upload/multipart/complete` — `CompleteMultipartUploadCommand` avec parts triés par `partNumber`
4. En cas d'erreur sur `/complete` → `AbortMultipartUploadCommand` fire-and-forget (évite les frais R2 pour les chunks incomplets)

Sécurité : la clé R2 doit commencer par `workspaces/{workspaceId}/` — vérifiée dans `/complete` pour prévenir les completions inter-workspace.

Taille chunk : 10 MiB (minimum R2/S3 = 5 MiB sauf dernier chunk). Seuil d'activation côté client : `MULTIPART_THRESHOLD = 10 MiB` (`src/frontend/lib/multipart-upload.ts`).

### Rate limits

| Route | Limite | Fenêtre |
|-------|--------|---------|
| list (notes, membres) | 120 | 1 min |
| autosave | 180 | 1 min |
| read | 120 | 1 min |
| search | 60 | 1 min |
| from-url | 60 | 1 min |
| create | 30 | 1 min |
| presign | 20 | 1 min |
| auth | 5 | 15 min |

### Thème clair / sombre
- `next-themes` avec `attribute="class"` — classe `dark` sur `<html>`
- Tous les composants utilisent les classes `dark:` Tailwind
- `globals.css` : `.tiptap-editor` (light) + `.dark .tiptap-editor` (dark) — couleurs, headings, code, tableaux, liens, placeholder
- **Palette dark (depuis 2026-03-29)** — 5 niveaux dérivés de `#334155` :
  - `#334155` — fond principal · `#2d3a4e` — panneaux · `#3d4e65` — cartes · `#2a3648` — inputs · `#455670` — hover
- **Scrollbar Notion-style** — overlay opacity (45%→75%→95%), 20px desktop, cachée sur mobile

### Auth.js v5 — JWT sans re-login
- `useSession().update({ name })` côté client
- `trigger === 'update'` dans jwt callback → `token.name = session.name`
- Session mise à jour sans déconnexion/reconnexion
- `trustHost: true` dans `auth.config.ts` — utilise `x-forwarded-host` (Vercel) pour les redirections. Sans ça, Auth.js tombe en fallback sur `NEXTAUTH_URL=localhost:3000` et redirige vers localhost en prod après déconnexion.

### Modales de confirmation
Toutes les actions irréversibles utilisent `ConfirmModal` (composant générique) :
- Supprimer dossier, supprimer tag → `NotesSidebar.tsx`
- Vider corbeille → `NoteListColumn.tsx`
- Déconnexion, supprimer compte → `profile/page.tsx`

### Prisma 7
- `prisma.config.ts` à la racine (pas d'URL dans schema.prisma)
- `DATABASE_URL` (pooled) pour le runtime, `DATABASE_URL_UNPOOLED` pour les migrations

### Inngest v4
- `createFunction({ id, triggers, retries }, handler)` — 2 args seulement
- `eventType()` + `staticSchema()` pour les types d'événements

### Recherche full-text — 3 couches
1. **Typesense** (si `TYPESENSE_HOST` + `TYPESENSE_API_KEY` définis) — typo-tolérance, ranking avancé
2. **PostgreSQL tsvector + GIN** — `websearch_to_tsquery`, `setweight('A'/'B')`, `ts_rank_cd`, `ts_headline`, `unaccent` (accent-insensitif). Requiert `scripts/setup-search.ts`.
3. **PostgreSQL ILIKE** — filet de sécurité, aucune dépendance

La couche 2 bascule automatiquement sur la couche 3 en cas d'erreur (extension manquante, etc.).

### Restauration état au rechargement — atomic setter pattern

Au rechargement manuel (F5), l'app restaure exactement : dossier actif en sidebar, liste de notes correspondante, note ouverte dans l'éditeur.

**Pattern appliqué** (Josh W. Comeau / shadcn best practice) — 3 clés `localStorage` :

| Clé | Valeur | Hook |
|---|---|---|
| `notes_view` | JSON (ViewFilter) | `useNoteFilters` |
| `notes_sortBy` | string | `useNoteFilters` |
| `notes_selectedId` | string | `useNoteSelection` |

- **`useEffect([], [])` de restauration** : lit localStorage → appelle le setter **interne** (`_setView`) → aucun write.
- **Setters publics** (`setView`, `setSortBy`, `setSelectedId`) : écrivent état ET localStorage **atomiquement** au même instant.
- L'approche `useEffect([state])` réactif a été abandonnée — elle causait une race condition : l'effet `[]` de restauration s'exécutait, puis l'effet `[state]` ré-écrasait localStorage avec la valeur par défaut du premier render.

### Warning `sharp` (non-bloquant)
`@turbodocx/html-to-docx` requiert `sharp` optionnellement. Le warning n'affecte pas l'export DOCX.

### Background Sync — implémentation réelle
SW reçoit `{ type: 'REGISTER_SYNC' }` → `reg.sync.register('sync-notes')` → connexion restaurée → SW envoie `{ type: 'BACKGROUND_SYNC_READY' }` → NotesEditor re-tente l'autosave.

---

---

*Migré de Firebase vers PostgreSQL/R2/Auth.js — 2026-03-22*
*Améliorations TipTap (paste, sécurité, perf, a11y), fix Auth.js prod, page 404 — 2026-03-23*
*Toggle mot de passe, historique des versions, suppression R2 orphelins, isolation workspace — 2026-03-24*
*Fix images disparaissant (sync multi-appareil écrasait avec plainText), autosave JSON complet après insertion image/fichier/Excalidraw/import — 2026-03-25*
*Restauration état complète au rechargement (dossier + note) — atomic setter pattern localStorage — 2026-03-25*
*Modal Réglages in-app (remplace /profile), palette dark #334155, scrollbar Notion-style, SWR auto-refresh global, rate limiting étendu, validation magic bytes uploads, optimisations Prisma — 2026-03-29*
*Argon2id (migration progressive depuis bcrypt), compression Sharp server-side WebP, upload multipart R2 (>= 10 Mo) — 2026-03-29*
