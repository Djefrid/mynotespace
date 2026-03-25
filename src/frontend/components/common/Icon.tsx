"use client";

import type { LucideIcon, LucideProps } from 'lucide-react';

interface IconProps extends Omit<LucideProps, 'ref'> {
  /** Composant Lucide à rendre */
  icon: LucideIcon;
  /** Taille en px — défaut 14 (nav principale) ou 12 (secondaire) */
  size?: number;
  /** Épaisseur du trait — défaut 1.5 (style Notion/Linear) */
  strokeWidth?: number;
}

/**
 * Wrapper Lucide qui applique les défauts visuels de l'app :
 *   - strokeWidth 1.5 (fin, style Notion)
 *   - size 14 par défaut (nav principale)
 *
 * Usage : <Icon icon={Folder} /> ou <Icon icon={Hash} size={12} />
 */
export default function Icon({ icon: LucideComponent, size = 14, strokeWidth = 1.5, ...props }: IconProps) {
  return <LucideComponent size={size} strokeWidth={strokeWidth} {...props} />;
}
