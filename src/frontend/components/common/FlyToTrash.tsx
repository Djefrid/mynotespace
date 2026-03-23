/**
 * ============================================================================
 * ANIMATION FLY TO TRASH — components/notes/FlyToTrash.tsx
 * ============================================================================
 *
 * Overlay fantôme qui anime une carte de note volant vers le bouton Corbeille.
 * Utilise framer-motion (AnimatePresence + motion.div).
 *
 * Props :
 *   flyItem — données de l'animation (null = pas d'animation en cours)
 *             x, y   : position départ (de la carte)
 *             tx, ty  : position cible (du bouton Corbeille)
 *             w, h    : dimensions de la carte source
 *             label   : titre de la note (affiché dans le fantôme)
 * ============================================================================
 */

import { AnimatePresence, motion } from 'framer-motion';
import { StickyNote } from 'lucide-react';

// ── Types ─────────────────────────────────────────────────────────────────────

/** Données de l'animation fly-to-trash (null quand aucune animation active) */
export interface FlyItem {
  x: number; y: number; w: number; h: number;
  tx: number; ty: number;
  label: string;
}

// ── Composant ─────────────────────────────────────────────────────────────────

export default function FlyToTrash({ flyItem }: { flyItem: FlyItem | null }) {
  return (
    <AnimatePresence>
      {flyItem && (
        <motion.div
          key="fly-ghost"
          /** Position et opacité initiales : la carte part de sa position dans la liste */
          initial={{ x: flyItem.x, y: flyItem.y, opacity: 0.85, scale: 1 }}
          /** Animation vers le bouton corbeille avec fondu + rétrécissement */
          animate={{
            x: flyItem.tx, y: flyItem.ty,
            opacity: 0, scale: 0.35,
          }}
          transition={{ duration: 0.38, ease: 'easeIn' }}
          style={{
            position:      'fixed',
            width:         flyItem.w,
            height:        Math.min(flyItem.h, 44),
            zIndex:        9999,
            pointerEvents: 'none',
            top: 0, left: 0,
          }}
          className="bg-gray-100 dark:bg-dark-800 border border-yellow-500/40 rounded-lg shadow-2xl flex items-center gap-2 px-3 py-1 overflow-hidden"
        >
          <StickyNote size={11} className="text-yellow-400 shrink-0" />
          <span className="text-xs text-gray-600 dark:text-gray-300 truncate">{flyItem.label}</span>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
