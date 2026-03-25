/**
 * ============================================================================
 * NOTE CARD — components/notes/NoteCard.tsx
 * ============================================================================
 *
 * Carte d'une note individuelle dans la liste centrale.
 * Affiche le titre, l'aperçu du contenu (sans HTML), les tags et la date.
 *
 * Optimisations :
 *   - `memo`       : évite le re-render des cartes non sélectionnées quand
 *                    la liste change (ex: une autre carte est sélectionnée)
 *   - `forwardRef` : requis pour AnimatePresence mode="popLayout" de
 *                    framer-motion, qui passe une ref au composant enfant
 *                    pour calculer l'animation de sortie
 *
 * Props :
 *   note      — données complètes de la note (Note Firestore)
 *   selected  — true si c'est la note actuellement ouverte dans l'éditeur
 *   onSelect  — callback de sélection (affiche la note dans l'éditeur)
 *   trashInfo — si défini : jours restants avant purge (note dans la corbeille)
 * ============================================================================
 */

"use client";

import { memo, forwardRef } from 'react';
import { motion } from 'framer-motion';
import { Pin } from 'lucide-react';
import type { Note } from '@/lib/notes-service';
import { fmtDate } from '@/lib/notes-utils';

// ── Props ─────────────────────────────────────────────────────────────────────

interface NoteCardProps {
  /** Note à afficher */
  note:       Note;
  /** Indique si cette carte est la note sélectionnée dans l'éditeur */
  selected:   boolean;
  /** Callback déclenché au clic — ouvre la note dans l'éditeur */
  onSelect:   (n: Note) => void;
  /**
   * Jours restants avant purge automatique.
   * Défini uniquement pour les notes dans la corbeille (30j de rétention).
   * Affiché en orange à la place de la date de modification.
   */
  trashInfo?: number;
}

// ── Composant ─────────────────────────────────────────────────────────────────

/**
 * Carte de note avec animation framer-motion (layout + exit fly-left).
 * memo + forwardRef combinés : la fermeture `}));` est requise (memo wrap forwardRef).
 */
const NoteCard = memo(forwardRef<HTMLDivElement, NoteCardProps>(
  function NoteCard({ note, selected, onSelect, trashInfo }, ref) {
    return (
      <motion.div
        ref={ref}
        data-note-id={note.id}
        layout
        initial={{ opacity: 1 }}
        exit={{ opacity: 0, x: -24, scale: 0.88, transition: { duration: 0.28, ease: 'easeIn' } }}
      >
        <button
          type="button"
          onClick={() => onSelect(note)}
          className={`w-full text-left px-3 py-3 border-b border-gray-100 dark:border-dark-800 transition-colors duration-[120ms] ${
            selected ? 'bg-yellow-500/10 border-l-2 border-l-yellow-400' : 'hover:bg-gray-100/80 dark:hover:bg-[#111520]/70'
          }`}
        >
          {/* ── Ligne 1 : épingle + titre ──────────────────────────────────── */}
          <div className="flex items-center gap-1.5 mb-0.5">
            {note.pinned && <Pin size={12} className="text-yellow-400 shrink-0" />}
            <span className="text-xs font-semibold text-gray-900 dark:text-white truncate">
              {note.title || 'Sans titre'}
            </span>
          </div>

          {/* ── Ligne 2 : aperçu contenu + date/purge ──────────────────────── */}
          <div className="flex items-start justify-between gap-2">
            {/* Aperçu du contenu : HTML retiré, hashtags masqués, 2 lignes max */}
            <p className="text-xs text-gray-500/80 dark:text-gray-400/70 line-clamp-2 flex-1 leading-relaxed">
              {note.content.replace(/#\w+/g, '').trim() || <em className="not-italic opacity-50">—</em>}
            </p>
            {/* Date relative ou jours avant purge (corbeille) */}
            <span className="text-[10px] text-gray-400/60 dark:text-gray-500/60 shrink-0 mt-0.5 tabular-nums">
              {trashInfo !== undefined
                ? <span className="text-orange-500">{trashInfo}j</span>
                : fmtDate(note.updatedAt)
              }
            </span>
          </div>

          {/* ── Ligne 3 : badges tags (max 3 + compteur si plus) ──────────── */}
          {note.tags.length > 0 && (
            <div className="flex gap-1 mt-1 flex-wrap">
              {note.tags.slice(0, 3).map(t => (
                <span key={t} className="text-[10px] text-gray-500 dark:text-gray-400 bg-gray-200/80 dark:bg-white/[0.06] px-1 rounded">
                  #{t}
                </span>
              ))}
              {note.tags.length > 3 && (
                <span className="text-[10px] text-gray-400 dark:text-gray-600">+{note.tags.length - 3}</span>
              )}
            </div>
          )}
        </button>
      </motion.div>
    );
  }
));

export default NoteCard;
