/**
 * ============================================================================
 * UTILITAIRES NOTES — lib/notes-utils.ts
 * ============================================================================
 *
 * Fonctions pures extraites de NotesEditor.tsx.
 * Séparées pour être testables indépendamment de React / TipTap / Firebase.
 *
 * Fonctions exportées :
 *   - stripHtml          : retire les balises HTML du contenu TipTap
 *   - fmtDate            : formate une date en affichage relatif français
 *   - daysUntilPurge     : jours restants avant purge définitive (corbeille 30j)
 *   - applySmartFilters  : filtre une liste de notes selon un SmartFolderFilter
 *   - buildFolderTree    : construit l'arbre hiérarchique de dossiers
 * ============================================================================
 */

import type { Note, SmartFolderFilter, Folder } from '@/lib/notes-service';

// ── Ré-export du type FolderNode pour l'usage dans NotesEditor ────────────────
export interface FolderNode extends Folder { children: FolderNode[]; }

/**
 * Retire les balises HTML du contenu TipTap.
 * Compatible plain text ET HTML (p, div, br, h1-h6, li, ul, ol).
 * Décode aussi les entités HTML courantes (&amp;, &lt;, &gt;, &nbsp;).
 *
 * @param html - Contenu HTML ou texte brut
 * @returns Texte brut nettoyé et normalisé (espaces multiples → un seul)
 */
export function stripHtml(html: string): string {
  return html
    .replace(/<\/?(p|div|br|h[1-6]|li|ul|ol)[^>]*>/gi, ' ')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Formate une date en affichage relatif court (français).
 * - Aujourd'hui → "Auj."
 * - Hier        → "Hier"
 * - < 7 jours  → "3j"
 * - Sinon       → "14 mars" (locale fr-CA)
 *
 * @param d - Date à formater
 * @returns Chaîne formatée
 */
export function fmtDate(d: Date): string {
  const diffMs   = Date.now() - d.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const diffHrs  = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 2)  return 'À l\'instant';
  if (diffHrs < 1)   return `Il y a ${diffMins} min`;
  if (diffHrs < 24)  return `Il y a ${diffHrs}h`;
  if (diffDays === 1) return 'Hier';
  if (diffDays < 7)   return `Il y a ${diffDays}j`;

  const now = new Date();
  const sameYear = d.getFullYear() === now.getFullYear();
  return d.toLocaleDateString('fr-CA', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
  });
}

/**
 * Calcule le nombre de jours restants avant la purge définitive d'une note
 * mise en corbeille (rétention de 30 jours).
 *
 * @param deletedAt - Date de mise en corbeille
 * @returns Jours restants (minimum 0)
 */
export function daysUntilPurge(deletedAt: Date): number {
  const diff = 30 - Math.floor((Date.now() - deletedAt.getTime()) / 86400000);
  return Math.max(0, diff);
}

/**
 * Filtre une liste de notes selon les critères d'un dossier intelligent.
 * Les filtres sont combinés (AND implicite entre les critères activés).
 *
 * Critères supportés :
 *   - tags + tagLogic : au moins un tag (or) ou tous les tags (and)
 *   - pinned          : notes épinglées uniquement
 *   - createdWithinDays  : créées dans les N derniers jours
 *   - modifiedWithinDays : modifiées dans les N derniers jours
 *
 * @param notes   - Liste de notes à filtrer
 * @param filters - Critères du dossier intelligent
 * @returns Sous-ensemble des notes correspondant aux critères
 */
export function applySmartFilters(notes: Note[], filters: SmartFolderFilter): Note[] {
  let result = [...notes];

  // Filtre par tags (or = au moins un, and = tous les tags)
  if (filters.tags && filters.tags.length > 0) {
    result = filters.tagLogic === 'and'
      ? result.filter(n => filters.tags!.every(t => n.tags.includes(t)))
      : result.filter(n => filters.tags!.some(t => n.tags.includes(t)));
  }

  // Filtre épinglées
  if (filters.pinned !== undefined) {
    result = result.filter(n => n.pinned === filters.pinned);
  }

  // Filtre par date de création (N derniers jours)
  if (filters.createdWithinDays) {
    const cutoff = new Date(Date.now() - filters.createdWithinDays * 86400000);
    result = result.filter(n => n.createdAt >= cutoff);
  }

  // Filtre par date de modification (N derniers jours)
  if (filters.modifiedWithinDays) {
    const cutoff = new Date(Date.now() - filters.modifiedWithinDays * 86400000);
    result = result.filter(n => n.updatedAt >= cutoff);
  }

  return result;
}

/**
 * Construit l'arbre hiérarchique de dossiers depuis une liste plate.
 * - Ignore les dossiers intelligents (isSmart: true)
 * - Trie chaque niveau par `order` (ordre défini par l'utilisateur)
 * - Rattache les dossiers orphelins (parentId non trouvé) à la racine
 *
 * @param folders - Liste plate de tous les dossiers
 * @returns Tableau de nœuds racine avec `children` imbriqués
 */
export function buildFolderTree(folders: Folder[]): FolderNode[] {
  // Seuls les dossiers normaux (pas intelligents) sont dans l'arbre
  const regular = folders.filter(f => !f.isSmart);
  const map = new Map<string, FolderNode>();
  regular.forEach(f => map.set(f.id, { ...f, children: [] }));

  const roots: FolderNode[] = [];
  regular.forEach(f => {
    const node = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  // Tri récursif par `order`
  const sort = (nodes: FolderNode[]) => {
    nodes.sort((a, b) => a.order - b.order);
    nodes.forEach(n => sort(n.children));
  };
  sort(roots);
  return roots;
}
