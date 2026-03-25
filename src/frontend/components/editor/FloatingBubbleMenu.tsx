"use client";

/**
 * ============================================================================
 * FLOATING BUBBLE MENU — FloatingBubbleMenu.tsx
 * ============================================================================
 *
 * Menu contextuel flottant qui apparaît au-dessus de toute sélection de texte.
 * Remplace le BubbleMenu "formatage rapide" basique (Bold/Italic/Link).
 *
 * Boutons :
 *   Gras | Italique | Souligné | Barré | Surligner | — | H1 | H2 | — | Lien | …
 *
 * Le bouton "…" ouvre un menu local avec : Code inline, Exposant, Indice,
 *   Effacer le formatage.
 *
 * Ne s'affiche PAS :
 *   - dans un bloc de code (isActive('codeBlock'))
 *   - dans une cellule de tableau (géré par le TableBubbleMenu séparé)
 *   - quand la sélection est vide
 * ============================================================================
 */

import { useState } from 'react';
import { BubbleMenu } from '@tiptap/react/menus';
import { useEditorState } from '@tiptap/react';
import type { Editor } from '@tiptap/core';
import {
  Bold, Italic, Underline, Strikethrough,
  Highlighter, Link as LinkIcon,
  Heading1, Heading2, Code, MoreHorizontal,
  Superscript, Subscript, RemoveFormatting, Paintbrush,
} from 'lucide-react';

// Palette complète 6×10 (style Word) pour la couleur du texte
const TEXT_COLOR_GRID = [
  ['#000000','#1a1a1a','#333333','#4d4d4d','#666666','#808080','#999999','#b3b3b3','#cccccc','#ffffff'],
  ['#1e3a5f','#1e40af','#1d4ed8','#2563eb','#3b82f6','#60a5fa','#93c5fd','#bfdbfe','#dbeafe','#eff6ff'],
  ['#14532d','#166534','#15803d','#16a34a','#22c55e','#4ade80','#86efac','#bbf7d0','#dcfce7','#f0fdf4'],
  ['#7f1d1d','#991b1b','#b91c1c','#dc2626','#ef4444','#f87171','#fca5a5','#fecaca','#fee2e2','#fff1f2'],
  ['#7c2d12','#c2410c','#ea580c','#f97316','#fb923c','#fdba74','#fcd34d','#fef08a','#fef9c3','#fffbeb'],
  ['#4c1d95','#6d28d9','#7c3aed','#8b5cf6','#a78bfa','#c4b5fd','#be185d','#ec4899','#fbcfe8','#fdf4ff'],
];
import BubbleLinkPopup from './BubbleLinkPopup';
import { normalizeUrl } from '@/src/shared/utils/strings';

// ── Props ─────────────────────────────────────────────────────────────────────

interface FloatingBubbleMenuProps {
  editor:                     Editor;
  bubbleLinkOpen:             boolean;
  setBubbleLinkOpen:          (v: boolean | ((p: boolean) => boolean)) => void;
  bubbleLinkVal:              string;
  setBubbleLinkVal:           (v: string) => void;
  formatPainterMode:          'off' | 'once' | 'persistent';
  onFormatPainterClick:       () => void;
  onFormatPainterDoubleClick: () => void;
}

// ── Helper bouton ─────────────────────────────────────────────────────────────

function Btn({
  title, active, onClick, children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => { e.preventDefault(); onClick(); }}
      className={`p-1.5 rounded transition-colors ${
        active
          ? 'bg-yellow-500/20 text-yellow-400'
          : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520]'
      }`}
    >
      {children}
    </button>
  );
}

function Sep() {
  return <div className="w-px h-4 bg-gray-200 dark:bg-[#111520] mx-0.5 shrink-0" />;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function FloatingBubbleMenu({
  editor,
  bubbleLinkOpen, setBubbleLinkOpen,
  bubbleLinkVal,  setBubbleLinkVal,
  formatPainterMode, onFormatPainterClick, onFormatPainterDoubleClick,
}: FloatingBubbleMenuProps) {
  const [overflowOpen, setOverflowOpen] = useState(false);

  // Souscription réactive aux états d'activation — évite les closures périmées
  const s = useEditorState({
    editor,
    selector: ctx => ({
      bold:      ctx.editor.isActive('bold'),
      italic:    ctx.editor.isActive('italic'),
      underline: ctx.editor.isActive('underline'),
      strike:    ctx.editor.isActive('strike'),
      highlight: ctx.editor.isActive('highlight'),
      link:      ctx.editor.isActive('link'),
      h1:        ctx.editor.isActive('heading', { level: 1 }),
      h2:        ctx.editor.isActive('heading', { level: 2 }),
      code:      ctx.editor.isActive('code'),
    }),
  });

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top' }}
      shouldShow={({ editor: e, state }) => {
        if (state.selection.empty) return false;
        if (e.isActive('codeBlock')) return false;
        if (e.isActive('tableCell') || e.isActive('tableHeader')) return false;
        return true;
      }}
      className="flex items-center gap-0.5 bg-white dark:bg-[#111520] border border-gray-200 dark:border-dark-700 rounded-lg px-1.5 py-1 shadow-2xl z-50"
    >
      {/* ── Pinceau de format ─────────────────────────────────────── */}
      <button
        type="button"
        title={
          formatPainterMode === 'persistent'
            ? 'Pinceau de format actif (persistant) — Échap pour annuler'
            : formatPainterMode === 'once'
            ? 'Pinceau de format actif — Sélectionnez le texte cible'
            : 'Pinceau de format — 1 clic : une fois · 2 clics : persistant'
        }
        aria-label="Pinceau de format"
        onMouseDown={e => { e.preventDefault(); if (e.detail === 2) onFormatPainterDoubleClick(); else onFormatPainterClick(); }}
        className={`p-1.5 rounded transition-colors ${
          formatPainterMode !== 'off'
            ? 'bg-yellow-500/20 text-yellow-400'
            : 'text-gray-600 dark:text-gray-300 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520]'
        }`}
      >
        <Paintbrush size={12} />
      </button>

      <Sep />

      {/* ── Style ─────────────────────────────────────────────────── */}
      <Btn title="Gras (Ctrl+B)"        active={s.bold}      onClick={() => editor.chain().focus().toggleBold().run()}>
        <Bold size={12} />
      </Btn>
      <Btn title="Italique (Ctrl+I)"    active={s.italic}    onClick={() => editor.chain().focus().toggleItalic().run()}>
        <Italic size={12} />
      </Btn>
      <Btn title="Souligné (Ctrl+U)"    active={s.underline} onClick={() => editor.chain().focus().toggleUnderline().run()}>
        <Underline size={12} />
      </Btn>
      <Btn title="Barré"                active={s.strike}    onClick={() => editor.chain().focus().toggleStrike().run()}>
        <Strikethrough size={12} />
      </Btn>
      <Btn title="Surligner"            active={s.highlight} onClick={() => editor.chain().focus().toggleHighlight().run()}>
        <Highlighter size={12} />
      </Btn>

      <Sep />

      {/* ── Titres ────────────────────────────────────────────────── */}
      <Btn title="Titre 1"  active={s.h1} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()}>
        <Heading1 size={12} />
      </Btn>
      <Btn title="Titre 2"  active={s.h2} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()}>
        <Heading2 size={12} />
      </Btn>

      <Sep />

      {/* ── Lien ──────────────────────────────────────────────────── */}
      <div className="relative">
        <Btn
          title="Lien hypertexte"
          active={s.link}
          onClick={() => {
            if (editor.isActive('link')) {
              editor.chain().focus().unsetLink().run();
              setBubbleLinkOpen(false);
            } else {
              setBubbleLinkVal(editor.getAttributes('link').href || '');
              setBubbleLinkOpen(o => !o);
            }
          }}
        >
          <LinkIcon size={12} />
        </Btn>

        <BubbleLinkPopup
          open={bubbleLinkOpen}
          value={bubbleLinkVal}
          onChange={setBubbleLinkVal}
          onConfirm={() => {
            const href = normalizeUrl(bubbleLinkVal);
            if (!href) editor.chain().focus().unsetLink().run();
            else editor.chain().focus().setLink({ href }).run();
            setBubbleLinkOpen(false);
            setBubbleLinkVal('');
          }}
          onClose={() => {
            setBubbleLinkOpen(false);
            setBubbleLinkVal('');
          }}
        />
      </div>

      {/* ── Overflow ─────────────────────────────────────────────── */}
      <div className="relative">
        <Btn title="Plus d'options" active={overflowOpen} onClick={() => setOverflowOpen(o => !o)}>
          <MoreHorizontal size={12} />
        </Btn>

        {overflowOpen && (
          <div
            className="absolute right-0 top-full mt-1 bg-white dark:bg-[#111520] border border-gray-200 dark:border-dark-700 rounded-lg shadow-2xl overflow-hidden z-50 w-56"
            onMouseDown={e => e.stopPropagation()}
          >
            {[
              { label: 'Code inline',         icon: <Code size={12} />,             action: () => editor.chain().focus().toggleCode().run(),          active: s.code },
              { label: 'Exposant',             icon: <Superscript size={12} />,      action: () => editor.chain().focus().toggleSuperscript().run(),   active: false  },
              { label: 'Indice',               icon: <Subscript size={12} />,        action: () => editor.chain().focus().toggleSubscript().run(),      active: false  },
              { label: 'Effacer le formatage', icon: <RemoveFormatting size={12} />, action: () => editor.chain().focus().clearNodes().unsetAllMarks().run(), active: false },
            ].map(item => (
              <button
                key={item.label}
                type="button"
                onMouseDown={e => { e.preventDefault(); item.action(); setOverflowOpen(false); }}
                className={`w-full px-3 py-1.5 text-xs text-left flex items-center gap-2 transition-colors ${
                  item.active
                    ? 'text-yellow-400 bg-yellow-500/10'
                    : 'text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#111520]'
                }`}
              >
                <span className="text-gray-400">{item.icon}</span>
                {item.label}
              </button>
            ))}

            {/* ── Couleur du texte — grille 6×10 style Word ─────────────── */}
            <div className="px-3 py-2 border-t border-gray-200 dark:border-dark-700">
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wide mb-1.5">Couleur du texte</p>
              <div className="flex flex-col gap-0.5">
                {TEXT_COLOR_GRID.map((row, ri) => (
                  <div key={ri} className="flex gap-0.5">
                    {row.map(c => (
                      <button
                        key={c}
                        type="button"
                        title={c}
                        onMouseDown={e => { e.preventDefault(); editor.chain().focus().setColor(c).run(); setOverflowOpen(false); }}
                        style={{ background: c }}
                        className="w-4 h-4 rounded-sm border border-gray-300 dark:border-dark-600 hover:scale-125 transition-transform"
                      />
                    ))}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onMouseDown={e => { e.preventDefault(); editor.chain().focus().unsetColor().run(); setOverflowOpen(false); }}
                className="mt-1.5 text-[10px] text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
              >
                Réinitialiser la couleur
              </button>
            </div>
          </div>
        )}
      </div>
    </BubbleMenu>
  );
}
