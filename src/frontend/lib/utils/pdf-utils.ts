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
 *   - Le worker est configuré une seule fois (flag `workerSrcSet`) pour éviter
 *     de réécrire GlobalWorkerOptions à chaque appel
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

/** Flag global : évite de réassigner GlobalWorkerOptions.workerSrc à chaque appel */
let workerSrcSet = false;

/**
 * Extrait le texte brut d'un fichier PDF page par page.
 *
 * @param file - Le fichier .pdf sélectionné par l'utilisateur
 * @returns Texte brut extrait, pages séparées par \n\n
 *
 * Le worker est configuré via CDN pour éviter les problèmes de bundling
 * (le fichier .worker.min.mjs est ~1MB et SSR-incompatible).
 * La configuration est effectuée une seule fois grâce au flag `workerSrcSet`.
 */
export async function extractTextFromPdf(file: File): Promise<string> {
  const pdfjs = await import('pdfjs-dist');

  // Configure le Web Worker une seule fois — évite de réécrire la propriété
  // GlobalWorkerOptions à chaque appel (inutile et potentiellement instable)
  if (!workerSrcSet) {
    pdfjs.GlobalWorkerOptions.workerSrc =
      `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.mjs`;
    workerSrcSet = true;
  }

  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjs.getDocument({ data: arrayBuffer }).promise;
  const pages: string[] = [];

  // Itération sur toutes les pages (indexées à partir de 1 dans PDF.js)
  for (let i = 1; i <= pdf.numPages; i++) {
    const page    = await pdf.getPage(i);
    const content = await page.getTextContent();

    // TextItem contient `str` (texte) et `transform` (position).
    // TextMarkedContent ne contient pas `str` → filtré via `'str' in item`.
    // On caste ensuite en `{ str: string }` pour accéder à la propriété sans `any`.
    const lines = content.items
      .filter(item => 'str' in item)
      .map(item => (item as { str: string }).str)
      .join(' ')
      .trim();

    if (lines) pages.push(lines);
  }

  return pages.join('\n\n');
}
