/**
 * ============================================================================
 * SERVICE NOTES — lib/notes-service.ts
 * ============================================================================
 *
 * Couche d'accès aux données Firebase Firestore pour l'éditeur de notes.
 * Exporte toutes les opérations CRUD sur les notes, dossiers et tags.
 *
 * Collections Firestore :
 *   - `adminNotes`    : les notes (titre, contenu HTML, pinned, folderId, tags, dates)
 *   - `adminFolders`  : dossiers normaux + dossiers intelligents (isSmart + filters)
 *   - `adminTags`     : bibliothèque de tags manuels (doc ID = nom du tag)
 *
 * ── Modèle de données ──────────────────────────────────────────────────────
 *
 * Note :
 *   - `deletedAt: null`  → note active
 *   - `deletedAt: Date`  → dans la corbeille (soft delete, 30 jours avant purge)
 *   - `folderId: null`   → dans l'Inbox (toutes mes notes sans dossier)
 *   - `tags[]`           → auto-extraits du contenu HTML via extractHashtags
 *
 * Folder :
 *   - `parentId: null`   → dossier racine
 *   - `isSmart: true`    → dossier intelligent (filtré dynamiquement côté client)
 *   - `filters`          → SmartFolderFilter appliqué dans applySmartFilters()
 *
 * Tag :
 *   - Le nom du tag est le doc ID dans adminTags → upsert idempotent
 *   - Les tags sont aussi auto-créés lors de `updateNote` si nouveaux
 *
 * ── Nettoyage Firebase Storage ─────────────────────────────────────────────
 *
 * Quand une note est mise à jour, les images/fichiers retirés du contenu
 * sont supprimés de Firebase Storage (diff old/new URLs).
 * La suppression définitive efface tous les fichiers Storage de la note.
 *
 * ── Suppression douce vs définitive ────────────────────────────────────────
 *
 * - `deleteNote`          : soft delete → Corbeille (récupérable 30j)
 * - `permanentlyDeleteNote`: suppression définitive + nettoyage Storage
 * - `silentlyDeleteNote`  : suppression sans trace (notes vides) — Apple Notes behavior
 * - `recoverNote`         : restore depuis la Corbeille (deletedAt → null)
 *
 * ── Suppression de dossier ─────────────────────────────────────────────────
 *
 * `deleteFolder` est une opération batch atomique :
 *   1. Notes directes du dossier → déplacées vers l'Inbox (folderId: null)
 *   2. Sous-dossiers directs → rattachés au grand-parent (ou racine)
 *   3. Dossier lui-même → supprimé
 * ============================================================================
 */

import { db, storage } from '@/lib/firebase/config';
import {
  collection, addDoc, updateDoc, deleteDoc, setDoc, getDoc,
  doc, serverTimestamp, writeBatch, getDocs, query, where,
} from 'firebase/firestore';
import { ref as storageRef, deleteObject } from 'firebase/storage';

// ── Types ────────────────────────────────────────────────────────────────────

/** Représente une note dans Firestore */
export interface Note {
  id: string;
  title: string;
  content: string;           // HTML TipTap
  pinned: boolean;
  folderId: string | null;   // null = Inbox (sans dossier)
  tags: string[];            // Auto-extraits du contenu (#tag)
  deletedAt: Date | null;    // null = active, Date = dans la corbeille
  createdAt: Date;
  updatedAt: Date;
}

/** Filtres d'un dossier intelligent (évalués côté client) */
export interface SmartFolderFilter {
  tags?: string[];             // Filtrer par tags
  tagLogic?: 'and' | 'or';    // 'or' par défaut (au moins un tag)
  pinned?: boolean;            // Épinglées uniquement
  createdWithinDays?: number;  // Créées dans les N derniers jours
  modifiedWithinDays?: number; // Modifiées dans les N derniers jours
}

/** Représente un dossier dans Firestore (normal ou intelligent) */
export interface Folder {
  id: string;
  name: string;
  order: number;
  parentId: string | null;   // null = dossier racine
  isSmart?: boolean;         // true = dossier intelligent (avec filtres)
  filters?: SmartFolderFilter;
  createdAt: Date;
  updatedAt: Date;
}

/** Un tag dans la bibliothèque adminTags */
export interface Tag {
  name: string;    // = doc ID dans adminTags (garantit l'unicité)
  createdAt: Date;
}

// ── Extraction automatique des hashtags ──────────────────────────────────────

/**
 * Supprime les balises HTML du contenu TipTap.
 * Compatible plain text ET HTML (p, div, br, h1-h6, li, ul, ol).
 * Décode aussi les entités HTML courantes (&amp;, &lt;, &gt;, &nbsp;).
 */
function stripHtml(html: string): string {
  return html
    .replace(/<\/?(p|div|br|h[1-6]|li|ul|ol)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

/**
 * Extrait tous les hashtags (#tag) depuis le contenu d'une note.
 * Travaille sur le texte brut (HTML strippé).
 *
 * Regex : `(?<![/#\w])#([a-zA-Z\u00C0-\u024F][...]*)`
 *   - Lookbehind négatif : exclut les # dans les URLs (#fragment) et les titres Markdown
 *   - Premier caractère : lettre (pas chiffre) pour distinguer #1tag d'un vrai tag
 *   - Supporte les caractères accentués (français, etc.) via range Unicode
 *
 * @param content - HTML ou texte brut de la note
 * @returns Liste de tags en minuscules, dédupliqués
 */
export function extractHashtags(content: string): string[] {
  const text  = stripHtml(content);
  const regex = /(?<![/#\w])#([a-zA-Z\u00C0-\u024F][a-zA-Z0-9\u00C0-\u024F_-]*)/g;
  const tags = new Set<string>();
  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    tags.add(match[1].toLowerCase());
  }
  return Array.from(tags);
}

// ── Nettoyage Firebase Storage ────────────────────────────────────────────────

/**
 * Extrait toutes les URLs Firebase Storage présentes dans le HTML d'une note.
 * Couvre les images inline (`<img src="...">`) et les liens de fichiers joints.
 */
function extractStorageUrls(html: string): string[] {
  if (!html) return [];
  const regex = /https:\/\/firebasestorage\.googleapis\.com\/[^"'\s>)]+/g;
  const urls: string[] = [];
  let m: RegExpExecArray | null;
  while ((m = regex.exec(html)) !== null) urls.push(m[0]);
  return urls;
}

/**
 * Supprime tous les fichiers Storage liés au contenu d'une note.
 * Utilisé avant la suppression définitive d'une note.
 * `Promise.allSettled` : ne bloque pas si un fichier a déjà été supprimé.
 */
async function deleteNoteStorageFiles(content: string): Promise<void> {
  if (!storage) return;
  const urls = extractStorageUrls(content);
  if (urls.length === 0) return;
  await Promise.allSettled(
    urls.map(url => deleteObject(storageRef(storage!, url)))
  );
}

// ── Notes CRUD ───────────────────────────────────────────────────────────────

/**
 * Crée une nouvelle note vide dans Firestore.
 * @param folderId - Dossier cible (null = Inbox)
 * @returns ID Firestore de la nouvelle note
 */
export async function createNote(folderId: string | null = null): Promise<string> {
  if (!db) throw new Error('Firebase non configuré');
  const ref = await addDoc(collection(db, 'adminNotes'), {
    title: '',
    content: '',
    pinned: false,
    folderId,
    tags: [],
    deletedAt: null,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Met à jour une note existante.
 * Si `content` est fourni :
 *   - Extrait et sauvegarde les tags
 *   - Sync automatique des nouveaux tags dans adminTags (batch idempotent)
 *   - Nettoyage Storage : supprime les images/fichiers retirés du contenu
 *     (diff entre les URLs de l'ancien contenu et du nouveau)
 *
 * @param id   - ID de la note
 * @param data - Champs à mettre à jour (title, content, pinned, folderId)
 */
export async function updateNote(
  id: string,
  data: Partial<Pick<Note, 'title' | 'content' | 'pinned' | 'folderId'>>
): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  const _db = db; // Capture référence non-null pour les callbacks async
  const payload: Record<string, unknown> = { ...data, updatedAt: serverTimestamp() };
  if (typeof data.content === 'string') {
    const newTags = extractHashtags(data.content);
    payload.tags = newTags;
    // Sync automatique des nouveaux tags vers la bibliothèque adminTags
    if (newTags.length > 0) {
      const batch = writeBatch(_db);
      newTags.forEach(tag => {
        batch.set(doc(_db, 'adminTags', tag), { name: tag, createdAt: serverTimestamp() }, { merge: true });
      });
      await batch.commit();
    }
    // Nettoyage Storage : supprimer les images/fichiers retirés du contenu
    if (storage) {
      const snap = await getDoc(doc(_db, 'adminNotes', id));
      if (snap.exists()) {
        const oldUrls = extractStorageUrls(snap.data().content ?? '');
        const newUrls = extractStorageUrls(data.content);
        const newUrlSet = new Set(newUrls);
        const removed = oldUrls.filter(u => !newUrlSet.has(u));
        if (removed.length > 0) {
          await Promise.allSettled(
            removed.map(url => deleteObject(storageRef(storage!, url)))
          );
        }
      }
    }
  }
  await updateDoc(doc(_db, 'adminNotes', id), payload);
}

/**
 * Soft delete — déplace la note dans la Corbeille.
 * La note reste dans Firestore avec `deletedAt: serverTimestamp()`.
 * Elle sera purgée automatiquement après 30 jours par `useAdminNotes`.
 */
export async function deleteNote(id: string): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  await updateDoc(doc(db, 'adminNotes', id), {
    deletedAt: serverTimestamp(),
    pinned: false,
  });
}

/**
 * Suppression définitive — irréversible.
 * Nettoie aussi tous les fichiers Storage associés au contenu de la note.
 */
export async function permanentlyDeleteNote(id: string): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  const snap = await getDoc(doc(db, 'adminNotes', id));
  if (snap.exists()) {
    await deleteNoteStorageFiles(snap.data().content ?? '');
  }
  await deleteDoc(doc(db, 'adminNotes', id));
}

/**
 * Récupère une note depuis la Corbeille.
 * Remet `deletedAt` à null → la note réapparaît dans son dossier d'origine.
 */
export async function recoverNote(id: string): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  await updateDoc(doc(db, 'adminNotes', id), {
    deletedAt: null,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Suppression silencieuse d'une note vide (comportement Apple Notes).
 * Utilisé quand l'utilisateur navigue hors d'une note créée mais jamais remplie.
 * Pas de passage par la Corbeille — suppression directe + nettoyage Storage.
 */
export async function silentlyDeleteNote(id: string): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  const snap = await getDoc(doc(db, 'adminNotes', id));
  if (snap.exists()) {
    await deleteNoteStorageFiles(snap.data().content ?? '');
  }
  await deleteDoc(doc(db, 'adminNotes', id));
}

/**
 * Déplace une note vers un autre dossier (ou l'Inbox si folderId = null).
 */
export async function moveNote(noteId: string, folderId: string | null): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  await updateDoc(doc(db, 'adminNotes', noteId), {
    folderId,
    updatedAt: serverTimestamp(),
  });
}

// ── Tags CRUD ─────────────────────────────────────────────────────────────────

/**
 * Crée ou met à jour un tag dans la bibliothèque adminTags.
 * Le nom normalisé est utilisé comme doc ID → upsert idempotent, pas de doublons.
 *
 * Normalisation :
 *   1. Minuscules
 *   2. Suppression des accents
 *   3. Remplacement des caractères non-alphanumériques par des tirets
 *   4. Suppression des tirets au début/fin
 */
export async function createTag(name: string): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  const normalized = name.toLowerCase().trim().replace(/[^a-zA-Z0-9\u00C0-\u024F_-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
  if (!normalized) return;
  await setDoc(doc(db, 'adminTags', normalized), {
    name: normalized,
    createdAt: serverTimestamp(),
  }, { merge: true });
}

/**
 * Supprime un tag de la bibliothèque adminTags.
 * Les notes qui utilisaient ce tag conservent leurs tags (pas de cascade).
 */
export async function deleteTag(name: string): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  await deleteDoc(doc(db, 'adminTags', name));
}

// ── Folders CRUD ─────────────────────────────────────────────────────────────

/**
 * Crée un nouveau dossier normal dans Firestore.
 * @param name     - Nom affiché dans la sidebar
 * @param order    - Position dans la liste (0-based)
 * @param parentId - Dossier parent (null = dossier racine)
 * @returns ID Firestore du nouveau dossier
 */
export async function createFolder(
  name: string,
  order: number,
  parentId: string | null = null
): Promise<string> {
  if (!db) throw new Error('Firebase non configuré');
  const ref = await addDoc(collection(db, 'adminFolders'), {
    name,
    order,
    parentId,
    isSmart: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Crée un nouveau dossier intelligent avec filtres.
 * @param name    - Nom du dossier
 * @param order   - Position dans la liste
 * @param filters - Filtres dynamiques (tags, pinned, dates)
 * @returns ID Firestore du nouveau dossier
 */
export async function createSmartFolder(
  name: string,
  order: number,
  filters: SmartFolderFilter
): Promise<string> {
  if (!db) throw new Error('Firebase non configuré');
  const ref = await addDoc(collection(db, 'adminFolders'), {
    name,
    order,
    isSmart: true,
    filters,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  });
  return ref.id;
}

/**
 * Met à jour le nom ou l'ordre d'un dossier.
 */
export async function updateFolder(
  id: string,
  data: Partial<Pick<Folder, 'name' | 'order'>>
): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  await updateDoc(doc(db, 'adminFolders', id), {
    ...data,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Met à jour le nom et les filtres d'un dossier intelligent.
 */
export async function updateSmartFolderFilters(
  id: string,
  name: string,
  filters: SmartFolderFilter
): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  await updateDoc(doc(db, 'adminFolders', id), {
    name,
    filters,
    updatedAt: serverTimestamp(),
  });
}

/**
 * Supprime un dossier et gère les entités orphelines via un batch atomique.
 *
 * Comportement en cascade :
 *   1. Notes directes du dossier → Inbox (folderId: null)
 *   2. Sous-dossiers directs → rattachés au grand-parent (ou racine si null)
 *   3. Dossier → supprimé
 *
 * Tout est exécuté dans un `writeBatch` pour garantir l'atomicité.
 */
export async function deleteFolder(id: string): Promise<void> {
  if (!db) throw new Error('Firebase non configuré');
  // Lire le parentId du dossier supprimé pour re-parenter ses sous-dossiers
  const folderDoc = await getDoc(doc(db, 'adminFolders', id));
  const grandParentId: string | null = folderDoc.exists()
    ? (folderDoc.data().parentId ?? null)
    : null;
  const batch = writeBatch(db);
  // Notes directes → inbox
  const noteSnap = await getDocs(
    query(collection(db, 'adminNotes'), where('folderId', '==', id))
  );
  noteSnap.docs.forEach((d) =>
    batch.update(d.ref, { folderId: null, updatedAt: serverTimestamp() })
  );
  // Sous-dossiers directs → grand-parent (ou racine si null)
  const subSnap = await getDocs(
    query(collection(db, 'adminFolders'), where('parentId', '==', id))
  );
  subSnap.docs.forEach((d) =>
    batch.update(d.ref, { parentId: grandParentId, updatedAt: serverTimestamp() })
  );
  batch.delete(doc(db, 'adminFolders', id));
  await batch.commit();
}
