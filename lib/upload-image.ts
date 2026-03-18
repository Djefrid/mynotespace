/**
 * ============================================================================
 * UPLOAD FIREBASE STORAGE — lib/upload-image.ts
 * ============================================================================
 *
 * Fonctions d'upload vers Firebase Storage pour l'éditeur Notes.
 * Deux fonctions distinctes : images inline et fichiers joints.
 *
 * Structure Storage (correspondant aux règles Firebase Console) :
 *   notes/images/{timestamp}_{filename}  → images inline (lecture publique)
 *   notes/files/{timestamp}_{filename}   → fichiers joints (admin uniquement)
 *
 * Architecture d'upload :
 *   - `uploadBytesResumable` : upload avec suivi de progression
 *   - Le callback `onProgress` permet d'afficher une barre de progression
 *
 * Nommage des fichiers :
 *   - Sanitisation : `[^a-zA-Z0-9._-]` → `_` (évite espaces et accents)
 *   - Préfixe `Date.now()_` : garantit l'unicité
 *
 * Limites (cohérentes avec les règles Firebase Console) :
 *   - Images : max 10 Mo, MIME image/*
 *   - Fichiers : max 25 Mo
 * ============================================================================
 */

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

/** Types d'image acceptés pour l'insertion inline dans les notes */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
/** Taille maximale pour une image inline — cohérent avec la règle console (10 Mo) */
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
/** Taille maximale pour un fichier joint — cohérent avec la règle console (25 Mo) */
const MAX_FILE_BYTES = 25 * 1024 * 1024;

/**
 * Upload une image vers Firebase Storage dans `notes/images/`.
 * Chemin correspondant à la règle console : match /notes/images/{fileName}
 * Retourne l'URL publique de téléchargement utilisée comme `src` de l'image TipTap.
 *
 * @param file       - Fichier image (depuis paste, drag-drop ou input file)
 * @param _noteId    - ID de la note (conservé pour compatibilité API — non utilisé dans le chemin)
 * @param onProgress - Callback appelé avec le pourcentage (0-100) pendant l'upload
 * @returns URL publique Firebase Storage
 * @throws Si Storage non configuré, type non supporté, ou fichier trop grand
 */
export async function uploadNoteImage(
  file: File,
  _noteId: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!storage) throw new Error('Firebase Storage non configuré');
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Format non supporté (jpg, png, gif, webp)');
  if (file.size > MAX_SIZE_BYTES) throw new Error('Image trop grande (max 10 Mo)');

  // Chemin plat notes/images/{filename} — correspondant à la règle console
  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path       = `notes/images/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  const task       = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        // Calcul du pourcentage et appel du callback de progression
        const pct = Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100);
        onProgress?.(pct);
      },
      reject,
      // Résolution avec l'URL publique une fois l'upload terminé
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        resolve(url);
      }
    );
  });
}

/**
 * Upload un fichier quelconque vers Firebase Storage dans `notes/files/`.
 * Chemin correspondant à la règle console : match /notes/files/{fileName}
 * Retourne l'URL publique, le nom original et la taille du fichier.
 *
 * @param file       - N'importe quel fichier (PDF, ZIP, etc.)
 * @param _noteId    - ID de la note (conservé pour compatibilité API — non utilisé dans le chemin)
 * @param onProgress - Callback de progression (0-100)
 * @returns { url, name, size } — URL publique, nom original, taille en bytes
 * @throws Si Storage non configuré ou fichier trop grand (max 25 Mo)
 */
export async function uploadNoteFile(
  file: File,
  _noteId: string,
  onProgress?: (percent: number) => void
): Promise<{ url: string; name: string; size: number }> {
  if (!storage) throw new Error('Firebase Storage non configuré');
  if (file.size > MAX_FILE_BYTES) throw new Error('Fichier trop grand (max 25 Mo)');

  // Chemin plat notes/files/{filename} — correspondant à la règle console
  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path       = `notes/files/${Date.now()}_${safeName}`;
  const storageRef = ref(storage, path);
  const task       = uploadBytesResumable(storageRef, file);

  return new Promise((resolve, reject) => {
    task.on(
      'state_changed',
      (snapshot) => {
        const pct = Math.round(snapshot.bytesTransferred / snapshot.totalBytes * 100);
        onProgress?.(pct);
      },
      reject,
      async () => {
        const url = await getDownloadURL(task.snapshot.ref);
        // Retourne aussi le nom original (pour l'affichage dans le lien)
        resolve({ url, name: file.name, size: file.size });
      }
    );
  });
}
