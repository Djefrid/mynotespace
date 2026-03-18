# mynotespace

Éditeur de notes riche personnel — PWA installable sur mobile et desktop.

**Stack :** Next.js 14 · TypeScript · Tailwind CSS · Firebase · TipTap 3

**URL de production :** https://notes.djefrid.ca

---

## Fonctionnalités

### Éditeur TipTap — style Word complet
- **Toolbar Ribbon 4 onglets** : Accueil / Insertion / Paragraphe / Outils
- Police (famille, taille), styles (gras, italic, souligné, barré), couleurs, surlignage
- Tableaux, listes (ul/ol/tâches), blockquotes, règles horizontales
- Équations LaTeX inline via KaTeX (`$$formule$$`)
- Blocs de code avec coloration syntaxique (16 langages — Haskell exclu)
- Indentation style Word (Tab/Shift+Tab)

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
- **Fichiers joints** via Firebase Storage (lien dans le texte)

### PWA
- Installable sur iOS, Android, Chrome desktop
- Fonctionnement offline (cache Network First)
- Icônes 192×512 px

---

## Structure du projet

```
mynotespace/
├── app/
│   ├── layout.tsx          — layout racine (ThemeProvider, skip link)
│   ├── page.tsx            — redirect → /notes
│   ├── globals.css         — styles globaux + TipTap
│   ├── manifest.ts         — PWA manifest
│   ├── login/
│   │   └── page.tsx        — connexion email/mdp + Google OAuth
│   └── notes/
│       └── page.tsx        — page principale (garde auth + NotesEditor)
├── components/
│   ├── NotesEditor.tsx     — éditeur complet (3447 lignes — copié du portfolio)
│   └── Providers.tsx       — ThemeProvider + enregistrement SW
├── hooks/
│   └── useAdminNotes.ts    — 3 listeners Firestore temps réel
├── lib/
│   ├── firebase/
│   │   ├── config.ts       — initialisation Firebase
│   │   └── hooks.ts        — useAuth() (signIn, signInWithGoogle, signOut)
│   ├── tiptap-extensions/
│   │   ├── indent.ts       — indentation custom Tab/Shift+Tab
│   │   └── font-size.ts    — taille de police en points
│   ├── notes-service.ts    — CRUD Firestore (notes, dossiers, tags)
│   ├── upload-image.ts     — upload Firebase Storage (images + fichiers)
│   ├── docx-utils.ts       — import/export DOCX
│   ├── pdf-utils.ts        — extraction texte PDF
│   └── utils.ts            — cn() (clsx + tailwind-merge)
├── types/
│   └── index.ts            — ré-exports types (Note, Folder, Tag)
├── public/
│   ├── sw.js               — Service Worker PWA v1
│   ├── icon-192.png        — icône PWA 192×192
│   ├── icon-512.png        — icône PWA 512×512
│   └── favicon.svg
├── middleware.ts            — CSP nonce-based + bypass /__/auth/*
├── next.config.js           — proxy Firebase Auth + headers sécurité
└── .env.local               — variables Firebase (gitignored)
```

---

## Firebase

**Projet partagé avec le portfolio :** `portfolio-8d07b`

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
NEXT_PUBLIC_FIREBASE_PROJECT_ID=portfolio-8d07b
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...

NEXT_PUBLIC_ADMIN_EMAIL=djeffkuate@gmail.com
NEXT_PUBLIC_ADMIN_EMAIL_2=djefridbyli@gmail.com

NEXT_PUBLIC_SITE_URL=https://notes.djefrid.ca
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
# → http://localhost:3001 (ou 3000 si portfolio n'est pas lancé)
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

### Warning `sharp` (non-bloquant)
`@turbodocx/html-to-docx` a `sharp` comme dépendance optionnelle.
Le warning apparaît au build mais n'affecte pas le fonctionnement de l'export DOCX.

---

*Projet créé le 2026-03-18 — extrait de [portfolio](https://portfolio.djefrid.ca)*
