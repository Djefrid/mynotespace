/**
 * ============================================================================
 * UTILITAIRES DOCX — lib/docx-utils.ts
 * ============================================================================
 *
 * Fonctions d'import et d'export de fichiers Word (.docx) pour l'éditeur Notes.
 *
 * Import DOCX → HTML (mammoth) :
 *   - Utilise `mammoth` pour convertir un .docx en HTML compatible TipTap
 *   - Import dynamique pour éviter d'alourdir le bundle initial
 *   - StyleMap : mappe les styles Word courants (Heading 1/2/3, Code)
 *     vers les balises HTML équivalentes TipTap
 *   - Les warnings mammoth (ex : styles non reconnus) sont logués en console
 *
 * Export HTML → DOCX (@turbodocx/html-to-docx) :
 *   - Convertit le HTML TipTap en fichier .docx téléchargeable
 *   - Import dynamique (~1 MB) pour ne pas impacter le bundle
 *   - Enveloppe le HTML dans un document complet (DOCTYPE + charset)
 *   - Déclenche le téléchargement via URL.createObjectURL + lien <a>
 *   - Nettoie l'URL objet immédiatement après le clic (évite les fuites mémoire)
 *
 * Note : un warning `sharp` peut apparaître dans la console lors de l'export.
 * C'est une dépendance optionnelle de html-to-docx — non bloquant.
 *
 * Client Component seulement ('use client') car utilise DOM + dynamic import.
 * ============================================================================
 */

'use client';

import DOMPurify from 'dompurify';

/**
 * Importe un fichier .docx et retourne du HTML compatible TipTap.
 *
 * @param file - Le fichier .docx sélectionné par l'utilisateur
 * @returns HTML string prêt à être injecté dans l'éditeur TipTap
 *
 * StyleMap appliqué :
 *   - Heading 1 → <h1>
 *   - Heading 2 → <h2>
 *   - Heading 3 → <h3>
 *   - Code → <pre><code> (blocs de code)
 */
export async function importDocx(file: File): Promise<string> {
  const mammoth = (await import('mammoth')).default;
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.convertToHtml({ arrayBuffer }, {
    styleMap: [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Code']      => pre > code:fresh",
    ],
  });
  if (result.messages.length) {
    console.warn('[mammoth] warnings:', result.messages.map(m => m.message));
  }

  // Sanitisation DOMPurify — supprime scripts/events malveillants qu'un DOCX
  // malformé pourrait injecter via mammoth (XSS stored via import de fichier)
  const clean = DOMPurify.sanitize(result.value || '<p></p>', {
    ALLOWED_TAGS: [
      'p','br','strong','em','u','s','h1','h2','h3','h4','h5','h6',
      'ul','ol','li','blockquote','pre','code','a','img','table',
      'thead','tbody','tr','th','td','hr','sup','sub','span','div',
    ],
    ALLOWED_ATTR: ['href','src','alt','title','class','target','rel','style'],
    ALLOW_DATA_ATTR: false,
  });
  return clean || '<p></p>';
}

/**
 * Exporte le HTML TipTap en fichier .docx et déclenche son téléchargement.
 *
 * @param html     - Contenu HTML de la note (depuis editor.getHTML())
 * @param filename - Nom du fichier sans extension (défaut : 'note')
 *
 * Options de formatage :
 *   - Police : Calibri (standard Office)
 *   - Taille : 24 demi-points = 12pt (taille corpo standard)
 *   - Pas de footer
 *   - Lignes de tableau non scindées sur plusieurs pages
 */
export async function exportDocx(html: string, filename = 'note'): Promise<void> {
  // Import dynamique — le bundle est lourd (~1 MB)
  const HTMLtoDOCX = (await import('@turbodocx/html-to-docx')).default;

  const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;

  const blob = await HTMLtoDOCX(fullHtml, null, {
    table:  { row: { cantSplit: true } },
    footer: false,
    font:   'Calibri',
    fontSize: 24, // 12pt en demi-points
  }) as Blob;

  // Téléchargement via URL objet temporaire
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  // Sanitize le nom de fichier pour éviter les caractères invalides
  a.download = `${filename.replace(/[^a-zA-Z0-9_-]/g, '_') || 'note'}.docx`;
  a.click();
  // Libère la mémoire immédiatement après le clic
  URL.revokeObjectURL(url);
}
