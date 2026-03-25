/**
 * ============================================================================
 * HOOK IMAGE & FICHIER — hooks/notes/useImageFile.ts
 * ============================================================================
 *
 * Gère l'upload des images et fichiers joints dans l'éditeur TipTap.
 *
 * Fonctionnalités :
 *   - handleImageInsert : compresse l'image (si > 500 Ko), upload Firebase,
 *     insère une balise <img> inline dans l'éditeur
 *   - handleFileInsert  : upload un fichier quelconque, insère un lien 📎 inline
 *   - uploadProgress    : progression de l'upload (0–100 ou null)
 *
 * Architecture ref anti-stale-closure :
 *   handleImageInsertRef et handleFileInsertRef sont retournés pour être
 *   passés dans les editorProps (handlePaste, handleDrop) de useNoteEditor.
 *
 * Paramètres reçus :
 *   editor           — instance TipTap courante (null avant montage)
 *   selectedId       — ID de la note ouverte (pour construire le path Firebase)
 *   title            — titre courant (pour autosave après insertion)
 *   scheduleAutoSave — planifie une sauvegarde différée
 *   setContent       — met à jour le contenu React après chaque insertion
 * ============================================================================
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import type { MutableRefObject } from 'react';
import type { Editor } from '@tiptap/core';
import { uploadNoteImage, uploadNoteFile } from '@/lib/upload-image';
import imageCompression from 'browser-image-compression';
import type { NoteContentPayload } from '@/lib/notes-types';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useImageFile({
  editorRef,
  selectedId,
  title,
  scheduleAutoSave,
  setContent,
}: {
  /** Ref partagée vers l'instance TipTap — peuplée par useNoteEditor, stable entre les renders */
  editorRef:        MutableRefObject<Editor | null>;
  /** ID de la note ouverte — nécessaire pour construire le chemin Firebase Storage */
  selectedId:       string | null;
  /** Titre courant — passé à scheduleAutoSave après insertion */
  title:            string;
  /** Planifie une sauvegarde différée après modification du contenu */
  scheduleAutoSave: (t: string, c: NoteContentPayload | string) => void;
  /** Met à jour l'état React du contenu après l'insertion (sync avec TipTap) */
  setContent:       (html: string) => void;
}) {

  // ── Progression de l'upload (0–100 | null) ─────────────────────────────────
  /** Pourcentage de l'upload en cours — null quand aucun upload actif */
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);

  // ── Ref anti-stale-closure pour handlePaste / handleDrop ───────────────────
  /** Ref vers handleImageInsert — à passer à useNoteEditor pour handlePaste/handleDrop */
  const handleImageInsertRef = useRef<(file: File) => void>(() => {});
  /** Ref vers handleFileInsert — à passer à useNoteEditor pour handleDrop */
  const handleFileInsertRef  = useRef<(file: File) => void>(() => {});

  // ── Upload image ────────────────────────────────────────────────────────────
  /**
   * Compresse l'image si elle dépasse 500 Ko, puis l'upload dans Firebase Storage.
   * Insère ensuite une balise <img> inline dans l'éditeur et planifie l'autosave.
   *
   * Compression :
   *   maxSizeMB: 1 — max 1 Mo (vs potentiellement 10-20 Mo pour un RAW)
   *   maxWidthOrHeight: 1920 — suffit pour un éditeur de notes
   *   useWebWorker: true — compression hors du thread principal (UI non bloquée)
   */
  const handleImageInsert = useCallback(async (file: File) => {
    // Lecture de editorRef.current au moment de l'appel (anti-stale-closure)
    const editor = editorRef.current;
    if (!editor || !selectedId) return;
    try {
      setUploadProgress(0);
      let fileToUpload = file;
      // Compression si l'image dépasse 500 Ko
      if (file.type.startsWith('image/') && file.size > 500 * 1024) {
        try {
          fileToUpload = await imageCompression(file, {
            maxSizeMB:        1,
            maxWidthOrHeight: 1920,
            useWebWorker:     true,
            fileType:         file.type as Parameters<typeof imageCompression>[1]['fileType'],
          });
        } catch {
          // Compression échouée → upload du fichier original
          fileToUpload = file;
        }
      }
      const url = await uploadNoteImage(fileToUpload, selectedId, pct => setUploadProgress(pct));
      editor.chain().focus().setImage({ src: url, alt: file.name }).run();
      const html      = editor.getHTML();
      const json      = editor.getJSON() as Record<string, unknown>;
      const plainText = editor.getText();
      setContent(html);
      scheduleAutoSave(title, { html, json, plainText });
    } catch (err) {
      console.error('Upload image:', err);
    } finally {
      setUploadProgress(null);
    }
  }, [editorRef, selectedId, title, scheduleAutoSave, setContent]);

  /** Sync handleImageInsertRef après chaque recréation du callback */
  useEffect(() => { handleImageInsertRef.current = handleImageInsert; }, [handleImageInsert]);

  // ── Upload fichier joint ────────────────────────────────────────────────────
  /**
   * Upload un fichier quelconque dans Firebase Storage.
   * Insère un lien "📎 nom_du_fichier" inline dans l'éditeur.
   * Utilise un nœud ProseMirror JSON (plus fiable que du HTML brut avec Link).
   */
  const handleFileInsert = useCallback(async (file: File) => {
    // Lecture de editorRef.current au moment de l'appel (anti-stale-closure)
    const editor = editorRef.current;
    if (!editor || !selectedId) return;
    try {
      setUploadProgress(0);
      const { url, name } = await uploadNoteFile(file, selectedId, pct => setUploadProgress(pct));
      editor.chain().focus().insertContent([
        {
          type: 'text',
          text: `📎 ${name}`,
          marks: [{
            type: 'link',
            attrs: { href: url, target: '_blank', rel: 'noopener noreferrer' },
          }],
        },
        { type: 'text', text: ' ' },
      ]).run();
      const html      = editor.getHTML();
      const json      = editor.getJSON() as Record<string, unknown>;
      const plainText = editor.getText();
      setContent(html);
      scheduleAutoSave(title, { html, json, plainText });
    } catch (err) {
      console.error('Upload fichier:', err);
    } finally {
      setUploadProgress(null);
    }
  }, [editorRef, selectedId, title, scheduleAutoSave, setContent]);

  /** Sync handleFileInsertRef après chaque recréation du callback */
  useEffect(() => { handleFileInsertRef.current = handleFileInsert; }, [handleFileInsert]);

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    uploadProgress,
    setUploadProgress,
    handleImageInsert,
    handleFileInsert,
    handleImageInsertRef,
    handleFileInsertRef,
  };
}
