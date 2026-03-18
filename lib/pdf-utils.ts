/**
 * ============================================================================
 * UTILITAIRES PDF — lib/pdf-utils.ts
 * ============================================================================
 *
 * Extraction de texte brut depuis un fichier PDF via pdfjs-dist.
 *
 * Fonctionnalités :
 *   - Lecture page par page avec getTextContent()
 *   - Concaténation des items textuels en une seule chaîne par page
 *   - Séparation des pages par double saut de ligne (\n\n)
 *   - Pages vides ignorées (filtrées)
 *
 * Architecture PDF.js :
 *   - pdfjs-dist fonctionne en deux parties : le module principal + un Web Worker
 *   - Le worker doit être chargé séparément car il exécute du code intensive
 *     en dehors du thread principal (évite le gel de l'UI)
 *   - Ici, le worker est chargé depuis un CDN (cdnjs.cloudflare.com) pour
 *     éviter d'embarquer un gros binaire dans le bundle Next.js
 *   - La version du CDN doit correspondre exactement à pdfjs.version
 *
 * Limitations :
 *   - Extraction texte seulement (pas d'images, pas de formulaires)
 *   - Les PDFs scannés (images) ne donnent pas de texte
 *   - La mise en page (colonnes, tableaux) est aplatie en texte linéaire
 *
 * Client Component seulement ('use client') car utilise FileReader + Worker.
 * ============================================================================
 */

'use client';

/**
 * Extrait le texte brut d'un fichier PDF page par page.
 *
 * @param file - Le fichier .pdf sélectionné par l'utilisateur
 * @returns Texte brut extrait, pages séparées par \n\n
 *
 * Le worker est configuré via CDN pour éviter les problèmes de bundling
 * (le fichier .worker.min.mjs est ~1MB et SSR-incompatible).
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');
  // Web Worker depuis CDN — la version doit correspondre à pdfjs.version
  pdfjs.GlobalWorkerOptions.workerSrc =
    `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  // Itération sur toutes les pages (indexées à partir de 1 dans PDF.js)
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();
    const lines   = content.items
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((item: any) => item.str as string)
      .join(' ')
      .trim();
    if (lines) pages.push(lines);
  }

  return pages.join('\n\n');
}
