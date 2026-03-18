# MyNoteSpace

> Éditeur de notes riche personnel — PWA installable sur mobile et desktop.

![Next.js](https://img.shields.io/badge/Next.js-14-black?logo=next.js)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?logo=typescript)
![TipTap](https://img.shields.io/badge/TipTap-3-purple)
![Firebase](https://img.shields.io/badge/Firebase-12-orange?logo=firebase)
![PWA](https://img.shields.io/badge/PWA-installable-green)

**URL de production :** https://notes.djefrid.ca

---

## Table des matières

- [Fonctionnalités](#fonctionnalités)
- [Structure du projet](#structure-du-projet)
- [Firebase](#firebase)
- [Configuration](#configuration-envlocal)
- [Déploiement](#déploiement-vercel)
- [Développement local](#développement-local)
- [Points techniques](#points-techniques)

---

## Fonctionnalités

### Éditeur TipTap — style Word complet
- **Toolbar Ribbon 4 onglets** : Accueil / Insertion / Paragraphe / Outils
- Police (famille, taille), styles (gras, italic, souligné, barré), couleurs, surlignage
- Tableaux, listes (ul/ol/tâches), blockquotes, règles horizontales
- Équations LaTeX inline via KaTeX (`$$formule$$`)
- Blocs de code avec coloration syntaxique (16 langages — Haskell exclu)
- Indentation style Word (Tab/Shift+Tab)
- Espacement de paragraphes style Word (margin-bottom: 0.75em)
- Liens style Word (bleu + souligné uniquement)

### Organisation
- **Dossiers** arborescents (sous-dossiers supportés)
- **Dossiers intelligents** — filtres dynamiques (tags, épinglées, dates)
- **Tags** auto-extraits depuis le contenu (#tag)
- **Corbeille** avec restauration (auto-purge 30 jours)
- **Inbox** — notes sans dossier
- **Épinglées** — vue filtrée

### Productivité
- **Autosave 1s** après dernière frappe + Ctrl+S immédiat
- **Slash commands** : `/h1`, `/ul`, `/code`, `/table`, etc.
- **Autocomplétion #tags** avec fuzzy match
- **Sync multi-appareils** en temps réel (Firestore WebSocket)
- **Focus mode** — éditeur plein écran sans distraction

### Import / Export
- **DOCX** : import (mammoth) + export (@turbodocx/html-to-docx)
- **PDF** : extraction texte (pdfjs-dist)
- **Markdown** : export (turndown)
- **Excalidraw** : dessin intégré inline
- **Images** inline via Firebase Storage (paste, drag-drop, upload)
  - Compression automatique avant upload (browser-image-compression — max 1 Mo / 1920px)
- **Fichiers joints** via Firebase Storage (lien dans le texte)

### PWA
- Installable sur iOS, Android, Chrome desktop
- Fonctionnement offline (cache Network First + CacheFirst pour icônes)
- **Background Sync API** — implémentation réelle : SW notifie les clients (`postMessage BACKGROUND_SYNC_READY`) → NotesEditor re-tente l'autosave automatiquement
- Service Worker v5

### Sécurité
- **DOMPurify** sur l'import DOCX (XSS stored via mammoth)
- **Firestore & Storage Security Rules** — gérées dans la Firebase Console
- **CSP nonce-based** dans middleware.ts
- `transformPastedHTML` — supprime background-color/color inline (dark themes)

### Performance
- `shouldRerenderOnTransaction: false` dans TipTap — zéro re-render parent à chaque frappe
- `useEditorState` dans EditorToolbar — souscription sélective aux changements d'état
- `persistentLocalCache` Firestore — cache offline IndexedDB + multi-onglets
- `limit(200)` sur la requête notes — pagination légère
- `React.memo` sur NoteCard — évite les re-renders des cartes non sélectionnées
- `optimizePackageImports` Next.js — tree-shaking lucide-react + framer-motion
- Image compression avant upload Firebase (browser-image-compression)
- OG image générée dynamiquement (app/opengraph-image.tsx)
- Error Boundary autour de l'éditeur — fallback élégant en cas de crash TipTap

### Accessibilité
- `aria-label="Se connecter avec Google"` sur le bouton Google
- `role="navigation"` + `aria-label="Navigation des notes"` sur la sidebar
- Skip link WCAG 2.4.1
- `role="dialog" aria-modal="true"` + focus trap Tab/Shift+Tab sur SmartFolderModal (WCAG 2.1.2)
- Focus restauré automatiquement à la fermeture de la modal (WCAG 2.4.3)
- `aria-hidden="true"` sur les icônes décoratives de la toolbar
- `aria-busy="true"` + skeleton loading pendant le chargement Firestore
- `maxLength` sur les champs titre (200), tag (50) et nom de dossier (80)

### Tests
- **Vitest** + React Testing Library — `npm test`
- Tests unitaires : `cn()`, `extractHashtags()`, `extractTextFromPdf()`, page login
- Tests fonctions pures : `stripHtml()`, `fmtDate()`, `daysUntilPurge()`, `applySmartFilters()`, `buildFolderTree()` (lib/notes-utils.ts)
- **69 tests passent** (5 fichiers de test)

---

## Structure du projet

```
mynotespace/
├── app/
│   ├── layout.tsx              — layout racine (ThemeProvider, skip link, metadataBase)
│   ├── page.tsx                — redirect → /notes
│   ├── globals.css             — styles globaux + TipTap (Word-like paragraphes)
│   ├── manifest.ts             — PWA manifest
│   ├── opengraph-image.tsx     — image OG 1200×630 (Next.js ImageResponse)
│   ├── login/
│   │   └── page.tsx            — connexion email/mdp + Google OAuth
│   └── notes/
│       └── page.tsx            — page principale (garde auth + Error Boundary + NotesEditor)
├── components/
│   ├── NotesEditor.tsx         — éditeur complet (TipTap + useEditorState + shouldRerenderOnTransaction)
│   ├── NotesEditorErrorBoundary.tsx — Error Boundary React (class component)
│   └── Providers.tsx           — ThemeProvider + enregistrement SW
├── hooks/
│   └── useAdminNotes.ts        — 3 listeners Firestore (limit 200 + Promise.all purge)
├── lib/
│   ├── firebase/
│   │   ├── config.ts           — initialisation Firebase (persistentLocalCache + 6 vars validées)
│   │   └── hooks.ts            — useAuth() (signIn, signInWithGoogle, signOut)
│   ├── tiptap-extensions/
│   │   ├── indent.ts           — indentation custom Tab/Shift+Tab
│   │   └── font-size.ts        — taille de police en points
│   ├── notes-service.ts        — CRUD Firestore (notes, dossiers, tags)
│   ├── notes-utils.ts          — fonctions pures testables (stripHtml, fmtDate, applySmartFilters…)
│   ├── upload-image.ts         — upload Firebase Storage (images + fichiers)
│   ├── docx-utils.ts           — import/export DOCX (DOMPurify sur import)
│   ├── pdf-utils.ts            — extraction texte PDF
│   └── utils.ts                — cn() (clsx + tailwind-merge)
├── types/
│   └── index.ts                — ré-exports types (Note, Folder, Tag)
├── public/
│   ├── sw.js                   — Service Worker PWA v5 (CacheFirst icônes + Background Sync)
│   └── favicon.svg
├── __tests__/
│   ├── utils.test.ts           — tests cn() (fusion classes Tailwind)
│   ├── extractHashtags.test.ts — tests extractHashtags() (parsing #tags)
│   ├── pdfUtils.test.ts        — tests extractTextFromPdf() (extraction texte PDF)
│   ├── loginPage.test.tsx      — tests page de connexion (rendu + accessibilité)
│   └── notesUtils.test.ts      — tests fonctions pures notes (stripHtml, fmtDate, applySmartFilters…)
├── middleware.ts               — CSP nonce-based + bypass /__/auth/*
├── next.config.js              — proxy Firebase Auth + headers sécurité + optimizePackageImports
├── vitest.config.ts            — configuration Vitest (jsdom + alias @/)
├── vitest.setup.ts             — setup @testing-library/jest-dom
└── .env.local                  — variables Firebase (gitignored)
```

---

## Firebase

**Projet partagé avec le portfolio :** `your-firebase-project-id`

> Les règles de sécurité Firestore et Storage sont gérées directement dans la **Firebase Console**.

### Collections Firestore
| Collection | Contenu |
|---|---|
| `adminNotes` | Notes (titre, HTML, pinned, folderId, tags, dates) |
| `adminFolders` | Dossiers normaux + intelligents |
| `adminTags` | Bibliothèque globale de tags |

### Storage
`notes/{noteId}/` → images inline
`notes/{noteId}/files/` → fichiers joints

---

## Configuration (.env.local)

```env
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-firebase-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

NEXT_PUBLIC_ADMIN_EMAIL=ton_email_admin@gmail.com
NEXT_PUBLIC_ADMIN_EMAIL_2=ton_email_admin_2@gmail.com

NEXT_PUBLIC_SITE_URL=https://ton-domaine.com
```

---

## Déploiement (Vercel)

### 1. Déployer sur Vercel
```bash
cd mynotespace
vercel --prod
```

### 2. Configurer le domaine
- Vercel Dashboard → Settings → Domains → Ajouter `notes.djefrid.ca`
- Ajouter un CNAME DNS : `notes → cname.vercel-dns.com`

### 3. Variables d'environnement Vercel
Ajouter toutes les variables de `.env.local` dans Vercel Dashboard → Settings → Environment Variables.

### 4. Google Cloud Console (Auth redirect mobile)
APIs & Services → Credentials → OAuth 2.0 Client ID Web application → Authorized redirect URIs :
- Ajouter `https://notes.djefrid.ca/__/auth/handler`

### 5. Firebase Auth — Domaines autorisés
Firebase Console → Authentication → Settings → Authorized domains :
- Ajouter `notes.djefrid.ca`

---

## Développement local

```bash
cd mynotespace
npm run dev
# → http://localhost:3000
# → Se connecter sur /login avec email/mdp ou Google
```

---

## Points techniques

### Auth Google mobile
- Desktop : `signInWithPopup` (popup classique)
- Mobile : `signInWithRedirect` (navigateurs mobiles bloquent les popups)
- Proxy `/__/auth/*` dans `next.config.js` → same-origin cookies → `getRedirectResult()` fonctionne

### TipTap 3 breaking change
`setContent(html, false)` → `setContent(html, { emitUpdate: false })`

### Excalidraw SSR
Excalidraw est SSR-incompatible → chargé en `dynamic(() => import(...), { ssr: false })` + useMemo

### Copier-coller Chrome
Chrome ajoute `image/png` même lors d'une copie de texte formaté.
Guard dans `handlePaste` : vérifier `hasText` avant d'intercepter l'image.
`transformPastedHTML` : strip background-color/color pour les thèmes sombres (Claude.ai, Discord, etc.)

### shouldRerenderOnTransaction
`shouldRerenderOnTransaction: false` dans `useEditor` désactive les re-renders React du composant
parent à chaque frappe/transaction TipTap. La toolbar utilise `useEditorState` pour rester réactive
en souscrivant sélectivement uniquement aux changements d'état qui l'intéressent.

### persistentLocalCache Firestore
Active le cache offline IndexedDB + synchronisation multi-onglets.
Données disponibles offline ; synchronisées dès le retour en ligne.

### Warning `sharp` (non-bloquant)
`@turbodocx/html-to-docx` a `sharp` comme dépendance optionnelle.
Le warning apparaît au build mais n'affecte pas le fonctionnement de l'export DOCX.

### getRedirectResult — sans duplication
`getRedirectResult()` est appelé **uniquement dans `useAuth()`** (hook). La page `/login` ne le répète pas pour éviter une double exécution inutile.

### PDF.js — worker configuré une seule fois
`GlobalWorkerOptions.workerSrc` est assigné via un flag `workerSrcSet` pour éviter de réécrire la propriété à chaque appel `extractTextFromPdf()`.

### SmartFolderModal — accessibilité WCAG 2.1
`role="dialog" aria-modal="true"` + focus trap Tab/Shift+Tab + restauration du focus à la fermeture.

### Background Sync — implémentation réelle
Protocole SW ↔ App :
1. Sauvegarde Firestore échoue → `registerBackgroundSync()` → SW reçoit `{ type: 'REGISTER_SYNC' }` → `reg.sync.register('sync-notes')`
2. Navigateur restaure la connexion → déclenche event `sync` dans le SW
3. SW appelle `clients.matchAll()` → envoie `{ type: 'BACKGROUND_SYNC_READY' }` à chaque onglet
4. NotesEditor écoute via `navigator.serviceWorker.addEventListener('message', ...)` → re-tente `updateNote()`

Fallback : si Background Sync API non supporté (iOS Safari, Firefox), Firestore SDK gère la retry via sa file d'attente interne IndexedDB.

### notes-utils.ts — fonctions pures testables
`stripHtml`, `fmtDate`, `daysUntilPurge`, `applySmartFilters`, `buildFolderTree` sont extraites de `NotesEditor.tsx` vers `lib/notes-utils.ts`.
NotesEditor les importe — zéro duplication. 36 tests les couvrent dans `__tests__/notesUtils.test.ts`.

### Vulnérabilités npm restantes (5)
- **nanoid + mermaid** : dans `@excalidraw/mermaid-to-excalidraw` — fix nécessite excalidraw@0.17.6 (breaking)
- **next@14.x** : 4 CVE — fix nécessite Next.js 16.2.0 (breaking change majeur)
- **dompurify** : fixé via `overrides` dans package.json (`^3.3.3`)

---

*Projet créé le 2026-03-18 — extrait de [portfolio](https://portfolio.djefrid.ca)*
