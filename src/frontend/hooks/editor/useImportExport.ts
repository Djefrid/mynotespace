/**
 * ============================================================================
 * HOOK IMPORT / EXPORT — hooks/notes/useImportExport.ts
 * ============================================================================
 *
 * Gère toutes les opérations d'import et d'export de notes :
 *   - Import  DOCX → HTML (mammoth)
 *   - Export  DOCX (html-to-docx)
 *   - Import  PDF  → texte brut (pdfjs-dist)
 *   - Export  Markdown (turndown — import dynamique SSR-safe)
 *   - Export  PDF (window.print dans une fenêtre dédiée)
 *
 * Refs d'input cachés :
 *   docxInputRef et pdfInputRef sont retournés pour être attachés aux
 *   <input type="file"> cachés dans le JSX (trigger depuis la toolbar).
 *
 * Paramètres reçus :
 *   editor           — instance TipTap courante (null avant montage)
 *   title            — titre courant (nom du fichier exporté + autosave)
 *   selectedNote     — note sélectionnée (guard avant export)
 *   scheduleAutoSave — planifie une sauvegarde différée après import
 *   setContent       — met à jour l'état React du contenu après import
 *   setUploadProgress — affiche la progression de l'import PDF
 * ============================================================================
 */

import { useRef, useCallback } from 'react';
import type { MutableRefObject } from 'react';
import type { Editor } from '@tiptap/core';
import type { Note } from '@/lib/notes-service';
import type { NoteContentPayload } from '@/lib/notes-types';
import { importDocx, exportDocx } from '@/lib/docx-utils';
import { extractTextFromPdf } from '@/lib/pdf-utils';

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useImportExport({
  editorRef,
  title,
  selectedNote,
  scheduleAutoSave,
  setContent,
  setUploadProgress,
}: {
  /** Ref partagée vers l'instance TipTap — peuplée par useNoteEditor, stable entre les renders */
  editorRef:          MutableRefObject<Editor | null>;
  /** Titre courant — utilisé comme nom de fichier lors des exports */
  title:              string;
  /** Note sélectionnée — guard avant export (null → export désactivé) */
  selectedNote:       Note | null;
  /** Planifie une sauvegarde différée après import — JSON source de vérité */
  scheduleAutoSave:   (t: string, c: NoteContentPayload | string) => void;
  /** Met à jour l'état React du contenu après import (sync TipTap → React) */
  setContent:         (html: string) => void;
  /** Affiche la progression de l'import PDF dans la toolbar */
  setUploadProgress:  (pct: number | null) => void;
}) {

  // ── Refs pour les <input type="file"> cachés ────────────────────────────────
  /** Ref vers l'<input> DOCX caché — cliquer depuis la toolbar déclenche l'import */
  const docxInputRef = useRef<HTMLInputElement>(null);
  /** Ref vers l'<input> PDF caché — cliquer depuis la toolbar déclenche l'import */
  const pdfInputRef  = useRef<HTMLInputElement>(null);

  // ── Import DOCX ─────────────────────────────────────────────────────────────
  /**
   * Lit le fichier .docx avec mammoth, injecte le HTML dans l'éditeur
   * et planifie une sauvegarde automatique.
   */
  const handleImportDocx = useCallback(async (file: File) => {
    // Lecture de editorRef.current au moment de l'appel (anti-stale-closure)
    const editor = editorRef.current;
    if (!editor) return;
    try {
      const html = await importDocx(file);
      // emitUpdate: false → pas d'onUpdate, on envoie le payload complet manuellement
      editor.commands.setContent(html, { emitUpdate: false });
      const newHtml   = editor.getHTML();
      const json      = editor.getJSON() as Record<string, unknown>;
      const plainText = editor.getText();
      setContent(newHtml);
      scheduleAutoSave(title, { html: newHtml, json, plainText });
    } catch (err) {
      console.error('Import DOCX:', err);
    }
  }, [editorRef, title, scheduleAutoSave, setContent]);

  // ── Export DOCX ─────────────────────────────────────────────────────────────
  /**
   * Exporte le contenu HTML de l'éditeur en fichier .docx téléchargeable.
   * Le nom du fichier correspond au titre de la note.
   */
  const handleExportDocx = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      await exportDocx(editor.getHTML(), title || 'note');
    } catch (err) {
      console.error('Export DOCX:', err);
    }
  }, [editorRef, title]);

  // ── Import PDF — extraction texte ───────────────────────────────────────────
  /**
   * Extrait le texte du PDF via pdfjs-dist (CDN worker, pas de rendu visuel).
   * Découpe en paragraphes, injecte dans l'éditeur et planifie l'autosave.
   */
  const handleImportPdf = useCallback(async (file: File) => {
    const editor = editorRef.current;
    if (!editor) return;
    try {
      setUploadProgress(0);
      const text = await extractTextFromPdf(file);
      setUploadProgress(50);
      const paragraphs = text
        .split(/\n{2,}/)
        .map(p => `<p>${p.replace(/\n/g, '<br>')}</p>`)
        .join('');
      editor.commands.setContent(paragraphs || '<p></p>', { emitUpdate: false });
      const html      = editor.getHTML();
      const json      = editor.getJSON() as Record<string, unknown>;
      const plainText = editor.getText();
      setContent(html);
      scheduleAutoSave(title, { html, json, plainText });
    } catch (err) {
      console.error('Import PDF:', err);
    } finally {
      setUploadProgress(null);
    }
  }, [editorRef, title, scheduleAutoSave, setContent, setUploadProgress]);

  // ── Export Markdown ─────────────────────────────────────────────────────────
  /**
   * Convertit le HTML de l'éditeur en Markdown (turndown — import dynamique
   * pour éviter les problèmes SSR). Déclenche le téléchargement du fichier .md.
   */
  const handleExportMarkdown = useCallback(async () => {
    const editor = editorRef.current;
    if (!editor || !selectedNote) return;
    const TurndownService = (await import('turndown')).default;
    const td = new TurndownService({ headingStyle: 'atx', codeBlockStyle: 'fenced' });
    const md = `# ${title}\n\n${td.turndown(editor.getHTML())}`;
    const blob = new Blob([md], { type: 'text/markdown' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url;
    a.download = `${title || 'note'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  }, [editorRef, title, selectedNote]);

  // ── Export PDF ─────────────────────────────────────────────────────────────
  /**
   * Ouvre une fenêtre d'impression avec le contenu de la note mis en forme.
   * Déclenche window.print() après un court délai (DOM fully rendered).
   */
  const handleExportPDF = useCallback(() => {
    const editor = editorRef.current;
    if (!editor || !selectedNote) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`<!DOCTYPE html><html><head>
      <meta charset="utf-8">
      <title>${title || 'Note'}</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; max-width: 800px; margin: 40px auto; padding: 0 20px; color: #111; line-height: 1.6; }
        h1 { font-size: 2em; border-bottom: 1px solid #eee; padding-bottom: .3em; }
        h2 { font-size: 1.5em; } h3 { font-size: 1.25em; }
        pre { background: #f6f8fa; border-radius: 6px; padding: 16px; overflow: auto; }
        code { background: #f6f8fa; border-radius: 3px; padding: .2em .4em; font-size: .9em; }
        blockquote { border-left: 4px solid #ddd; margin: 0; padding-left: 16px; color: #666; }
        table { border-collapse: collapse; width: 100%; }
        td, th { border: 1px solid #ddd; padding: 8px 12px; }
        th { background: #f6f8fa; font-weight: 600; }
        img { max-width: 100%; }
        ul[data-type="taskList"] { list-style: none; padding: 0; }
        li[data-type="taskItem"] > label { display: flex; gap: 8px; }
        a { color: #0366d6; }
        @media print { body { margin: 0; } }
      </style>
    </head><body>
      <h1>${title || 'Sans titre'}</h1>
      ${editor.getHTML()}
    </body></html>`);
    printWindow.document.close();
    printWindow.focus();
    // Délai 300ms — assure que le DOM est rendu avant l'impression
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 300);
  }, [editorRef, title, selectedNote]);

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    docxInputRef,
    pdfInputRef,
    handleImportDocx,
    handleExportDocx,
    handleImportPdf,
    handleExportMarkdown,
    handleExportPDF,
  };
}
