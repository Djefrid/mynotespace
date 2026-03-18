/**
 * ============================================================================
 * TESTS — lib/pdf-utils.ts :: extractTextFromPdf()
 * ============================================================================
 *
 * Tests unitaires pour l'extraction de texte PDF.
 * pdfjs-dist est mocké pour tester la logique sans dépendance réseau.
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// ── Mock pdfjs-dist ──────────────────────────────────────────────────────────

/**
 * Simule pdfjs-dist avec une implémentation minimale :
 *   - GlobalWorkerOptions : objet modifiable
 *   - getDocument() : retourne un faux PDF avec 2 pages
 */
vi.mock('pdfjs-dist', () => ({
  GlobalWorkerOptions: { workerSrc: '' },
  version: '5.0.0',
  getDocument: vi.fn().mockReturnValue({
    promise: Promise.resolve({
      numPages: 2,
      getPage: vi.fn().mockImplementation((pageNum: number) =>
        Promise.resolve({
          getTextContent: vi.fn().mockResolvedValue({
            items: pageNum === 1
              ? [{ str: 'Bonjour' }, { str: 'monde' }]
              : [{ str: 'Page deux' }],
          }),
        })
      ),
    }),
  }),
}));

describe('extractTextFromPdf() — extraction texte PDF', () => {
  beforeEach(() => {
    // Réinitialise le flag workerSrcSet entre les tests
    vi.resetModules();
  });

  it('extrait le texte de toutes les pages', async () => {
    const { extractTextFromPdf } = await import('@/lib/pdf-utils');

    // Crée un Blob vide en guise de File
    const fakeFile = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
    fakeFile.arrayBuffer = async () => new ArrayBuffer(0);

    const result = await extractTextFromPdf(fakeFile);

    // Les deux pages doivent être présentes, séparées par \n\n
    expect(result).toContain('Bonjour monde');
    expect(result).toContain('Page deux');
    expect(result).toMatch(/\n\n/);
  });

  it('ignore les pages sans texte', async () => {
    const pdfjs = await import('pdfjs-dist');
    (pdfjs.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve({
        numPages: 2,
        getPage: vi.fn().mockImplementation((pageNum: number) =>
          Promise.resolve({
            getTextContent: vi.fn().mockResolvedValue({
              // Page 1 vide, page 2 avec texte
              items: pageNum === 1 ? [] : [{ str: 'Contenu page 2' }],
            }),
          })
        ),
      }),
    });

    const { extractTextFromPdf } = await import('@/lib/pdf-utils');
    const fakeFile = new File(['%PDF-1.4'], 'test.pdf', { type: 'application/pdf' });
    fakeFile.arrayBuffer = async () => new ArrayBuffer(0);

    const result = await extractTextFromPdf(fakeFile);
    expect(result).toBe('Contenu page 2');
    // Pas de séparateur \n\n si une seule page non-vide
    expect(result).not.toContain('\n\n');
  });

  it('retourne une chaîne vide si toutes les pages sont vides', async () => {
    const pdfjs = await import('pdfjs-dist');
    (pdfjs.getDocument as ReturnType<typeof vi.fn>).mockReturnValue({
      promise: Promise.resolve({
        numPages: 1,
        getPage: vi.fn().mockResolvedValue({
          getTextContent: vi.fn().mockResolvedValue({ items: [] }),
        }),
      }),
    });

    const { extractTextFromPdf } = await import('@/lib/pdf-utils');
    const fakeFile = new File(['%PDF-1.4'], 'empty.pdf', { type: 'application/pdf' });
    fakeFile.arrayBuffer = async () => new ArrayBuffer(0);

    const result = await extractTextFromPdf(fakeFile);
    expect(result).toBe('');
  });
});
