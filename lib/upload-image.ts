/**
 * ============================================================================
 * UPLOAD FIREBASE STORAGE — lib/upload-image.ts
 * ============================================================================
 *
 * Fonctions d'upload vers Firebase Storage pour l'éditeur Notes.
 * Deux fonctions distinctes : images inline et fichiers joints.
 *
 * Architecture d'upload :
 *   - `uploadBytesResumable` : upload avec suivi de progression
 *     (contrairement à `uploadBytes` qui ne rapporte pas le pourcentage)
 *   - Le callback `onProgress` permet d'afficher une barre de progression
 *     dans l'éditeur (state `uploadProgress` dans NotesEditor)
 *   - La promesse se résout avec l'URL publique de téléchargement
 *
 * Nommage des fichiers :
 *   - Sanitisation du nom : `[^a-zA-Z0-9._-]` → `_` (évite les espaces/accents)
 *   - Préfixe `Date.now()_` : garantit l'unicité même si le même fichier
 *     est uploadé plusieurs fois
 *
 * Structure Storage :
 *   notes/{noteId}/{timestamp}_{filename}         → images inline
 *   notes/{noteId}/files/{timestamp}_{filename}   → fichiers joints
 *
 * Sécurité :
 *   - Types MIME whitelist pour les images (jpeg, png, gif, webp, svg)
 *   - Limite 10 Mo pour les images, 50 Mo pour les fichiers
 *   - Vérification que Storage est configuré avant tout upload
 * ============================================================================
 */

import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { storage } from '@/lib/firebase/config';

/** Types d'image acceptés pour l'insertion inline dans les notes */
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml'];
/** Taille maximale pour une image inline (10 Mo) */
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
/** Taille maximale pour un fichier joint (50 Mo) */
const MAX_FILE_BYTES = 50 * 1024 * 1024;

/**
 * Upload une image vers Firebase Storage dans `notes/{noteId}/`.
 * Retourne l'URL publique de téléchargement utilisée comme `src` de l'image TipTap.
 *
 * @param file       - Fichier image (depuis paste, drag-drop ou input file)
 * @param noteId     - ID de la note cible (pour organiser le Storage)
 * @param onProgress - Callback appelé avec le pourcentage (0-100) pendant l'upload
 * @returns URL publique Firebase Storage
 * @throws Si Storage non configuré, type non supporté, ou fichier trop grand
 */
export async function uploadNoteImage(
  file: File,
  noteId: string,
  onProgress?: (percent: number) => void
): Promise<string> {
  if (!storage) throw new Error('Firebase Storage non configuré');
  if (!ALLOWED_TYPES.includes(file.type)) throw new Error('Format non supporté (jpg, png, gif, webp)');
  if (file.size > MAX_SIZE_BYTES) throw new Error('Image trop grande (max 10 Mo)');

  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path     = `notes/${noteId}/${Date.now()}_${safeName}`;
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
 * Upload un fichier quelconque vers Firebase Storage dans `notes/{noteId}/files/`.
 * Retourne l'URL publique, le nom original et la taille du fichier.
 * Le fichier est inséré comme lien dans l'éditeur (pas inline comme une image).
 *
 * @param file       - N'importe quel fichier (PDF, ZIP, etc.)
 * @param noteId     - ID de la note cible
 * @param onProgress - Callback de progression (0-100)
 * @returns { url, name, size } — URL publique, nom original, taille en bytes
 * @throws Si Storage non configuré ou fichier trop grand (max 50 Mo)
 */
export async function uploadNoteFile(
  file: File,
  noteId: string,
  onProgress?: (percent: number) => void
): Promise<{ url: string; name: string; size: number }> {
  if (!storage) throw new Error('Firebase Storage non configuré');
  if (file.size > MAX_FILE_BYTES) throw new Error('Fichier trop grand (max 50 Mo)');

  const safeName   = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path       = `notes/${noteId}/files/${Date.now()}_${safeName}`;
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
