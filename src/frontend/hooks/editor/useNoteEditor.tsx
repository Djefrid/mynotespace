/**
 * ============================================================================
 * HOOK ÉDITEUR TIPTAP — hooks/notes/useNoteEditor.ts
 * ============================================================================
 *
 * Encapsule toute la configuration TipTap (useEditor) et les fonctionnalités
 * liées à l'éditeur lui-même (code modal, Excalidraw, export Excalidraw→PNG).
 *
 * Contenu :
 *   - useEditor avec 26 extensions + editorProps complets
 *   - Code modal : openCodeModal, applyCodeModal
 *   - Excalidraw : modal, ref API, insertExcalidraw (export PNG → Firebase)
 *   - Détection du bloc de code actif (isInCodeBlock, codeBlockLang)
 *   - Sync editor ↔ isReadOnly
 *
 * Architecture :
 *   Les callbacks editorProps (handlePaste, handleDrop, handleKeyDown, onUpdate)
 *   utilisent des refs "proxy" pour accéder aux valeurs les plus récentes sans
 *   recréer useEditor. Ces refs sont fournies par les hooks consommateurs
 *   (useContentAutocomplete, useImageFile).
 *
 *   `scheduleAutoSaveRef` est synchronisé ici via useEffect (ownership local).
 *
 * Options TipTap critiques :
 *   immediatelyRender: false  — obligatoire Next.js SSR (TipTap 3)
 *   shouldRerenderOnTransaction: false  — performance : pas de re-render React
 *     sur chaque transaction. La toolbar utilise useEditorState séparément.
 * ============================================================================
 */

import {
  useState, useRef, useCallback, useEffect, useMemo,
} from 'react';
import type { MutableRefObject } from 'react';
import type { NoteContentPayload } from '@/lib/notes-types';
import dynamic from 'next/dynamic';
import type { ExcalidrawImperativeAPI } from '@excalidraw/excalidraw/types';
import { useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { createLowlight } from 'lowlight';
// Seul plaintext chargé au démarrage — les autres langages sont lazy-loadés après le mount
import langPlaintext from 'highlight.js/lib/languages/plaintext';
import ImageExtension from '@tiptap/extension-image';
import Placeholder from '@tiptap/extension-placeholder';
import Underline from '@tiptap/extension-underline';
import Link from '@tiptap/extension-link';
import { Table } from '@tiptap/extension-table';
import { TableRow } from '@tiptap/extension-table-row';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableCell } from '@tiptap/extension-table-cell';
import TextAlign from '@tiptap/extension-text-align';
import Highlight from '@tiptap/extension-highlight';
import { TextStyle, FontFamily, FontSize, LineHeight } from '@tiptap/extension-text-style';
import Color from '@tiptap/extension-color';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import Superscript from '@tiptap/extension-superscript';
import Subscript from '@tiptap/extension-subscript';
import CharacterCount from '@tiptap/extension-character-count';
import Mathematics from '@tiptap/extension-mathematics';
import { Indent } from '@/lib/tiptap-extensions/indent';
import { uploadNoteImage } from '@/lib/upload-image';
import { SLASH_CMDS } from '@/lib/notes-types';

// ── Lowlight — module-level pour éviter la recréation à chaque render ─────────
// Seul plaintext est enregistré immédiatement. Les autres langages sont chargés
// dynamiquement après le mount (lazy) pour réduire le bundle initial (~150 kB).
// Haskell exclu : crash prod (regex invalide dans la grammaire highlight.js).
const lowlight = createLowlight();
lowlight.register({ plaintext: langPlaintext });

/** Charge les langages de syntaxe en arrière-plan après le mount de l'éditeur */
async function loadHighlightLanguages() {
  const [
    { default: langJs },   { default: langTs },  { default: langPy },
    { default: langCss },  { default: langHtml }, { default: langBash },
    { default: langJson }, { default: langSql },  { default: langGo },
    { default: langRust }, { default: langJava }, { default: langPhp },
    { default: langCsharp },{ default: langCpp }, { default: langMarkdown },
  ] = await Promise.all([
    import('highlight.js/lib/languages/javascript'),
    import('highlight.js/lib/languages/typescript'),
    import('highlight.js/lib/languages/python'),
    import('highlight.js/lib/languages/css'),
    import('highlight.js/lib/languages/xml'),
    import('highlight.js/lib/languages/bash'),
    import('highlight.js/lib/languages/json'),
    import('highlight.js/lib/languages/sql'),
    import('highlight.js/lib/languages/go'),
    import('highlight.js/lib/languages/rust'),
    import('highlight.js/lib/languages/java'),
    import('highlight.js/lib/languages/php'),
    import('highlight.js/lib/languages/csharp'),
    import('highlight.js/lib/languages/cpp'),
    import('highlight.js/lib/languages/markdown'),
  ]);
  lowlight.register({
    javascript: langJs, typescript: langTs, python: langPy,
    css: langCss,       xml: langHtml,      bash: langBash,
    json: langJson,     sql: langSql,       go: langGo,
    rust: langRust,     java: langJava,     php: langPhp,
    csharp: langCsharp, cpp: langCpp,       markdown: langMarkdown,
  });
}

// ── Types ─────────────────────────────────────────────────────────────────────

/** Type de l'état du code modal */
interface CodeModalState {
  open:    boolean;
  code:    string;
  lang:    string;
  isEdit:  boolean;
  from:    number;
  to:      number;
}

/** Paramètres du hook useNoteEditor */
interface UseNoteEditorParams {
  // ── Ref partagée — peuplée par ce hook, utilisée par useImageFile/useImportExport/useContentAutocomplete ─
  /** Ref partagée vers l'instance editor — créée dans NotesEditor, peuplée ici via useEffect */
  editorRef:        MutableRefObject<Editor | null>;
  // ── Valeurs d'état (changent au fil du temps) ────────────────────────────────
  /** ID de la note ouverte — pour insertExcalidraw (upload Firebase) */
  selectedId:       string | null;
  /** true si la note est en corbeille — désactive l'édition */
  isReadOnly:       boolean;
  /** Titre courant — pour insertExcalidraw (autosave) */
  title:            string;
  /** Filtre du menu slash courant — utilisé dans handleKeyDown */
  slashFilter:      string;
  // ── Setters stables (useState — même référence entre les renders) ────────────
  /** Met à jour l'état React du contenu HTML (sync TipTap → React) */
  setContent:         (html: string) => void;

  setSlashFilter:     (v: string) => void;
  setSlashMenu:       (v: boolean) => void;
  setSlashIdx:        (fn: number | ((i: number) => number)) => void;
  setSuggestions:     (v: string[]) => void;
  setSuggestionIdx:   (fn: number | ((i: number) => number)) => void;
  setUploadProgress:  (pct: number | null) => void;
  // ── Callbacks stables ────────────────────────────────────────────────────────
  /** Planifie une sauvegarde différée (de useAutosave) */
  scheduleAutoSave:   (t: string, c: NoteContentPayload | string) => void;
  // ── Refs anti-stale-closure (de useContentAutocomplete) ─────────────────────
  detectAtCursorRef:  MutableRefObject<() => void>;
  suggestionsRef:     MutableRefObject<string[]>;
  suggestionIdxRef:   MutableRefObject<number>;
  applySuggestionRef: MutableRefObject<(item: string) => void>;
  slashMenuRef:       MutableRefObject<boolean>;
  slashIdxRef:        MutableRefObject<number>;
  applySlashRef:      MutableRefObject<(idx: number) => void>;
  // ── Refs anti-stale-closure (de useImageFile) ────────────────────────────────
  handleImageInsertRef: MutableRefObject<(file: File) => void>;
  handleFileInsertRef:  MutableRefObject<(file: File) => void>;
  // ── Ref vers l'<input> titre (pour onUpdate) ─────────────────────────────────
  titleRef: MutableRefObject<HTMLInputElement | null>;
}

// ── Hook ──────────────────────────────────────────────────────────────────────

export function useNoteEditor({
  editorRef,
  selectedId,
  isReadOnly,
  title,
  slashFilter,
  setContent,
  setSlashFilter,
  setSlashMenu,
  setSlashIdx,
  setSuggestions,
  setSuggestionIdx,
  setUploadProgress,
  scheduleAutoSave,
  detectAtCursorRef,
  suggestionsRef,
  suggestionIdxRef,
  applySuggestionRef,
  slashMenuRef,
  slashIdxRef,
  applySlashRef,
  handleImageInsertRef,
  handleFileInsertRef,
  titleRef,
}: UseNoteEditorParams) {

  // ── État code modal ─────────────────────────────────────────────────────────
  /** Modal d'édition de bloc de code (nouveau ou édition de l'existant) */
  const [codeModal,       setCodeModal]       = useState<CodeModalState | null>(null);
  /** true pendant ~1.5s après la copie du code dans le modal */
  const [codeModalCopied, setCodeModalCopied] = useState(false);

  // ── État Excalidraw modal ───────────────────────────────────────────────────
  /** Modal de dessin Excalidraw — null = fermé */
  const [excalidrawModal, setExcalidrawModal] = useState<{
    open: boolean;
    initialData?: Record<string, unknown>;
  } | null>(null);
  /** Ref vers l'API impérative Excalidraw — pour getSceneElements() à l'export */
  const excalidrawApiRef = useRef<ExcalidrawImperativeAPI | null>(null);

  // ── État détection bloc de code ─────────────────────────────────────────────
  /** true si le curseur est actuellement dans un bloc de code */
  const [isInCodeBlock, setIsInCodeBlock] = useState(false);
  /** Langage sélectionné du bloc de code courant */
  const [codeBlockLang, setCodeBlockLang] = useState<string>('auto');

  // ── Import dynamique Excalidraw (SSR-incompatible) ──────────────────────────
  /**
   * useMemo évite de recréer le dynamic() à chaque render.
   * { ssr: false } obligatoire — Excalidraw utilise window/document au top-level.
   */
  const ExcalidrawComponent = useMemo(() => dynamic(
    () => import('@excalidraw/excalidraw').then(m => ({ default: m.Excalidraw })),
    {
      ssr:     false,
      loading: () => <p className="text-gray-500 text-sm p-4">Chargement du dessin…</p>,
    }
  ), []);

  // ── Lazy-load langages syntaxe (après mount) ───────────────────────────────
  useEffect(() => { loadHighlightLanguages(); }, []);

  // ── Ref scheduleAutoSave anti-stale ────────────────────────────────────────
  /** Sync scheduleAutoSave dans une ref pour onUpdate (créé une fois par useEditor) */
  const scheduleAutoSaveRef = useRef<(t: string, c: NoteContentPayload | string) => void>(() => {});
  useEffect(() => { scheduleAutoSaveRef.current = scheduleAutoSave; }, [scheduleAutoSave]);

  // ── Debounce detectAtCursor (80ms) ─────────────────────────────────────────
  /** Timer de debounce pour éviter d'appeler detectAtCursor à chaque frappe */
  const detectDebounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleDetect = () => {
    if (detectDebounceRef.current) clearTimeout(detectDebounceRef.current);
    detectDebounceRef.current = setTimeout(() => detectAtCursorRef.current(), 80);
  };

  // ── useEditor — configuration complète TipTap ───────────────────────────────
  const editor = useEditor({
    immediatelyRender:           false,   // SSR — évite les hydration errors (TipTap 3)
    shouldRerenderOnTransaction: false,   // Performance : pas de re-render React sur transaction
                                          // (la toolbar utilise useEditorState séparément)
    autofocus: 'end',                     // Place le curseur en fin de note à l'ouverture
    extensions: [
      StarterKit.configure({
        codeBlock:   false,
        link:        false,
        underline:   false,
        dropcursor:  { color: '#3b82f6', width: 2 }, // Curseur de drop bleu (cohérent avec le thème)
      }),
      CodeBlockLowlight.configure({
        lowlight,
        // defaultLanguage: 'plaintext' → jamais highlightAuto() → jamais de crash regex
        defaultLanguage: 'plaintext',
      }),
      ImageExtension.configure({ inline: true, allowBase64: true }),
      Placeholder.configure({
        placeholder: 'Commence à écrire...\n\nUtilise #tag pour créer des tags automatiquement.',
      }),
      Underline,
      Link.configure({ openOnClick: false, HTMLAttributes: { rel: 'noopener noreferrer' } }),
      Table.configure({ resizable: true }),
      TableRow,
      TableHeader,
      TableCell,
      TextAlign.configure({ types: ['heading', 'paragraph'] }),
      Highlight.configure({ multicolor: true }),
      TextStyle,
      Color,
      TaskList,
      TaskItem.configure({ nested: true }),
      Superscript,
      Subscript,
      CharacterCount,
      FontFamily,
      FontSize,
      LineHeight,
      Indent,
      Mathematics,
    ],
    editorProps: {
      attributes: {
        class:           'tiptap-editor',
        spellcheck:      'true',
        role:            'textbox',
        'aria-multiline':'true',
        'aria-label':    'Éditeur de note',
      },

      /**
       * Normalise le HTML avant parsing ProseMirror.
       * Problèmes gérés :
       *   1. VS Code : wrapper <div style="background-color:..."> → unwrappé
       *   2. Claude.ai / Discord / dark-theme : couleurs sombres → supprimées
       *      pour que le texte hérite du style de l'éditeur (pas de texte invisible)
       */
      transformPastedHTML(html: string): string {
        const doc  = new DOMParser().parseFromString(html, 'text/html');
        const body = doc.body;
        const children = Array.from(body.children);

        // Étape 1 : unwrapper le div VS Code (seul enfant avec background-color)
        if (
          children.length === 1 &&
          children[0].tagName === 'DIV' &&
          (children[0] as HTMLElement).style.backgroundColor
        ) {
          body.innerHTML = (children[0] as HTMLElement).innerHTML;
        }

        // Étape 2 : supprimer background-color, background et color sur tous les éléments
        body.querySelectorAll<HTMLElement>('*').forEach(el => {
          el.style.removeProperty('background-color');
          el.style.removeProperty('background');
          el.style.removeProperty('color');
          if (!el.getAttribute('style')) el.removeAttribute('style');
        });

        return body.innerHTML;
      },

      /**
       * Intercepte le paste :
       * 1. Image pure (screenshot) → upload R2 direct.
       * 2. HTML avec <img src="..."> externe → fetch + upload R2 chaque image,
       *    retire les <img> qui échouent, insère le HTML nettoyé.
       *
       * IMPORTANT : on utilise getData() synchrone pour détecter les images
       * AVANT de décider si on bloque le paste. L'ancienne approche avec
       * getAsString() (async) retournait `true` immédiatement même quand
       * il n'y avait aucune image externe, bloquant tout paste de texte formaté.
       */
      handlePaste(_view, event) {
        const items   = Array.from(event.clipboardData?.items ?? []);
        const hasHtml = items.some(i => i.type === 'text/html');
        const imgItem = items.find(i => i.type.startsWith('image/'));

        // Cas 1 : image pure dans le clipboard (screenshot, print screen)
        if (!hasHtml && imgItem && selectedId) {
          event.preventDefault();
          const file = imgItem.getAsFile();
          if (file) handleImageInsertRef.current(file);
          return true;
        }

        // Cas 2 : HTML collé — vérification synchrone des images externes
        // getData() est synchrone, contrairement à getAsString()
        if (hasHtml && selectedId) {
          const html     = event.clipboardData?.getData('text/html') ?? '';
          const parser   = new DOMParser();
          const doc      = parser.parseFromString(html, 'text/html');
          const imgs     = Array.from(doc.querySelectorAll('img'));
          const external = imgs.filter(img => {
            const src = img.getAttribute('src') ?? '';
            return src.startsWith('http') && !src.startsWith(window.location.origin);
          });

          // Aucune image externe → laisser TipTap gérer normalement (transformPastedHTML s'en occupe)
          if (external.length === 0) return false;

          // Images externes détectées → bloquer le paste et re-uploader vers R2
          event.preventDefault();

          // Re-upload chaque image externe vers R2 via le serveur (évite le CORS navigateur)
          Promise.all(external.map(async (img) => {
            const src = img.getAttribute('src') ?? '';
            try {
              const res = await fetch('/api/upload/from-url', {
                method:  'POST',
                headers: { 'Content-Type': 'application/json' },
                body:    JSON.stringify({ url: src, noteId: selectedId }),
              });
              if (res.status === 429 || res.status === 413) return; // garder l'URL originale
              if (!res.ok) { img.remove(); return; } // source inaccessible → retirer
              const { data } = await res.json();
              img.setAttribute('src', data.publicUrl);
            } catch {
              img.remove(); // erreur réseau → retirer
            }
          })).then(() => {
            const cleanHtml = doc.body.innerHTML;
            editorRef.current?.commands.insertContent(cleanHtml);
          });
          return true;
        }

        return false;
      },

      /**
       * Intercepte le drop de fichiers.
       * .excalidraw → ouvre le modal de dessin.
       * images      → upload Firebase inline.
       * autres      → upload Firebase comme lien 📎.
       */
      handleDrop(_, event) {
        const files = Array.from(event.dataTransfer?.files ?? []);
        if (files.length === 0 || !selectedId) return false;

        // Fichier .excalidraw → ouvrir dans le modal
        const excFile = files.find(f => f.name.endsWith('.excalidraw'));
        if (excFile) {
          event.preventDefault();
          excFile.text().then(json => {
            try { setExcalidrawModal({ open: true, initialData: JSON.parse(json) }); }
            catch { setExcalidrawModal({ open: true }); }
          });
          return true;
        }

        event.preventDefault();
        // Traitement parallèle : images inline, autres fichiers en lien
        Promise.all(files.map(file =>
          file.type.startsWith('image/')
            ? handleImageInsertRef.current(file)
            : handleFileInsertRef.current(file)
        ));
        return true;
      },

      /**
       * Navigation clavier dans les menus contextuels.
       * Priorité 1 : slash commands (si menu ouvert)
       * Priorité 2 : suggestions de tags (si popup ouvert)
       */
      handleKeyDown(_, event) {
        // Navigation dans le menu slash commands
        if (slashMenuRef.current) {
          const cmds = SLASH_CMDS.filter(c =>
            !slashFilter || c.id.startsWith(slashFilter) || c.label.toLowerCase().startsWith(slashFilter)
          );
          if (event.key === 'ArrowDown') {
            setSlashIdx(i => Math.min(i + 1, cmds.length - 1));
            return true;
          }
          if (event.key === 'ArrowUp') {
            setSlashIdx(i => Math.max(i - 1, 0));
            return true;
          }
          if (event.key === 'Enter' || event.key === 'Tab') {
            applySlashRef.current(slashIdxRef.current);
            return true;
          }
          if (event.key === 'Escape') {
            setSlashMenu(false);
            return true;
          }
          // Espace → ferme le menu slash
          if (event.key === ' ') { setSlashMenu(false); return false; }
        }

        // Navigation dans les suggestions de tags
        if (suggestionsRef.current.length === 0) return false;
        if (event.key === 'ArrowDown') {
          setSuggestionIdx(i => Math.min(i + 1, suggestionsRef.current.length - 1));
          return true;
        }
        if (event.key === 'ArrowUp') {
          setSuggestionIdx(i => Math.max(i - 1, -1));
          return true;
        }
        if ((event.key === 'Enter' || event.key === 'Tab') && suggestionIdxRef.current >= 0) {
          applySuggestionRef.current(suggestionsRef.current[suggestionIdxRef.current]);
          return true;
        }
        if (event.key === 'Tab' && suggestionIdxRef.current === -1 && suggestionsRef.current.length > 0) {
          applySuggestionRef.current(suggestionsRef.current[0]);
          return true;
        }
        if (event.key === 'Escape') {
          setSuggestions([]);
          return true;
        }
        return false;
      },
    },

    /** Met à jour le state React du contenu et planifie l'autosave après chaque frappe.
     *  json = source de vérité · html = cache exports · plainText = search Typesense */
    onUpdate: ({ editor }) => {
      const html           = editor.getHTML();
      const json           = editor.getJSON() as Record<string, unknown>;
      const plainText      = editor.getText();
      const wordCount      = editor.storage.characterCount?.words?.()      ?? 0;
      const characterCount = editor.storage.characterCount?.characters?.() ?? 0;
      setContent(html);
      scheduleAutoSaveRef.current(titleRef.current?.value ?? '', { html, json, plainText, wordCount, characterCount });
      scheduleDetect();
    },

    /** Relance la détection de curseur lors des déplacements de sélection */
    onSelectionUpdate: () => scheduleDetect(),

    editable: true,
  });

  // ── Peuplement de editorRef — partagé avec useImageFile/useImportExport/useContentAutocomplete ──
  /**
   * Synchronise le ref partagé dès que l'instance editor change.
   * Permet aux autres hooks d'accéder à l'éditeur sans dépendance circulaire.
   */
  useEffect(() => {
    editorRef.current = editor ?? null;
  }, [editor, editorRef]);

  // ── Sync editor ↔ isReadOnly ────────────────────────────────────────────────
  /** Désactive l'édition TipTap quand la note est dans la corbeille */
  useEffect(() => {
    if (!editor) return;
    editor.setEditable(!isReadOnly);
  }, [editor, isReadOnly]);

  // ── Détection bloc de code actif ────────────────────────────────────────────
  /**
   * Écoute selectionUpdate et transaction TipTap pour savoir si le curseur
   * est dans un bloc de code. Plus fiable que BubbleMenu pour ce cas.
   */
  useEffect(() => {
    if (!editor) return;
    const update = () => {
      const active = editor.isActive('codeBlock');
      setIsInCodeBlock(active);
      if (active) setCodeBlockLang(editor.getAttributes('codeBlock').language ?? 'auto');
    };
    editor.on('selectionUpdate', update);
    editor.on('transaction',     update);
    return () => {
      editor.off('selectionUpdate', update);
      editor.off('transaction',     update);
    };
  }, [editor]);

  // ── Code modal — ouvrir ─────────────────────────────────────────────────────
  /**
   * Ouvre le modal code block.
   * Si le curseur est dans un bloc de code → mode édition (pré-remplit le contenu).
   * Sinon → mode création (bloc vide).
   */
  const openCodeModal = useCallback(() => {
    if (!editor) return;
    if (editor.isActive('codeBlock')) {
      const { state } = editor;
      const { $from } = state.selection;
      let from = -1, to = -1, codeText = '', lang = 'auto';
      // Remonte l'arbre ProseMirror pour trouver le nœud codeBlock
      for (let d = $from.depth; d >= 0; d--) {
        const n = $from.node(d);
        if (n.type.name === 'codeBlock') {
          from     = $from.before(d);
          to       = $from.after(d);
          codeText = n.textContent;
          lang     = n.attrs.language ?? 'auto';
          break;
        }
      }
      setCodeModal({ open: true, code: codeText, lang, isEdit: true, from, to });
    } else {
      setCodeModal({ open: true, code: '', lang: 'auto', isEdit: false, from: -1, to: -1 });
    }
  }, [editor]);

  // ── Code modal — appliquer ──────────────────────────────────────────────────
  /**
   * Applique le contenu du modal dans l'éditeur.
   * Mode édition → remplace le bloc existant.
   * Mode création → insère un nouveau bloc à la position du curseur.
   */
  const applyCodeModal = useCallback(() => {
    if (!editor || !codeModal) return;
    const langAttr = codeModal.lang === 'auto' ? null : codeModal.lang;
    const newNode = {
      type:    'codeBlock',
      attrs:   { language: langAttr },
      content: codeModal.code ? [{ type: 'text', text: codeModal.code }] : [],
    };
    if (codeModal.isEdit && codeModal.from >= 0) {
      editor.chain().focus()
        .deleteRange({ from: codeModal.from, to: codeModal.to })
        .insertContentAt(codeModal.from, newNode)
        .run();
    } else {
      editor.chain().focus().insertContent(newNode).run();
    }
    setCodeModal(null);
  }, [editor, codeModal]);

  // ── Excalidraw — export PNG → Firebase Storage → image inline ──────────────
  /**
   * Exporte la scène Excalidraw en PNG (fond blanc), upload dans Firebase,
   * insère l'image dans l'éditeur et planifie l'autosave.
   */
  const insertExcalidraw = useCallback(async () => {
    if (!excalidrawApiRef.current || !editor || !selectedId) return;
    try {
      setUploadProgress(0);
      const { exportToBlob } = await import('@excalidraw/excalidraw');
      const blob = await exportToBlob({
        elements: excalidrawApiRef.current.getSceneElements(),
        appState: { ...excalidrawApiRef.current.getAppState(), exportWithDarkMode: false },
        files:    excalidrawApiRef.current.getFiles(),
        mimeType: 'image/png',
      });
      const file = new File([blob], `drawing-${Date.now()}.png`, { type: 'image/png' });
      const url  = await uploadNoteImage(file, selectedId, pct => setUploadProgress(pct));
      editor.chain().focus().setImage({ src: url, alt: 'Dessin' }).run();
      const html      = editor.getHTML();
      const json      = editor.getJSON() as Record<string, unknown>;
      const plainText = editor.getText();
      setContent(html);
      scheduleAutoSave(title, { html, json, plainText });
      setExcalidrawModal(null);
    } catch (err) {
      console.error('Export Excalidraw:', err);
    } finally {
      setUploadProgress(null);
    }
  }, [editor, selectedId, title, scheduleAutoSave, setContent, setUploadProgress]);

  // ── Retour ─────────────────────────────────────────────────────────────────
  return {
    editor,
    // ── Code modal ──────────────────────────────────────────────────────────────
    codeModal,       setCodeModal,
    codeModalCopied, setCodeModalCopied,
    openCodeModal,   applyCodeModal,
    // ── Excalidraw ──────────────────────────────────────────────────────────────
    excalidrawModal, setExcalidrawModal,
    excalidrawApiRef,
    ExcalidrawComponent,
    insertExcalidraw,
    // ── État éditeur ────────────────────────────────────────────────────────────
    isInCodeBlock,
    codeBlockLang, setCodeBlockLang,
  };
}
