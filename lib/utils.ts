/**
 * ============================================================================
 * UTILITAIRES — lib/utils.ts
 * ============================================================================
 *
 * Utilitaire de fusion de classes CSS Tailwind (clsx + tailwind-merge).
 * Utilisé dans tous les composants pour construire des className conditionnels.
 * ============================================================================
 */

import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

/**
 * Fusionne des classes CSS Tailwind en gérant les conflits.
 * clsx : accepte strings, arrays, objets conditionnels.
 * twMerge : résout les conflits Tailwind (ex: p-2 + p-4 → p-4).
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
