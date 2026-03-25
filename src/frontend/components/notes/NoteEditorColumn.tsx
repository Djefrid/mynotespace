/**
 * ============================================================================
 * COLONNE ÉDITEUR — components/notes/NoteEditorColumn.tsx
 * ============================================================================
 *
 * Colonne de droite de l'éditeur de notes (3 colonnes : sidebar · liste · éditeur).
 * Contient l'éditeur TipTap complet et tous ses éléments contextuels.
 *
 * ── Responsabilités ──────────────────────────────────────────────────────────
 *
 * - Toolbar de contrôle de note (statut save, récupérer, déplacer, épingler, supprimer)
 * - Barre d'outils rich text TipTap (EditorToolbar — 4 onglets style Word)
 * - Barre contextuelle bloc de code (langage + copier + modifier)
 * - BubbleMenu tableau (lignes, colonnes, fusion, en-tête, suppression)
 * - BubbleMenu formatage rapide (gras, italique, lien)
 * - Champ titre avec autocomplétion tags
 * - Inputs fichiers cachés (image, fichier joint, DOCX, PDF)
 * - Zone d'édition TipTap (EditorContent)
 * - Menus contextuels : slash commands, autocomplétion tags contenu
 * - Compteur mots / caractères
 * - Tags de la note (cliquables → changement de vue)
 * - Mode focusMode : plein écran de l'éditeur (masque sidebar + liste)
 *
 * ── Extraction ───────────────────────────────────────────────────────────────
 *
 * Extrait de NotesEditor.tsx — bloc {/* ══ EDITOR ══ *\/} (lignes 708–1110).
 * Phase 6 du refactoring — réduction NotesEditor.tsx de ~1136 à ~900 lignes.
 *
 * ── FocusMode ────────────────────────────────────────────────────────────────
 *
 * En focusMode : `position: fixed; inset: 0` → l'éditeur prend tout l'écran.
 * Un seul scroll vertical géré par le scroll-wrapper `.flex-1.min-h-0.overflow-y-auto`.
 * La page est centrée à max-w-[1080px] via le wrapper interne.
 * ============================================================================
 */

"use client";

import React, { useState } from 'react';
import { EditorContent } from '@tiptap/react';
import { BubbleMenu } from '@tiptap/react/menus';
import type { Editor } from '@tiptap/core';
import type { RefObject } from 'react';
import {
  Plus, Pin, Trash2, StickyNote, FolderOpen, ArrowLeft,
  X, RotateCcw, Code2, Hash, History, SearchX, MousePointerClick,
} from 'lucide-react';
import { NoteRevisionsModal } from '@/src/frontend/components/editor/NoteRevisionsModal';
import { daysUntilPurge } from '@/lib/notes-utils';
import { SLASH_CMDS, LANGUAGES } from '@/lib/notes-types';
import type { MobilePanel } from '@/lib/notes-types';
import type { Note, Folder } from '@/lib/notes-service';
import EditorToolbar from '@/components/notes/EditorToolbar';
import FloatingBubbleMenu from '@/src/frontend/components/editor/FloatingBubbleMenu';

// ── Props ─────────────────────────────────────────────────────────────────────

interface NoteEditorColumnProps {
  /** Panneau visible sur mobile */
  mobilePanel: MobilePanel;
  /** Met à jour le panneau visible sur mobile */
  setMobilePanel: (p: MobilePanel) => void;
  /** Vrai si l'éditeur est en mode plein écran */
  focusMode: boolean;
  /** Bascule le mode focusMode */
  setFocusMode: (fn: (f: boolean) => boolean) => void;
  /** Note actuellement sélectionnée (undefined si aucune) */
  selectedNote: Note | undefined;
  /** Vrai si la note est en lecture seule (corbeille) */
  isReadOnly: boolean;
  /** Vrai si la vue courante est la corbeille */
  isTrash: boolean;
  /** Raison de l'état vide : aucune sélection / vue vide / aucun résultat recherche */
  emptyReason?: 'no-selection' | 'empty-view' | 'no-results';
  /** Texte de la recherche active (pour le message "Aucun résultat pour…") */
  searchQuery?: string;
  /** Liste complète des dossiers */
  folders: Folder[];
  /** Libellé du statut de sauvegarde ("Enregistré", "Enregistrement…", etc.) */
  saveLabel: () => string;
  /** Classe CSS Tailwind pour la couleur du statut de sauvegarde */
  saveColor: string;
  /** Récupère la note depuis la corbeille */
  handleRecover: () => void;
  /** Supprime définitivement la note de la corbeille */
  handlePermanentDelete: () => void;
  /** Vrai si l'utilisateur a cliqué une fois sur "Supprimer" (demande confirmation) */
  confirmDel: boolean;
  /** Met à jour l'état de confirmation de suppression */
  setConfirmDel: (v: boolean) => void;
  /** Affiche/masque le menu "Déplacer vers" */
  showMoveMenu: boolean;
  /** Setter du menu de déplacement */
  setShowMoveMenu: (v: boolean | ((prev: boolean) => boolean)) => void;
  /** Dossiers normaux (non intelligents) pour le menu de déplacement */
  regularFolders: Folder[];
  /** Déplace la note vers le dossier (null = Inbox) */
  handleMove: (folderId: string | null) => void;
  /** Crée un nouveau dossier normal */
  handleCreateRegularFolder: () => void;
  /** Épingle/désépingle la note courante */
  handlePin: () => void;
  /** Envoie la note à la corbeille */
  handleDelete: () => void;
  /** Crée une nouvelle note */
  handleNewNote: () => Promise<void>;
  /** Instance de l'éditeur TipTap (null si non initialisé) */
  editor: Editor | null;
  /** Ref de l'input fichier image caché */
  imageInputRef: RefObject<HTMLInputElement | null>;
  /** Ref de l'input fichier joint caché */
  fileInputRef: RefObject<HTMLInputElement | null>;
  /** Ref de l'input fichier DOCX caché */
  docxInputRef: RefObject<HTMLInputElement | null>;
  /** Ref de l'input fichier PDF caché */
  pdfInputRef: RefObject<HTMLInputElement | null>;
  /** Progression de l'upload (0–100) ou null si aucun upload en cours */
  uploadProgress: number | null;
  /** Exporte la note en Markdown */
  onExportMarkdown: () => void;
  /** Exporte la note en PDF */
  onExportPDF: () => void;
  /** Ouvre le modal d'édition de bloc de code */
  onCodeBlockClick: () => void;
  /** Ouvre/ferme le modal Excalidraw */
  setExcalidrawModal: (m: { open: boolean } | null) => void;
  /** Exporte la note en DOCX */
  onExportDocx: () => void;
  /** Titre courant de la note */
  title: string;
  /** Ref de l'input titre (focus automatique à la création) */
  titleRef: RefObject<HTMLInputElement | null>;
  /** Suggestions de tags pour l'autocomplétion du titre */
  titleSuggs: string[];
  /** Met à jour la liste de suggestions du titre */
  setTitleSuggs: (v: string[]) => void;
  /** Index du tag surligné dans la popup d'autocomplétion du titre */
  titleSuggIdx: number;
  /** Applique un tag sélectionné dans le titre */
  applyTitleSugg: (tag: string) => void;
  /** Gère la navigation clavier dans la popup du titre (↑↓ Tab Enter Esc) */
  handleTitleSuggKey: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  /** Met à jour le titre + déclenche l'autosave + l'autocomplétion */
  handleTitleChange: (val: string) => void;
  /** Insère une image dans l'éditeur via Firebase Storage */
  handleImageInsert: (file: File) => void;
  /** Insère un fichier joint dans l'éditeur via Firebase Storage */
  handleFileInsert: (file: File) => void;
  /** Importe un fichier DOCX dans l'éditeur */
  handleImportDocx: (file: File) => void;
  /** Importe un fichier PDF (extraction texte) dans l'éditeur */
  handleImportPdf: (file: File) => void;
  /** Vrai si le curseur est positionné dans un bloc de code */
  isInCodeBlock: boolean;
  /** Langage du bloc de code sous le curseur */
  codeBlockLang: string;
  /** Met à jour le langage du bloc de code */
  setCodeBlockLang: (lang: string) => void;
  /** Vrai pendant 1,5s après copie du contenu d'un bloc de code */
  codeCopied: boolean;
  /** Met à jour l'état de copie du bloc de code */
  setCodeCopied: (v: boolean) => void;
  /** Vrai si le menu slash commands est ouvert */
  slashMenu: boolean;
  /** Filtre de recherche dans le menu slash (texte après "/") */
  slashFilter: string;
  /** Index de la commande slash sélectionnée */
  slashIdx: number;
  /** Applique la commande slash à l'index donné */
  applySlashCommand: (idx: number) => void;
  /** Suggestions de tags pour l'autocomplétion du contenu ("#partial") */
  suggestions: string[];
  /** Index du tag surligné dans la popup de suggestions */
  suggestionIdx: number;
  /** Applique un tag sélectionné dans le contenu */
  applySuggestion: (tag: string) => void;
  /** Vrai pendant le chargement du contenu de la note depuis l'API */
  noteContentLoading?: boolean;
  /** Vrai si la popup d'insertion de lien du BubbleMenu est ouverte */
  bubbleLinkOpen: boolean;
  /** Setter de la popup de lien */
  setBubbleLinkOpen: (v: boolean | ((prev: boolean) => boolean)) => void;
  /** Valeur courante de l'URL dans la popup de lien */
  bubbleLinkVal: string;
  /** Met à jour l'URL dans la popup de lien */
  setBubbleLinkVal: (v: string) => void;
  /** Mode actif du pinceau de format */
  formatPainterMode: 'off' | 'once' | 'persistent';
  /** Clic simple sur le pinceau de format */
  onFormatPainterClick: () => void;
  /** Double-clic sur le pinceau de format */
  onFormatPainterDoubleClick: () => void;
}

// ── Composant ─────────────────────────────────────────────────────────────────

/**
 * NoteEditorColumn — colonne de droite de l'éditeur de notes.
 * Contient l'éditeur TipTap complet avec sa toolbar, ses menus contextuels
 * et tous les éléments interactifs de la note sélectionnée.
 */
export default function NoteEditorColumn({
  mobilePanel,
  setMobilePanel,
  focusMode,
  setFocusMode,
  selectedNote,
  isReadOnly,
  isTrash,
  folders,
  saveLabel,
  saveColor,
  handleRecover,
  handlePermanentDelete,
  confirmDel,
  setConfirmDel,
  showMoveMenu,
  setShowMoveMenu,
  regularFolders,
  handleMove,
  handleCreateRegularFolder,
  handlePin,
  handleDelete,
  handleNewNote,
  editor,
  imageInputRef,
  fileInputRef,
  docxInputRef,
  pdfInputRef,
  uploadProgress,
  onExportMarkdown,
  onExportPDF,
  onCodeBlockClick,
  setExcalidrawModal,
  onExportDocx,
  title,
  titleRef,
  titleSuggs,
  setTitleSuggs,
  titleSuggIdx,
  applyTitleSugg,
  handleTitleSuggKey,
  handleTitleChange,
  handleImageInsert,
  handleFileInsert,
  handleImportDocx,
  handleImportPdf,
  isInCodeBlock,
  codeBlockLang,
  setCodeBlockLang,
  codeCopied,
  setCodeCopied,
  slashMenu,
  slashFilter,
  slashIdx,
  applySlashCommand,
  suggestions,
  suggestionIdx,
  applySuggestion,
  bubbleLinkOpen,
  setBubbleLinkOpen,
  bubbleLinkVal,
  setBubbleLinkVal,
  formatPainterMode,
  onFormatPainterClick,
  onFormatPainterDoubleClick,
  noteContentLoading = false,
  emptyReason = 'no-selection',
  searchQuery = '',
}: NoteEditorColumnProps) {
  const [showRevisions, setShowRevisions] = useState(false);

  return (
    /* ══ EDITOR ═══════════════════════════════════════════════════════════ */
    <div
      className={focusMode
        ? 'fixed inset-0 z-50 bg-white dark:bg-[#080c14] flex flex-col'
        : `${mobilePanel === 'editor' ? 'flex' : 'hidden'} md:flex flex-1 flex-col bg-gray-50 dark:bg-[#080c14] min-w-0`}
      onClick={e => e.stopPropagation()}
    >
      {/* ── État vide : aucune note sélectionnée ──────────────────────────── */}
      {!selectedNote ? (
        <div className="flex-1 flex flex-col items-center justify-center gap-3 px-6 text-center">
          {/* Variante corbeille */}
          {isTrash ? (
            <>
              <Trash2 size={40} className="text-gray-300 dark:text-gray-700" />
              <p className="text-sm text-gray-500">Sélectionnez une note à récupérer</p>
            </>
          ) : emptyReason === 'no-results' ? (
            /* Variante aucun résultat de recherche */
            <>
              <SearchX size={40} className="text-gray-300 dark:text-gray-700" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Aucun résultat{searchQuery ? ` pour « ${searchQuery} »` : ''}
                </p>
                <p className="text-xs text-gray-400 mt-1">Essayez d'autres mots-clés</p>
              </div>
            </>
          ) : emptyReason === 'empty-view' ? (
            /* Variante dossier/vue vide */
            <>
              <FolderOpen size={40} className="text-gray-300 dark:text-gray-700" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Ce dossier est vide</p>
                <p className="text-xs text-gray-400 mt-1">Créez votre première note ici</p>
              </div>
              <button
                type="button"
                onClick={handleNewNote}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg text-sm transition-colors"
              >
                <Plus size={14} /> Nouvelle note
              </button>
              <p className="text-[10px] text-gray-400/60">ou <kbd className="font-mono bg-gray-100 dark:bg-[#111520] px-1 rounded text-[10px]">Ctrl+N</kbd></p>
            </>
          ) : (
            /* Variante par défaut — aucune note sélectionnée */
            <>
              <MousePointerClick size={40} className="text-gray-300 dark:text-gray-700" />
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  Sélectionnez une note pour commencer
                </p>
                <p className="text-xs text-gray-400 mt-1">ou créez-en une nouvelle</p>
              </div>
              <button
                type="button"
                onClick={handleNewNote}
                className="flex items-center gap-2 px-4 py-2 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg text-sm transition-colors"
              >
                <Plus size={14} /> Nouvelle note
              </button>
              <p className="text-[10px] text-gray-400/60">raccourci <kbd className="font-mono bg-gray-100 dark:bg-[#111520] px-1 rounded text-[10px]">Ctrl+N</kbd></p>
            </>
          )}
        </div>
      ) : (
        <>
          {/* ── Toolbar de contrôle de note (save status, actions) ────────── */}
          <div className="flex items-center px-4 py-2 border-b border-gray-200 dark:border-dark-700 gap-2">
            {/* Bouton retour mobile (éditeur → liste) */}
            <button
              type="button"
              title="Retour à la liste"
              onClick={() => setMobilePanel('list')}
              className="md:hidden text-gray-400 hover:text-gray-900 dark:hover:text-white mr-1"
            >
              <ArrowLeft size={15} />
            </button>

            {/* Badge "Lecture seule" (notes en corbeille) */}
            {isReadOnly && (
              <span className="text-[10px] text-orange-400 bg-orange-500/10 px-2 py-0.5 rounded-full">
                Lecture seule
              </span>
            )}

            {/* Statut de sauvegarde (Enregistré, Enregistrement…, Erreur) */}
            <span className={`text-xs ${saveColor} mr-auto`}>
              {!isReadOnly && saveLabel()}
            </span>

            {/* ── Actions corbeille (lecture seule) ───────────────────────── */}
            {isReadOnly && (
              <>
                {/* Bouton récupérer */}
                <button
                  type="button"
                  onClick={handleRecover}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-yellow-500/20 text-yellow-400 hover:bg-yellow-500/30 rounded-lg text-xs transition-colors"
                >
                  <RotateCcw size={12} /> Récupérer
                </button>

                {/* Bouton suppression définitive (double clic requis) */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handlePermanentDelete}
                    title="Supprimer définitivement"
                    className={`p-1.5 rounded transition-colors ${
                      confirmDel
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-gray-500 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-[#111520]'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                  {confirmDel && (
                    <span className="text-[10px] text-red-400">Cliquer encore</span>
                  )}
                </div>

                {/* Jours restants avant purge automatique */}
                {selectedNote.deletedAt && (
                  <span className="text-[10px] text-gray-500 ml-1">
                    {daysUntilPurge(selectedNote.deletedAt)}j restants
                  </span>
                )}
              </>
            )}

            {/* ── Actions note active (non lecture seule) ──────────────────── */}
            {!isReadOnly && (
              <>
                {/* Menu "Déplacer vers" */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={e => { e.stopPropagation(); setShowMoveMenu(prev => !prev); }}
                    title="Déplacer vers"
                    className="p-1.5 rounded text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors"
                  >
                    <FolderOpen size={14} />
                  </button>

                  {showMoveMenu && (
                    <div
                      className="absolute right-0 top-full z-50 mt-1 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl overflow-hidden w-44"
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">
                        Déplacer vers
                      </p>
                      {/* Option : Toutes mes notes (Inbox) */}
                      <button
                        type="button"
                        onClick={() => handleMove(null)}
                        className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${
                          !selectedNote.folderId
                            ? 'text-yellow-400 bg-yellow-500/10'
                            : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#111520]'
                        }`}
                      >
                        Toutes mes notes
                      </button>
                      {/* Options : dossiers existants */}
                      {regularFolders.map(f => (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => handleMove(f.id)}
                          className={`w-full px-3 py-1.5 text-sm text-left transition-colors ${
                            selectedNote.folderId === f.id
                              ? 'text-yellow-400 bg-yellow-500/10'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#111520]'
                          }`}
                        >
                          {f.name}
                        </button>
                      ))}
                      {/* Option : créer un nouveau dossier */}
                      <div className="border-t border-gray-200 dark:border-dark-700 mt-1">
                        <button
                          type="button"
                          onClick={async () => {
                            setShowMoveMenu(false);
                            await handleCreateRegularFolder();
                          }}
                          className="w-full px-3 py-1.5 text-sm text-left text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520] flex items-center gap-2"
                        >
                          <Plus size={12} /> Nouveau dossier
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                {/* Bouton épingler / désépingler */}
                <button
                  type="button"
                  onClick={handlePin}
                  title={selectedNote.pinned ? 'Désépingler' : 'Épingler'}
                  className={`p-1.5 rounded transition-colors ${
                    selectedNote.pinned
                      ? 'text-yellow-400 bg-yellow-500/15'
                      : 'text-gray-500 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520]'
                  }`}
                >
                  <Pin size={14} />
                </button>

                {/* Bouton historique des versions */}
                <button
                  type="button"
                  onClick={() => setShowRevisions(true)}
                  title="Historique des versions"
                  className="p-1.5 rounded transition-colors text-gray-500 hover:text-blue-500 hover:bg-gray-200 dark:hover:bg-[#111520]"
                >
                  <History size={14} />
                </button>

                {/* Bouton suppression (corbeille) — double clic requis */}
                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={handleDelete}
                    title="Mettre à la corbeille"
                    className={`p-1.5 rounded transition-colors ${
                      confirmDel
                        ? 'bg-red-500/20 text-red-400'
                        : 'text-gray-500 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-[#111520]'
                    }`}
                  >
                    <Trash2 size={14} />
                  </button>
                  {confirmDel && (
                    <span className="text-[10px] text-red-400 whitespace-nowrap">Cliquer encore</span>
                  )}
                </div>
              </>
            )}
          </div>

          {/* ── Zone éditeur TipTap + toolbar rich text ────────────────────── */}
          {/* En focusMode : min-h-0 obligatoire — sans ça min-height:auto (flex défaut)
           *  empêche overflow-y-auto de se déclencher dans le scroll-wrapper enfant. */}
          <div className={`relative flex-1 min-h-0 flex flex-col ${focusMode ? '' : 'overflow-hidden'}`}>
            {/* Barre d'outils Ribbon style Word (4 onglets) — masquée en lecture seule */}
            {!isReadOnly && (
              <EditorToolbar
                editor={editor}
                onImageClick={() => imageInputRef.current?.click()}
                onFileClick={() => fileInputRef.current?.click()}
                uploadProgress={uploadProgress}
                focusMode={focusMode}
                onFocusToggle={() => setFocusMode(f => !f)}
                onExportMd={onExportMarkdown}
                onExportPdf={onExportPDF}
                onCodeBlockClick={onCodeBlockClick}
                onDrawClick={() => setExcalidrawModal({ open: true })}
                onImportDocxClick={() => docxInputRef.current?.click()}
                onExportDocxClick={onExportDocx}
                onImportPdfClick={() => pdfInputRef.current?.click()}
                formatPainterMode={formatPainterMode}
                onFormatPainterClick={onFormatPainterClick}
                onFormatPainterDoubleClick={onFormatPainterDoubleClick}
              />
            )}

            {/* ══ SCROLL UNIQUE + PAGE CENTRÉE (focusMode) ════════════════════
             *  focusMode  : un seul scroll vertical (flex-1 min-h-0 overflow-y-auto).
             *               Page centrée à 1080px max, clic dans les marges → focus éditeur.
             *  hors focus : divs transparentes (flex-1 flex flex-col min-h-0). */}
            <div
              className={focusMode ? 'flex-1 min-h-0 overflow-y-auto' : 'flex-1 flex flex-col min-h-0'}
              onClick={focusMode ? () => editor?.commands.focus('end') : undefined}
            >
              <div className={focusMode ? 'w-[70%] mx-auto py-8' : 'flex-1 flex flex-col min-h-0 w-full'}>
                {/* ── Champ titre + autocomplétion tags ───────────────────── */}
                <div className="relative">
                  <input
                    ref={titleRef as React.RefObject<HTMLInputElement>}
                    id="note-title"
                    name="note-title"
                    type="text"
                    value={title}
                    onChange={e => handleTitleChange(e.target.value)}
                    onKeyDown={handleTitleSuggKey}
                    onBlur={() => setTimeout(() => setTitleSuggs([]), 150)}
                    placeholder="Titre"
                    readOnly={isReadOnly}
                    aria-label="Titre de la note"
                    maxLength={200}
                    className={`w-full px-6 pt-8 pb-2 bg-transparent text-[28px] font-semibold leading-tight text-[rgb(37,35,30)] dark:text-white placeholder-gray-300 dark:placeholder-gray-600 focus:outline-none ${
                      isReadOnly ? 'cursor-default' : ''
                    }`}
                  />

                  {/* Popup autocomplétion tags dans le titre */}
                  {titleSuggs.length > 0 && (
                    <div
                      className="absolute left-6 top-full z-50 mt-1 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl overflow-hidden min-w-[220px]"
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tags</p>
                      {titleSuggs.map((t, i) => (
                        <button
                          key={t}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); applyTitleSugg(t); }}
                          className={`w-full px-3 py-1.5 text-sm text-left transition-colors truncate flex items-center gap-2 ${
                            i === titleSuggIdx
                              ? 'bg-yellow-500/20 text-yellow-300'
                              : 'text-yellow-400 hover:bg-gray-200 dark:hover:bg-[#111520]'
                          }`}
                        >
                          <Hash size={12} />#{t}
                        </button>
                      ))}
                      <p className="px-3 py-1 text-[10px] text-gray-600">↑↓ · Tab/Enter · Esc</p>
                    </div>
                  )}
                </div>

                {/* Nom du dossier parent (si la note est dans un dossier) */}
                {selectedNote.folderId && (
                  <div className="px-6 pb-1">
                    <span className="flex items-center gap-1 text-xs text-gray-500">
                      <FolderOpen size={12} />
                      {folders.find(f => f.id === selectedNote.folderId)?.name ?? 'Dossier'}
                    </span>
                  </div>
                )}

                {/* ── Inputs fichiers cachés (déclenchés par les boutons toolbar) ── */}
                <input
                  ref={imageInputRef as React.RefObject<HTMLInputElement>}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  aria-label="Insérer une image"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleImageInsert(f);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={fileInputRef as React.RefObject<HTMLInputElement>}
                  type="file"
                  className="hidden"
                  aria-label="Joindre un fichier"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleFileInsert(f);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={docxInputRef as React.RefObject<HTMLInputElement>}
                  type="file"
                  accept=".docx"
                  className="hidden"
                  aria-label="Importer un fichier Word"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleImportDocx(f);
                    e.target.value = '';
                  }}
                />
                <input
                  ref={pdfInputRef as React.RefObject<HTMLInputElement>}
                  type="file"
                  accept=".pdf"
                  className="hidden"
                  aria-label="Ouvrir un fichier PDF"
                  onChange={e => {
                    const f = e.target.files?.[0];
                    if (f) handleImportPdf(f);
                    e.target.value = '';
                  }}
                />

                {/* ── Barre contextuelle bloc de code ─────────────────────── */}
                {/* S'affiche quand le curseur est dans un bloc de code et que la note est éditable */}
                {isInCodeBlock && !isReadOnly && editor && (
                  <div className="px-3 py-2.5 border-b border-gray-100 dark:border-dark-800 flex items-center gap-2 bg-gray-50 dark:bg-[#080c14] shrink-0">
                    <Code2 size={12} className="text-yellow-400 shrink-0" />

                    {/* Sélecteur de langage */}
                    <select
                      title="Langage du bloc de code"
                      value={codeBlockLang}
                      onChange={e => {
                        const lang = e.target.value;
                        setCodeBlockLang(lang);
                        editor.chain().focus().updateAttributes('codeBlock', {
                          language: lang === 'auto' ? null : lang,
                        }).run();
                      }}
                      className="text-xs bg-gray-100 dark:bg-[#111520] text-gray-600 dark:text-gray-300 border border-gray-200 dark:border-dark-700 rounded px-1.5 py-0.5 focus:outline-none focus:border-yellow-500/50 cursor-pointer"
                    >
                      {LANGUAGES.map(l => (
                        <option key={l.value} value={l.value}>{l.label}</option>
                      ))}
                    </select>

                    <div className="w-px h-3 bg-gray-200 dark:bg-[#111520]" />

                    {/* Bouton copier le contenu du bloc de code */}
                    <button
                      type="button"
                      onClick={() => {
                        const { $from } = editor.state.selection;
                        let node = $from.parent;
                        if (node.type.name !== 'codeBlock') {
                          for (let d = $from.depth; d >= 0; d--) {
                            const n = $from.node(d);
                            if (n.type.name === 'codeBlock') { node = n; break; }
                          }
                        }
                        navigator.clipboard.writeText(node.textContent).then(() => {
                          setCodeCopied(true);
                          setTimeout(() => setCodeCopied(false), 1500);
                        });
                      }}
                      className="text-xs text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
                    >
                      {codeCopied
                        ? <span className="text-green-400">✓ Copié</span>
                        : 'Copier'}
                    </button>

                    {/* Bouton ouvrir le modal plein écran du bloc de code */}
                    <button
                      type="button"
                      onClick={onCodeBlockClick}
                      className="ml-auto text-xs text-gray-500 hover:text-yellow-400 transition-colors"
                    >
                      Modifier…
                    </button>
                  </div>
                )}

                {/* ── BubbleMenu tableau ───────────────────────────────────── */}
                {/* Outils contextuels tableau (apparaît quand curseur dans une cellule) */}
                {editor && !isReadOnly && (
                  <BubbleMenu
                    editor={editor}
                    options={{ placement: 'top' }}
                    shouldShow={({ editor: e }) => e.isActive('tableCell') || e.isActive('tableHeader')}
                    className="flex items-center gap-0.5 flex-wrap bg-gray-100 dark:bg-[#111520] border border-gray-200 dark:border-dark-700 rounded-lg px-1.5 py-1 shadow-2xl z-50 max-w-sm"
                  >
                    {/* Gestion des lignes */}
                    <button type="button" title="Ajouter une ligne au-dessus"
                      onClick={() => editor.chain().focus().addRowBefore().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors whitespace-nowrap">
                      ↑ Ligne
                    </button>
                    <button type="button" title="Ajouter une ligne en-dessous"
                      onClick={() => editor.chain().focus().addRowAfter().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors whitespace-nowrap">
                      ↓ Ligne
                    </button>
                    <button type="button" title="Supprimer la ligne"
                      onClick={() => editor.chain().focus().deleteRow().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-red-400/70 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors whitespace-nowrap">
                      ✕ Ligne
                    </button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-[#111520] mx-0.5 shrink-0" />

                    {/* Gestion des colonnes */}
                    <button type="button" title="Ajouter une colonne à gauche"
                      onClick={() => editor.chain().focus().addColumnBefore().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors whitespace-nowrap">
                      ← Col.
                    </button>
                    <button type="button" title="Ajouter une colonne à droite"
                      onClick={() => editor.chain().focus().addColumnAfter().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors whitespace-nowrap">
                      → Col.
                    </button>
                    <button type="button" title="Supprimer la colonne"
                      onClick={() => editor.chain().focus().deleteColumn().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-red-400/70 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors whitespace-nowrap">
                      ✕ Col.
                    </button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-[#111520] mx-0.5 shrink-0" />

                    {/* Fusion / Scission de cellules */}
                    <button type="button" title="Fusionner les cellules sélectionnées"
                      onClick={() => editor.chain().focus().mergeCells().run()}
                      disabled={!editor.can().mergeCells()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
                      Fusionner
                    </button>
                    <button type="button" title="Scinder la cellule"
                      onClick={() => editor.chain().focus().splitCell().run()}
                      disabled={!editor.can().splitCell()}
                      className="text-xs px-1.5 py-0.5 rounded text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors disabled:opacity-30 disabled:cursor-not-allowed whitespace-nowrap">
                      Scinder
                    </button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-[#111520] mx-0.5 shrink-0" />

                    {/* Bascule en-tête de ligne */}
                    <button type="button" title="Basculer la ligne en en-tête"
                      onClick={() => editor.chain().focus().toggleHeaderRow().run()}
                      className={`text-xs px-1.5 py-0.5 rounded transition-colors whitespace-nowrap ${
                        editor.isActive('tableHeader')
                          ? 'bg-yellow-500/20 text-yellow-400'
                          : 'text-gray-500 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-200 dark:hover:bg-[#111520]'
                      }`}>
                      En-tête
                    </button>
                    <div className="w-px h-4 bg-gray-200 dark:bg-[#111520] mx-0.5 shrink-0" />

                    {/* Suppression du tableau entier */}
                    <button type="button" title="Supprimer le tableau"
                      onClick={() => editor.chain().focus().deleteTable().run()}
                      className="text-xs px-1.5 py-0.5 rounded text-red-400/70 hover:text-red-400 hover:bg-gray-200 dark:hover:bg-[#111520] transition-colors whitespace-nowrap">
                      ✕ Tableau
                    </button>
                  </BubbleMenu>
                )}

                {/* ── BubbleMenu formatage riche ───────────────────────────── */}
                {editor && !isReadOnly && (
                  <FloatingBubbleMenu
                    editor={editor}
                    bubbleLinkOpen={bubbleLinkOpen}
                    setBubbleLinkOpen={setBubbleLinkOpen}
                    bubbleLinkVal={bubbleLinkVal}
                    setBubbleLinkVal={setBubbleLinkVal}
                    formatPainterMode={formatPainterMode}
                    onFormatPainterClick={onFormatPainterClick}
                    onFormatPainterDoubleClick={onFormatPainterDoubleClick}
                  />
                )}

                {/* ── Zone d'édition TipTap ────────────────────────────────── */}
                {/* En focusMode : le scroll est géré par le scroll-wrapper parent → pas d'overflow-y ici */}
                <div className={`${focusMode ? 'relative px-6 py-2' : 'relative flex-1 px-6 py-2 overflow-y-auto min-h-0 [&::-webkit-scrollbar]:hidden md:[&::-webkit-scrollbar]:w-2 md:[&::-webkit-scrollbar-track]:bg-transparent md:[&::-webkit-scrollbar-thumb]:rounded-full md:[&::-webkit-scrollbar-thumb]:bg-gray-300 dark:[&::-webkit-scrollbar-thumb]:bg-dark-600 md:[&::-webkit-scrollbar-thumb:hover]:bg-gray-400'} ${formatPainterMode !== 'off' ? '[&_.ProseMirror]:!cursor-crosshair' : ''}`}>
                  {noteContentLoading && (
                    <div className="absolute inset-0 z-10 flex items-center justify-center bg-white dark:bg-[#0d1117]">
                      <div className="w-6 h-6 border-2 border-blue-400 border-t-transparent rounded-full animate-spin" />
                    </div>
                  )}
                  <EditorContent
                    editor={editor}
                    className={`${focusMode ? 'pb-64' : 'h-full pb-64'} ${noteContentLoading ? 'invisible' : ''}`}
                  />
                </div>

                {/* ── Menu slash commands ──────────────────────────────────── */}
                {/* Déclenché par "/" en début de paragraphe */}
                {slashMenu && (() => {
                  const cmds = SLASH_CMDS.filter(c =>
                    !slashFilter || c.id.startsWith(slashFilter) || c.label.toLowerCase().startsWith(slashFilter)
                  );
                  if (cmds.length === 0) return null;
                  return (
                    <div
                      className="absolute left-6 top-16 z-50 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-xl shadow-2xl overflow-hidden w-64"
                      onClick={e => e.stopPropagation()}
                    >
                      <p className="px-3 pt-2 pb-1 text-[10px] font-semibold text-gray-500 uppercase tracking-widest">
                        Commandes — tapez pour filtrer
                      </p>
                      {cmds.map((c, i) => (
                        <button
                          key={c.id}
                          type="button"
                          onMouseDown={e => { e.preventDefault(); applySlashCommand(i); }}
                          className={`w-full px-3 py-2 text-sm text-left flex items-center gap-3 transition-colors ${
                            i === slashIdx
                              ? 'bg-yellow-500/15 text-yellow-300'
                              : 'text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-[#111520]'
                          }`}
                        >
                          <span className="font-medium text-sm w-24 shrink-0">{c.label}</span>
                          <span className="text-xs text-gray-500 truncate">{c.desc}</span>
                        </button>
                      ))}
                      <p className="px-3 py-1.5 text-[10px] text-gray-600 border-t border-gray-200 dark:border-dark-700">
                        ↑↓ · Enter · Esc
                      </p>
                    </div>
                  );
                })()}

                {/* ── Popup autocomplétion tags dans le contenu ────────────── */}
                {/* Déclenchée par "#" ou "#partial" dans le texte */}
                {suggestions.length > 0 && (
                  <div
                    className="absolute left-6 bottom-4 z-50 bg-gray-100 dark:bg-[#111520] border border-gray-300 dark:border-dark-600 rounded-lg shadow-2xl overflow-hidden min-w-[160px]"
                    onClick={e => e.stopPropagation()}
                  >
                    <p className="px-3 pt-1.5 pb-0.5 text-[10px] font-semibold text-gray-500 uppercase tracking-wide">Tags</p>
                    {suggestions.map((item, i) => (
                      <button
                        key={item}
                        type="button"
                        onClick={() => applySuggestion(item)}
                        className={`w-full px-3 py-1.5 text-sm text-left flex items-center gap-2 transition-colors ${
                          i === suggestionIdx
                            ? 'bg-yellow-500/20 text-yellow-300'
                            : 'text-yellow-400 hover:bg-gray-200 dark:hover:bg-[#111520]'
                        }`}
                      >
                        <Hash size={12} />#{item}
                      </button>
                    ))}
                    <p className="px-3 py-1 text-[10px] text-gray-600">↑↓ · Tab/Enter · Esc</p>
                  </div>
                )}

                {/* ── Compteur mots / caractères ───────────────────────────── */}
                {editor && (
                  <div className="px-6 py-1 border-t border-gray-100 dark:border-dark-900 flex justify-end shrink-0">
                    <span className="text-[10px] text-gray-600">
                      {editor.storage.characterCount?.words?.() ?? 0} mots
                      · {editor.storage.characterCount?.characters?.() ?? 0} car.
                    </span>
                  </div>
                )}

                {/* ── Tags de la note ──────────────────────────────────────── */}
                {/* Cliquables → changement de vue vers le tag correspondant */}
                {selectedNote.tags.length > 0 && (
                  <div className="px-6 py-2.5 border-t border-gray-100 dark:border-dark-800 flex items-center gap-1.5 flex-wrap">
                    <Hash size={12} className="text-gray-600" />
                    {selectedNote.tags.map(t => (
                      <span
                        key={t}
                        className={`text-xs text-yellow-500 bg-yellow-500/10 px-2 py-0.5 rounded-full transition-colors ${
                          !isTrash ? 'cursor-pointer hover:bg-yellow-500/20' : ''
                        }`}
                      >
                        #{t}
                      </span>
                    ))}
                  </div>
                )}

              </div>{/* fin page-centered (max-w-[1080px]) */}
            </div>{/* fin scroll-wrapper */}
          </div>

          {/* ── Modal historique des versions ──────────────────────────────── */}
          {showRevisions && selectedNote && (
            <NoteRevisionsModal
              noteId={selectedNote.id}
              onClose={() => setShowRevisions(false)}
              onRestore={(json) => {
                editor?.commands.setContent(json, { emitUpdate: true });
                setShowRevisions(false);
              }}
            />
          )}
        </>
      )}
    </div>
  );
}
