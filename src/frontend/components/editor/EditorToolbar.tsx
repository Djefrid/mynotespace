/**
 * ============================================================================
 * EDITOR TOOLBAR — components/notes/EditorToolbar.tsx
 * ============================================================================
 *
 * Barre d'outils Ribbon style Word (4 onglets) pour l'éditeur TipTap.
 *
 * ── Onglets ────────────────────────────────────────────────────────────────
 *   Accueil    : police, taille, style de paragraphe, formatage caractère,
 *                casse, surbrillance, couleur du texte
 *   Insertion  : tableau (grid picker), lien, image, fichier joint,
 *                dessin Excalidraw, équation LaTeX, symboles spéciaux
 *   Paragraphe : alignement, retrait, interligne, listes (puces/numéro/tâches),
 *                citation, bloc de code, séparateur horizontal
 *   Outils     : rechercher & remplacer, import/export Word/PDF, Markdown, imprimer
 *
 * ── Constantes exportées ───────────────────────────────────────────────────
 *   FONT_FAMILIES   : polices disponibles (style Word)
 *   FONT_SIZES      : tailles standard
 *   SPECIAL_SYMBOLS : symboles spéciaux par catégorie
 *   LINE_SPACINGS   : options d'interligne
 *
 * ── Accessibilité ──────────────────────────────────────────────────────────
 *   - Chaque bouton TB() a aria-label={title}
 *   - Les icônes sont masquées (aria-hidden) — le bouton porte le label
 *   - Barre de progression upload visible dans l'onglet actif
 *   - Bouton Focus (plein écran) toujours visible à droite
 *
 * ── useEditorState ─────────────────────────────────────────────────────────
 *   Souscription sélective aux changements d'état TipTap pour éviter
 *   les re-renders inutiles de la toolbar lors de chaque frappe.
 * ============================================================================
 */

"use client";

import { useState, useRef, useEffect } from 'react';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import {
  Bold, Italic, Underline as UnderlineIcon, Strikethrough,
  AlignLeft, AlignCenter, AlignRight, AlignJustify,
  List, ListOrdered, ListChecks,
  Quote, Minus, Code2, Link as LinkIcon,
  Table as TableIcon, Highlighter,
  Subscript as SubIcon, Superscript as SupIcon,
  Undo2, Redo2, FileUp, Maximize2, Minimize2, Download, FileText, Pencil,
  FileDown, FilePlus, BookOpen,
  Eraser, IndentIncrease, IndentDecrease, CaseSensitive, Sigma, SearchCode,
  ChevronDown, Replace, Image as ImageIcon,
} from 'lucide-react';

import { normalizeUrl } from '@/src/shared/utils/strings';

// ── Polices disponibles (style Word) ─────────────────────────────────────────
export const FONT_FAMILIES = [
  { value: '',                  label: 'Par défaut' },
  { value: 'Arial, sans-serif',                    label: 'Arial' },
  { value: '"Times New Roman", serif',             label: 'Times New Roman' },
  { value: '"Courier New", monospace',             label: 'Courier New' },
  { value: 'Georgia, serif',                       label: 'Georgia' },
  { value: 'Verdana, sans-serif',                  label: 'Verdana' },
  { value: '"Trebuchet MS", sans-serif',           label: 'Trebuchet MS' },
  { value: 'Impact, sans-serif',                   label: 'Impact' },
  { value: '"Comic Sans MS", cursive',             label: 'Comic Sans MS' },
  { value: '"Palatino Linotype", serif',           label: 'Palatino' },
  { value: '"Lucida Console", monospace',          label: 'Lucida Console' },
];

// ── Tailles de police standard (comme Word) ──────────────────────────────────
export const FONT_SIZES = ['8','9','10','11','12','14','16','18','20','24','28','32','36','48','60','72'];

// ── Symboles spéciaux organisés par catégorie ─────────────────────────────────
export const SPECIAL_SYMBOLS = [
  // Typographie
  '\u00A9','\u00AE','\u2122','\u00B0','\u00B7','\u2022','\u2023','\u25E6',
  '\u2014','\u2013','\u2026','\u00AB','\u00BB','\u201C','\u201D','\u2018','\u2019',
  // Mathématiques
  '\u00B1','\u00D7','\u00F7','\u2260','\u2264','\u2265','\u2248','\u221E',
  '\u221A','\u2211','\u222B','\u2202','\u0394','\u2207','\u220F','\u2208','\u2209','\u2229','\u222A','\u2282','\u2283',
  // Flèches
  '\u2190','\u2192','\u2191','\u2193','\u2194','\u2195','\u21D0','\u21D2','\u21D1','\u21D3','\u21D4',
  // Monnaie
  '\u20AC','\u00A3','\u00A5','\u00A2','\u20B9','\u20BF','\u20A9',
  // Divers
  '\u00BD','\u00BC','\u00BE','\u00B9','\u00B2','\u00B3','\u2020','\u2021',
  '\u00A7','\u00B6','\u2116','\u2605','\u2606','\u2665','\u2666','\u2663','\u2660','\u2713','\u2717','\u2726',
];

// ── Interlignes disponibles ───────────────────────────────────────────────────
export const LINE_SPACINGS = [
  { value: 'normal', label: 'Normal' },
  { value: '1',      label: '1.0' },
  { value: '1.15',   label: '1.15' },
  { value: '1.5',    label: '1.5' },
  { value: '2',      label: '2.0' },
  { value: '2.5',    label: '2.5' },
  { value: '3',      label: '3.0' },
];

// ── Props du composant ────────────────────────────────────────────────────────

interface EditorToolbarProps {
  /** Instance de l'éditeur TipTap (null avant initialisation) */
  editor:             Editor | null;
  /** Ouvre le sélecteur de fichier image */
  onImageClick:       () => void;
  /** Ouvre le sélecteur de fichier joint */
  onFileClick:        () => void;
  /** Progression d'upload en cours (null = aucun) */
  uploadProgress:     number | null;
  /** Mode focus actif (plein écran éditeur) */
  focusMode:          boolean;
  /** Bascule le mode focus */
  onFocusToggle:      () => void;
  /** Exporte la note en Markdown */
  onExportMd:         () => void;
  /** Exporte la note en PDF via impression */
  onExportPdf:        () => void;
  /** Ouvre la modal de bloc de code (choix langage) */
  onCodeBlockClick:   () => void;
  /** Ouvre la modal de dessin Excalidraw */
  onDrawClick:        () => void;
  /** Ouvre le sélecteur d'import DOCX */
  onImportDocxClick:  () => void;
  /** Exporte la note en DOCX */
  onExportDocxClick:  () => void;
  /** Ouvre le sélecteur d'import PDF */
  onImportPdfClick:   () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function EditorToolbar({
  editor, onImageClick, onFileClick, uploadProgress, focusMode, onFocusToggle,
  onExportMd, onExportPdf, onCodeBlockClick, onDrawClick,
  onImportDocxClick, onExportDocxClick, onImportPdfClick,
}: EditorToolbarProps) {
  // ── État des onglets du Ribbon ─────────────────────────────────────────────
  type RibbonTab = 'accueil' | 'insertion' | 'paragraphe' | 'outils';
  const [activeTab,      setActiveTab]      = useState<RibbonTab>('accueil');

  // ── État des dropdowns ─────────────────────────────────────────────────────
  const [linkOpen,       setLinkOpen]       = useState(false);
  const [linkVal,        setLinkVal]        = useState('');
  const [textColorOpen,  setTextColorOpen]  = useState(false);
  const [highlightOpen,  setHighlightOpen]  = useState(false);
  const [lastTextColor,  setLastTextColor]  = useState('#f9fafb');
  const [lastHighlight,  setLastHighlight]  = useState('#fef08a');
  const [tableOpen,      setTableOpen]      = useState(false);
  const [tableHover,     setTableHover]     = useState({ r: 0, c: 0 });
  const [symbolsOpen,    setSymbolsOpen]    = useState(false);
  const [findOpen,       setFindOpen]       = useState(false);
  const [findVal,        setFindVal]        = useState('');
  const [replaceVal,     setReplaceVal]     = useState('');
  const [lineSpacing,    setLineSpacing]    = useState('normal');
  const [caseOpen,       setCaseOpen]       = useState(false);

  // ── Refs pour fermeture au clic extérieur ──────────────────────────────────
  const textColorRef = useRef<HTMLDivElement>(null);
  const highlightRef  = useRef<HTMLDivElement>(null);
  const tableRef      = useRef<HTMLDivElement>(null);
  const symbolsRef    = useRef<HTMLDivElement>(null);
  const caseRef       = useRef<HTMLDivElement>(null);

  // ── useEditorState — souscription sélective aux changements d'état TipTap ──
  // Évite que TOUS les re-renders de l'éditeur parent re-rendent la toolbar.
  // Le sélecteur ne recalcule que les valeurs qui ont réellement changé.
  const editorState = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold:          ctx.editor?.isActive('bold')               ?? false,
      isItalic:        ctx.editor?.isActive('italic')             ?? false,
      isUnderline:     ctx.editor?.isActive('underline')          ?? false,
      isStrike:        ctx.editor?.isActive('strike')             ?? false,
      isSuperscript:   ctx.editor?.isActive('superscript')        ?? false,
      isSubscript:     ctx.editor?.isActive('subscript')          ?? false,
      isLink:          ctx.editor?.isActive('link')               ?? false,
      isAlignLeft:     ctx.editor?.isActive({ textAlign: 'left' })    ?? false,
      isAlignCenter:   ctx.editor?.isActive({ textAlign: 'center' })  ?? false,
      isAlignRight:    ctx.editor?.isActive({ textAlign: 'right' })   ?? false,
      isAlignJustify:  ctx.editor?.isActive({ textAlign: 'justify' }) ?? false,
      headingLevel:    ctx.editor?.isActive('heading', { level: 1 }) ? '1' :
                       ctx.editor?.isActive('heading', { level: 2 }) ? '2' :
                       ctx.editor?.isActive('heading', { level: 3 }) ? '3' : '0',
      fontFamily:      (ctx.editor?.getAttributes('textStyle').fontFamily as string) ?? '',
      currentFontSize: ((ctx.editor?.getAttributes('textStyle').fontSize as string)?.replace('pt', '')) ?? '',
      canUndo:         ctx.editor?.can().undo()          ?? false,
      canRedo:         ctx.editor?.can().redo()          ?? false,
      isBulletList:    ctx.editor?.isActive('bulletList')  ?? false,
      isOrderedList:   ctx.editor?.isActive('orderedList') ?? false,
      isTaskList:      ctx.editor?.isActive('taskList')    ?? false,
      isBlockquote:    ctx.editor?.isActive('blockquote')  ?? false,
      isCodeBlock:     ctx.editor?.isActive('codeBlock')   ?? false,
      charCount:       (ctx.editor?.storage.characterCount?.characters?.() as number | undefined) ?? 0,
      wordCount:       (ctx.editor?.storage.characterCount?.words?.()     as number | undefined) ?? 0,
    }),
  });

  // Guard : editor null (avant initialisation TipTap) OU editorState null
  // (useEditorState retourne null tant que l'editor n'est pas prêt)
  if (!editor || !editorState) return null;

  // ── Bouton toolbar générique ───────────────────────────────────────────────
  const TB = (
    active:   boolean,
    title:    string,
    onClick:  () => void,
    icon:     React.ReactNode,
    disabled?: boolean
  ) => (
    <button
      type="button" title={title} aria-label={title} onClick={onClick} disabled={disabled}
      className={`p-1.5 rounded transition-colors ${
        active ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#111520]'
      } disabled:opacity-30 disabled:cursor-not-allowed`}
    >
      {/* Icône décorative — le bouton a déjà aria-label, l'icône est masquée aux lecteurs d'écran */}
      <span aria-hidden="true">{icon}</span>
    </button>
  );

  // ── Séparateur vertical ────────────────────────────────────────────────────
  const SEP = () => <div className="w-px h-4 bg-gray-200 dark:bg-[#111520] mx-0.5 shrink-0" />;

  // ── Fermeture dropdowns au clic extérieur ──────────────────────────────────
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (textColorRef.current && !textColorRef.current.contains(e.target as Node)) setTextColorOpen(false);
      if (highlightRef.current  && !highlightRef.current.contains(e.target as Node))  setHighlightOpen(false);
      if (tableRef.current      && !tableRef.current.contains(e.target as Node))      { setTableOpen(false); setTableHover({ r: 0, c: 0 }); }
      if (symbolsRef.current    && !symbolsRef.current.contains(e.target as Node))    setSymbolsOpen(false);
      if (caseRef.current       && !caseRef.current.contains(e.target as Node))       setCaseOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // ── Grille de couleurs 6×10 (style Word) ──────────────────────────────────
  const COLOR_GRID = [
    ['#000000','#1a1a1a','#333333','#4d4d4d','#666666','#808080','#999999','#b3b3b3','#cccccc','#ffffff'],
    ['#1e3a5f','#1e40af','#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe','#eff6ff'],
    ['#14532d','#166534','#15803d','#16a34a','#22c55e','#4ade80','#86efac','#bbf7d0','#dcfce7','#f0fdf4'],
    ['#7f1d1d','#991b1b','#b91c1c','#dc2626','#ef4444','#f87171','#fca5a5','#fecaca','#fee2e2','#fff1f2'],
    ['#7c2d12','#c2410c','#ea580c','#f97316','#fb923c','#fdba74','#fcd34d','#fef08a','#fef9c3','#fffbeb'],
    ['#4c1d95','#6d28d9','#7c3aed','#8b5cf6','#a78bfa','#c4b5fd','#be185d','#ec4899','#fbcfe8','#fdf4ff'],
  ];

  // ── Couleurs de surbrillance ───────────────────────────────────────────────
  const HIGHLIGHT_COLORS = [
    '#fef08a','#fde68a','#fcd34d','#fbbf24',
    '#bbf7d0','#86efac','#4ade80','#22c55e',
    '#bfdbfe','#93c5fd','#60a5fa','#3b82f6',
    '#fecaca','#fca5a5','#f87171','#ef4444',
    '#e9d5ff','#c4b5fd','#a78bfa','#8b5cf6',
    '#fbcfe8','#f9a8d4','#f472b6','#ec4899',
    '#fed7aa','#fdba74','#fb923c','#f97316',
  ];

  // ── Appliquer un lien ──────────────────────────────────────────────────────
  const handleSetLink = () => {
    if (!linkVal.trim()) {
      editor.chain().focus().unsetLink().run();
    } else {
      const href = normalizeUrl(linkVal);
      if (href) editor.chain().focus().setLink({ href }).run();
    }
    setLinkOpen(false);
    setLinkVal('');
  };

  // ── Appliquer l'interligne ─────────────────────────────────────────────────
  const applyLineSpacing = (value: string) => {
    setLineSpacing(value);
    if (value === 'normal') {
      editor.chain().focus().unsetLineHeight().run();
    } else {
      editor.chain().focus().setLineHeight(value).run();
    }
  };

  // ── Changer la casse du texte sélectionné ─────────────────────────────────
  const changeCase = (mode: 'upper' | 'lower' | 'title' | 'sentence') => {
    const { from, to } = editor.state.selection;
    if (from === to) return;
    const text = editor.state.doc.textBetween(from, to, ' ');
    let result = text;
    if (mode === 'upper')    result = text.toUpperCase();
    if (mode === 'lower')    result = text.toLowerCase();
    if (mode === 'title')    result = text.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
    if (mode === 'sentence') result = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    editor.chain().focus().deleteRange({ from, to }).insertContent(result).run();
    setCaseOpen(false);
  };

  // ── Rechercher dans le document ────────────────────────────────────────────
  const doFind = () => {
    if (!findVal) return;
    const content = editor.state.doc.textContent;
    const idx = content.indexOf(findVal);
    if (idx >= 0) {
      editor.chain().focus().setTextSelection({ from: idx + 1, to: idx + 1 + findVal.length }).run();
    }
  };

  // ── Remplacer la première occurrence ──────────────────────────────────────
  const doReplace = () => {
    if (!findVal) return;
    const { doc } = editor.state;
    let found = false;
    doc.descendants((node, pos) => {
      if (found || !node.isText) return;
      const idx = node.text!.indexOf(findVal);
      if (idx >= 0) {
        editor.chain().focus()
          .setTextSelection({ from: pos + idx, to: pos + idx + findVal.length })
          .insertContent(replaceVal)
          .run();
        found = true;
      }
    });
  };

  // ── Remplacer toutes les occurrences ──────────────────────────────────────
  const doReplaceAll = () => {
    if (!findVal) return;
    const html = editor.getHTML();
    const escaped = findVal.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const replaced = html.replace(new RegExp(escaped, 'g'), replaceVal);
    editor.commands.setContent(replaced, { emitUpdate: true });
  };

  // ── Style des onglets du Ribbon ────────────────────────────────────────────
  const tabCls = (tab: RibbonTab) =>
    `px-3 py-1.5 text-[11px] font-medium transition-colors border-b-2 -mb-px ${
      activeTab === tab
        ? 'text-yellow-400 border-yellow-500'
        : 'text-gray-500 border-transparent hover:text-gray-700 dark:hover:text-gray-300 hover:border-gray-300 dark:hover:border-dark-600'
    }`;

  return (
    <div className="border-b border-gray-100 dark:border-dark-800 shrink-0 select-none">

      {/* ══ BARRE D'ONGLETS ═══════════════════════════════════════════════════ */}
      <div className="flex items-center border-b border-gray-100 dark:border-dark-900 px-1">
        {/* Onglets Ribbon */}
        <button type="button" className={tabCls('accueil')}    onClick={() => setActiveTab('accueil')}>Accueil</button>
        <button type="button" className={tabCls('insertion')}  onClick={() => setActiveTab('insertion')}>Insertion</button>
        <button type="button" className={tabCls('paragraphe')} onClick={() => setActiveTab('paragraphe')}>Paragraphe</button>
        <button type="button" className={tabCls('outils')}     onClick={() => setActiveTab('outils')}>Outils</button>

        {/* Barre de progression upload — toujours visible à droite des onglets */}
        {uploadProgress !== null && (
          <div className="flex items-center gap-1.5 text-xs text-gray-500 ml-3">
            <div className="w-16 h-1 bg-gray-200 dark:bg-[#111520] rounded-full overflow-hidden">
              <div className="h-full bg-yellow-500 transition-all duration-200" style={{ width: `${uploadProgress}%` }} />
            </div>
            <span>{uploadProgress}%</span>
          </div>
        )}

        {/* Bouton Focus — toujours visible, poussé à droite */}
        <div className="ml-auto pr-1">
          {TB(focusMode, focusMode ? 'Quitter le mode focus' : 'Mode focus (plein écran)', onFocusToggle,
            focusMode ? <Minimize2 size={13} /> : <Maximize2 size={13} />)}
        </div>
      </div>

      {/* ══ CONTENU DE L'ONGLET ACTIF ════════════════════════════════════════ */}
      <div className="flex items-center flex-wrap gap-0.5 px-2 py-1.5 min-h-[36px]">

        {/* ─── Onglet ACCUEIL ──────────────────────────────────────────────── */}
        {activeTab === 'accueil' && <>
          {/* Historique */}
          {TB(false, 'Annuler (Ctrl+Z)', () => editor.chain().focus().undo().run(), <Undo2 size={13} />, !editorState.canUndo)}
          {TB(false, 'Refaire (Ctrl+Y)', () => editor.chain().focus().redo().run(), <Redo2 size={13} />, !editorState.canRedo)}
          <SEP />

          {/* Famille de police */}
          <select
            title="Famille de police"
            value={editorState.fontFamily}
            onChange={e => {
              if (!e.target.value) editor.chain().focus().unsetFontFamily().run();
              else editor.chain().focus().setFontFamily(e.target.value).run();
            }}
            className="text-[11px] bg-gray-100 dark:bg-[#111520] border border-gray-200 dark:border-dark-700 text-gray-600 dark:text-gray-400 rounded px-1.5 py-1 focus:outline-none cursor-pointer max-w-[120px]"
            style={{ fontFamily: editorState.fontFamily || 'inherit' }}
          >
            {FONT_FAMILIES.map(f => (
              <option key={f.value} value={f.value} style={{ fontFamily: f.value || 'inherit' }}>{f.label}</option>
            ))}
          </select>

          {/* Taille de police */}
          <select
            title="Taille de police"
            value={editorState.currentFontSize}
            onChange={e => {
              if (!e.target.value) editor.chain().focus().unsetFontSize().run();
              else editor.chain().focus().setFontSize(`${e.target.value}pt`).run();
            }}
            className="text-[11px] bg-gray-100 dark:bg-[#111520] border border-gray-200 dark:border-dark-700 text-gray-600 dark:text-gray-400 rounded px-1 py-1 focus:outline-none cursor-pointer w-[52px]"
          >
            <option value="">—</option>
            {FONT_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
          </select>

          {/* Style de paragraphe */}
          <select
            title="Style de paragraphe"
            value={
              editorState.headingLevel
            }
            onChange={e => {
              const v = Number(e.target.value);
              if (v === 0) editor.chain().focus().setParagraph().run();
              else editor.chain().focus().toggleHeading({ level: v as 1|2|3 }).run();
            }}
            className="text-[11px] bg-gray-100 dark:bg-[#111520] border border-gray-200 dark:border-dark-700 text-gray-600 dark:text-gray-400 rounded px-1.5 py-1 focus:outline-none cursor-pointer"
          >
            <option value="0">Normal</option>
            <option value="1">Titre 1</option>
            <option value="2">Titre 2</option>
            <option value="3">Titre 3</option>
          </select>
          <SEP />

          {/* Formatage caractère */}
          {TB(editorState.isBold,        'Gras (Ctrl+B)',      () => editor.chain().focus().toggleBold().run(),        <Bold size={13} />)}
          {TB(editorState.isItalic,      'Italique (Ctrl+I)',  () => editor.chain().focus().toggleItalic().run(),      <Italic size={13} />)}
          {TB(editorState.isUnderline,   'Souligné (Ctrl+U)', () => editor.chain().focus().toggleUnderline().run(),   <UnderlineIcon size={13} />)}
          {TB(editorState.isStrike,      'Barré',             () => editor.chain().focus().toggleStrike().run(),      <Strikethrough size={13} />)}
          {TB(editorState.isSuperscript, 'Exposant',          () => editor.chain().focus().toggleSuperscript().run(), <SupIcon size={13} />)}
          {TB(editorState.isSubscript,   'Indice',            () => editor.chain().focus().toggleSubscript().run(),   <SubIcon size={13} />)}
          <SEP />

          {/* Effacer le formatage */}
          {TB(false, 'Effacer le formatage', () => {
            editor.chain().focus().clearNodes().unsetAllMarks().run();
            const { from, to } = editor.state.selection;
            editor.state.doc.nodesBetween(from, to, (node) => {
              if (['paragraph', 'heading', 'blockquote'].includes(node.type.name) && node.attrs.indent) {
                editor.chain().updateAttributes(node.type.name, { indent: 0 }).run();
              }
            });
            editor.chain().focus().unsetLineHeight().run();
          }, <Eraser size={13} />)}

          {/* Changer la casse */}
          <div className="relative shrink-0" ref={caseRef}>
            <button type="button" title="Changer la casse"
              onClick={() => setCaseOpen(o => !o)}
              className={`p-1.5 rounded transition-colors flex items-center gap-0.5 ${caseOpen ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#111520]'}`}>
              <CaseSensitive size={13} />
              <ChevronDown size={9} />
            </button>
            {caseOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl p-1 min-w-[160px]"
                onMouseDown={e => e.stopPropagation()}>
                {[
                  { mode: 'upper'    as const, label: 'MAJUSCULES' },
                  { mode: 'lower'    as const, label: 'minuscules' },
                  { mode: 'title'    as const, label: 'Chaque Mot' },
                  { mode: 'sentence' as const, label: 'Première lettre' },
                ].map(({ mode, label }) => (
                  <button key={mode} type="button" onClick={() => changeCase(mode)}
                    className="w-full text-left text-[11px] text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#111520] px-3 py-1.5 rounded transition-colors">
                    {label}
                  </button>
                ))}
              </div>
            )}
          </div>
          <SEP />

          {/* Surbrillance */}
          <div className="relative shrink-0" ref={highlightRef}>
            <button type="button" title="Surbrillance"
              onClick={() => { setHighlightOpen(o => !o); setTextColorOpen(false); }}
              className="flex flex-col items-center p-1 rounded hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors">
              <Highlighter size={12} className="text-gray-600 dark:text-gray-300" />
              <div className="w-3.5 h-[3px] rounded-full mt-0.5 border border-gray-200 dark:border-dark-600" style={{ background: lastHighlight }} />
            </button>
            {highlightOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl p-2.5 min-w-max"
                onMouseDown={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Surbrillance</p>
                <div className="grid grid-cols-4 gap-1">
                  {HIGHLIGHT_COLORS.map(c => (
                    <button key={c} type="button" title={c}
                      onClick={() => { editor.chain().focus().toggleHighlight({ color: c }).run(); setLastHighlight(c); setHighlightOpen(false); }}
                      style={{ background: c }}
                      className="w-5 h-5 rounded border border-gray-200 dark:border-dark-600 hover:scale-110 transition-transform"
                    />
                  ))}
                </div>
                <button type="button"
                  onClick={() => { editor.chain().focus().unsetHighlight().run(); setHighlightOpen(false); }}
                  className="mt-2 w-full text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 py-1 border-t border-gray-200 dark:border-dark-700 hover:bg-gray-200 dark:hover:bg-[#111520] rounded transition-colors">
                  ✕ Aucune surbrillance
                </button>
              </div>
            )}
          </div>

          {/* Couleur du texte */}
          <div className="relative shrink-0" ref={textColorRef}>
            <button type="button" title="Couleur du texte"
              onClick={() => { setTextColorOpen(o => !o); setHighlightOpen(false); }}
              className="flex flex-col items-center p-1 rounded hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors">
              <span className="text-[13px] font-bold text-gray-600 dark:text-gray-300 leading-none">A</span>
              <div className="w-3.5 h-[3px] rounded-full mt-0.5 border border-gray-200 dark:border-dark-600" style={{ background: lastTextColor }} />
            </button>
            {textColorOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl p-2.5 min-w-max"
                onMouseDown={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Couleur du texte</p>
                <div className="grid grid-cols-10 gap-0.5">
                  {COLOR_GRID.flat().map(c => (
                    <button key={c} type="button" title={c}
                      onClick={() => { editor.chain().focus().setColor(c).run(); setLastTextColor(c); setTextColorOpen(false); }}
                      style={{ background: c }}
                      className="w-5 h-5 rounded-sm border border-gray-200 dark:border-dark-600 hover:scale-110 transition-transform hover:border-gray-400"
                    />
                  ))}
                </div>
                <div className="flex items-center justify-between gap-2 mt-2 pt-1.5 border-t border-gray-200 dark:border-dark-700">
                  <label className="flex items-center gap-1.5 text-[10px] text-gray-500 dark:text-gray-400 cursor-pointer hover:text-gray-700 dark:hover:text-gray-200 transition-colors">
                    <div className="w-5 h-5 rounded-sm border border-gray-400 dark:border-dark-500 bg-gradient-to-br from-red-400 via-yellow-400 to-blue-400 relative overflow-hidden shrink-0">
                      <input type="color" name="text-color-custom" aria-label="Couleur personnalisée du texte"
                        className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                        onChange={e => { editor.chain().focus().setColor(e.target.value).run(); setLastTextColor(e.target.value); }} />
                    </div>
                    Personnalisée
                  </label>
                  <button type="button"
                    onClick={() => { editor.chain().focus().unsetColor().run(); setTextColorOpen(false); }}
                    className="text-[10px] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-1.5 py-0.5 rounded hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors">
                    ✕ Réinitialiser
                  </button>
                </div>
              </div>
            )}
          </div>
        </>}

        {/* ─── Onglet INSERTION ────────────────────────────────────────────── */}
        {activeTab === 'insertion' && <>
          {/* Tableau — grid picker */}
          <div className="relative" ref={tableRef}>
            <button type="button" title="Insérer un tableau"
              onClick={() => setTableOpen(o => !o)}
              className={`p-1.5 rounded transition-colors ${tableOpen ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#111520]'}`}>
              <TableIcon size={13} />
            </button>
            {tableOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-100 dark:bg-[#111520] border border-gray-200 dark:border-dark-700 rounded-lg p-2.5 shadow-2xl select-none"
                onMouseLeave={() => setTableHover({ r: 0, c: 0 })}>
                <div className="flex flex-col gap-0.5 mb-2">
                  {Array.from({ length: 8 }).map((_, ri) => (
                    <div key={ri} className="flex gap-0.5">
                      {Array.from({ length: 8 }).map((_, ci) => (
                        <div key={ci}
                          className={`w-5 h-5 border rounded-sm cursor-pointer transition-colors ${
                            ri < tableHover.r && ci < tableHover.c
                              ? 'bg-yellow-500/30 border-yellow-500/60'
                              : 'bg-gray-200 dark:bg-[#111520] border-gray-300 dark:border-dark-600 hover:bg-gray-300 dark:hover:bg-[#111520]'
                          }`}
                          onMouseEnter={() => setTableHover({ r: ri + 1, c: ci + 1 })}
                          onClick={() => {
                            editor.chain().focus().insertTable({ rows: tableHover.r, cols: tableHover.c, withHeaderRow: true }).run();
                            setTableOpen(false); setTableHover({ r: 0, c: 0 });
                          }}
                        />
                      ))}
                    </div>
                  ))}
                </div>
                <p className="text-center text-xs text-gray-500 dark:text-gray-400 min-h-[1rem]">
                  {tableHover.r > 0 && tableHover.c > 0
                    ? `${tableHover.r} × ${tableHover.c} tableau`
                    : 'Survoler pour choisir'}
                </p>
              </div>
            )}
          </div>

          {/* Lien */}
          <div className="relative">
            {TB(editorState.isLink, 'Lien hypertexte', () => {
              if (editorState.isLink) { editor.chain().focus().unsetLink().run(); setLinkOpen(false); }
              else { setLinkVal(editor.getAttributes('link').href || ''); setLinkOpen(o => !o); }
            }, <LinkIcon size={13} />)}
            {linkOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg p-2 shadow-xl flex gap-1.5 min-w-[210px]"
                onMouseDown={e => e.stopPropagation()}>
                <input name="editor-link-url" autoFocus value={linkVal} onChange={e => setLinkVal(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSetLink(); if (e.key === 'Escape') setLinkOpen(false); }}
                  placeholder="https://..."
                  className="flex-1 text-xs bg-gray-200 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded px-2 py-1 text-gray-600 dark:text-gray-300 focus:outline-none focus:border-yellow-500/50"
                />
                <button type="button" onClick={handleSetLink}
                  className="text-xs bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/30">OK</button>
              </div>
            )}
          </div>
          <SEP />

          {/* Image + Fichier */}
          {TB(false, 'Insérer une image',  onImageClick, <ImageIcon size={13} />)}
          {TB(false, 'Joindre un fichier', onFileClick,  <FileUp size={13} />)}
          <SEP />

          {/* Dessin Excalidraw */}
          {TB(false, 'Dessin (Excalidraw)', onDrawClick, <Pencil size={13} />)}

          {/* Équation LaTeX */}
          {TB(false, 'Équation LaTeX (cliquer puis éditer)', () => {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (editor.chain().focus() as any).insertInlineMath({ latex: 'E=mc^2' }).run();
          }, <Sigma size={13} />)}

          {/* Symboles spéciaux */}
          <div className="relative shrink-0" ref={symbolsRef}>
            <button type="button" title="Symboles spéciaux"
              onClick={() => setSymbolsOpen(o => !o)}
              className={`p-1.5 rounded transition-colors ${symbolsOpen ? 'bg-yellow-500/20 text-yellow-400' : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#111520]'}`}>
              <span className="text-[12px] font-semibold leading-none">Ω</span>
            </button>
            {symbolsOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl p-2.5"
                style={{ width: '272px' }}
                onMouseDown={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Symboles spéciaux</p>
                <div className="grid grid-cols-10 gap-0.5">
                  {SPECIAL_SYMBOLS.map(sym => (
                    <button key={sym} type="button" title={sym}
                      onClick={() => { editor.chain().focus().insertContent(sym).run(); setSymbolsOpen(false); }}
                      className="w-6 h-6 text-sm text-gray-600 dark:text-gray-300 hover:bg-yellow-500/20 hover:text-yellow-300 rounded transition-colors flex items-center justify-center">
                      {sym}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </>}

        {/* ─── Onglet PARAGRAPHE ───────────────────────────────────────────── */}
        {activeTab === 'paragraphe' && <>
          {/* Alignement */}
          {TB(editorState.isAlignLeft,    'Aligner gauche (Ctrl+L)', () => editor.chain().focus().setTextAlign('left').run(),    <AlignLeft size={13} />)}
          {TB(editorState.isAlignCenter,  'Centrer (Ctrl+E)',        () => editor.chain().focus().setTextAlign('center').run(),  <AlignCenter size={13} />)}
          {TB(editorState.isAlignRight,   'Aligner droite (Ctrl+R)', () => editor.chain().focus().setTextAlign('right').run(),   <AlignRight size={13} />)}
          {TB(editorState.isAlignJustify, 'Justifier (Ctrl+J)',      () => editor.chain().focus().setTextAlign('justify').run(), <AlignJustify size={13} />)}
          <SEP />

          {/* Retrait */}
          {TB(false, 'Diminuer le retrait (Shift+Tab)', () => editor.chain().focus().outdent().run(), <IndentDecrease size={13} />)}
          {TB(false, 'Augmenter le retrait (Tab)',      () => editor.chain().focus().indent().run(),  <IndentIncrease size={13} />)}
          <SEP />

          {/* Interligne */}
          <select
            title="Interligne"
            value={lineSpacing}
            onChange={e => applyLineSpacing(e.target.value)}
            className="text-[11px] bg-gray-100 dark:bg-[#111520] border border-gray-200 dark:border-dark-700 text-gray-600 dark:text-gray-400 rounded px-1.5 py-1 focus:outline-none cursor-pointer w-[60px]"
          >
            {LINE_SPACINGS.map(ls => (
              <option key={ls.value} value={ls.value}>{ls.label}</option>
            ))}
          </select>
          <SEP />

          {/* Listes */}
          {TB(editorState.isBulletList,  'Liste à puces',   () => editor.chain().focus().toggleBulletList().run(),  <List size={13} />)}
          {TB(editorState.isOrderedList, 'Liste numérotée', () => editor.chain().focus().toggleOrderedList().run(), <ListOrdered size={13} />)}
          {TB(editorState.isTaskList,    'Liste de tâches', () => editor.chain().focus().toggleTaskList().run(),    <ListChecks size={13} />)}
          <SEP />

          {/* Blocs */}
          {TB(editorState.isBlockquote, 'Citation',     () => editor.chain().focus().toggleBlockquote().run(), <Quote size={13} />)}
          {TB(editorState.isCodeBlock,  'Bloc de code', onCodeBlockClick,  <Code2 size={13} />)}
          {TB(false,                         'Séparateur horizontal', () => editor.chain().focus().setHorizontalRule().run(), <Minus size={13} />)}
        </>}

        {/* ─── Onglet OUTILS ───────────────────────────────────────────────── */}
        {activeTab === 'outils' && <>
          {/* Recherche & Remplacement */}
          <div className="relative shrink-0">
            {TB(findOpen, 'Rechercher & Remplacer (Ctrl+H)', () => setFindOpen(o => !o), <SearchCode size={13} />)}
            {findOpen && (
              <div className="absolute top-full left-0 mt-1 z-50 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl p-3 min-w-[260px]"
                onMouseDown={e => e.stopPropagation()}>
                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wide mb-2">Rechercher & Remplacer</p>
                <div className="flex gap-1.5 mb-1.5">
                  <input name="find-text" value={findVal} onChange={e => setFindVal(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && doFind()}
                    placeholder="Rechercher…"
                    className="flex-1 text-xs bg-gray-200 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded px-2 py-1.5 text-gray-600 dark:text-gray-300 focus:outline-none focus:border-yellow-500/50"
                  />
                  <button type="button" onClick={doFind}
                    className="text-xs bg-gray-200 dark:bg-[#111520] text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 px-2 py-1 rounded hover:bg-gray-300 dark:hover:bg-[#111520] transition-colors">
                    Trouver
                  </button>
                </div>
                <div className="flex gap-1.5">
                  <input name="replace-text" value={replaceVal} onChange={e => setReplaceVal(e.target.value)}
                    placeholder="Remplacer par…"
                    className="flex-1 text-xs bg-gray-200 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded px-2 py-1.5 text-gray-600 dark:text-gray-300 focus:outline-none focus:border-yellow-500/50"
                  />
                  <div className="flex flex-col gap-1">
                    <button type="button" title="Remplacer" onClick={doReplace}
                      className="text-[10px] bg-yellow-500/20 text-yellow-400 px-2 py-1 rounded hover:bg-yellow-500/30 whitespace-nowrap">
                      <Replace size={11} />
                    </button>
                    <button type="button" onClick={doReplaceAll}
                      className="text-[10px] bg-yellow-500/10 text-yellow-500/70 px-2 py-1 rounded hover:bg-yellow-500/20 whitespace-nowrap">
                      Tout
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
          <SEP />

          {/* Import / Export documents */}
          {TB(false, 'Importer un fichier Word (.docx)', onImportDocxClick, <FilePlus size={13} />)}
          {TB(false, 'Exporter en Word (.docx)',         onExportDocxClick, <FileDown size={13} />)}
          {TB(false, 'Importer un PDF (texte)',          onImportPdfClick,  <BookOpen size={13} />)}
          <SEP />
          {TB(false, 'Exporter en Markdown', onExportMd,  <FileText size={13} />)}
          {TB(false, 'Imprimer / PDF',       onExportPdf, <Download size={13} />)}
          <SEP />
          {/* Compteur mots / caractères */}
          <span className="text-[10px] text-gray-400 dark:text-slate-500 whitespace-nowrap px-1 select-none">
            {editorState.wordCount} mot{editorState.wordCount !== 1 ? 's' : ''} · {editorState.charCount} car.
          </span>
        </>}

      </div>
    </div>
  );
}
