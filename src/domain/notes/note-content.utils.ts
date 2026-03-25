/**
 * Utilitaires purs sur le contenu JSON ProseMirror d'une note.
 * Aucune dépendance TipTap — tourne côté serveur sur le JsonB stocké en base.
 */

type PmNode = {
  type?:    string;
  attrs?:   Record<string, unknown>;
  content?: PmNode[];
  marks?:   unknown[];
};

/**
 * Parcourt récursivement un document ProseMirror et retourne les clés R2
 * (chemin sans domaine) de toutes les images dont le `src` commence par `r2PublicUrl`.
 *
 * Exemple :
 *   src  = "https://assets.djefrid.ca/workspaces/w1/notes/n1/abc.jpg"
 *   key  = "workspaces/w1/notes/n1/abc.jpg"
 */
export function extractR2Keys(
  node: PmNode,
  r2PublicUrl: string,
): string[] {
  const base = r2PublicUrl.replace(/\/$/, '');
  const keys: string[] = [];

  function walk(n: PmNode) {
    if (n.type === 'image' && typeof n.attrs?.src === 'string') {
      const src = n.attrs.src as string;
      if (src.startsWith(base + '/')) {
        keys.push(src.slice(base.length + 1));
      }
    }
    for (const child of n.content ?? []) walk(child);
  }

  walk(node);
  return keys;
}

/**
 * Retourne les clés présentes dans `oldKeys` mais absentes de `newKeys`.
 * Ce sont les images retirées du contenu → candidates à la suppression R2.
 */
export function diffR2Keys(oldKeys: string[], newKeys: string[]): string[] {
  const newSet = new Set(newKeys);
  return oldKeys.filter(k => !newSet.has(k));
}
