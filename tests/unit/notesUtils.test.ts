/**
 * ============================================================================
 * TESTS — __tests__/notesUtils.test.ts
 * ============================================================================
 *
 * Tests unitaires pour les fonctions pures de lib/notes-utils.ts.
 * Ces fonctions sont extraites de NotesEditor.tsx pour être testables
 * indépendamment de React / TipTap / Firebase.
 *
 * Fonctions testées :
 *   - stripHtml          : nettoyage HTML → texte brut
 *   - fmtDate            : formatage date relatif français
 *   - daysUntilPurge     : jours restants avant purge corbeille (30j)
 *   - applySmartFilters  : filtrage notes selon critères dossier intelligent
 *   - buildFolderTree    : construction arbre hiérarchique de dossiers
 * ============================================================================
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  stripHtml,
  fmtDate,
  daysUntilPurge,
  applySmartFilters,
  buildFolderTree,
} from '@/lib/notes-utils';
import type { Note, SmartFolderFilter, Folder } from '@/lib/notes-service';

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Crée une note de test avec des valeurs par défaut.
 * Seuls les champs nécessaires au test doivent être fournis.
 */
function makeNote(overrides: Partial<Note>): Note {
  const now = new Date();
  return {
    id:        'note-1',
    title:     'Test note',
    content:   '<p>Contenu</p>',
    tags:      [],
    pinned:    false,
    folderId:  null,
    deletedAt: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

/**
 * Crée un dossier de test.
 */
function makeFolder(overrides: Partial<Folder>): Folder {
  const now = new Date();
  return {
    id:        'folder-1',
    name:      'Mon dossier',
    order:     0,
    parentId:  null,
    isSmart:   false,
    filters:   {},
    createdAt: now,
    updatedAt: now,
    ...overrides,
  };
}

// ── Tests stripHtml ─────────────────────────────────────────────────────────

describe('stripHtml', () => {
  it('supprime les balises <p>', () => {
    expect(stripHtml('<p>Bonjour</p>')).toBe('Bonjour');
  });

  it('supprime les balises <h1> à <h6>', () => {
    expect(stripHtml('<h1>Titre</h1>')).toBe('Titre');
    expect(stripHtml('<h3>Sous-titre</h3>')).toBe('Sous-titre');
  });

  it('supprime les listes <ul> <ol> <li>', () => {
    // <ul>, <li> → remplacés par espace, puis \s+ collapse → un seul espace
    expect(stripHtml('<ul><li>Item 1</li><li>Item 2</li></ul>')).toBe('Item 1 Item 2');
  });

  it('remplace <br> par un espace', () => {
    const result = stripHtml('Ligne 1<br>Ligne 2');
    expect(result).toBe('Ligne 1 Ligne 2');
  });

  it('supprime les balises inconnues (span, strong, em)', () => {
    expect(stripHtml('<strong>Gras</strong> et <em>italic</em>')).toBe('Gras et italic');
  });

  it('décode les entités HTML', () => {
    // &nbsp; → ' ', puis \s+ collapse les espaces multiples, .trim() retire les bords
    expect(stripHtml('&amp; &lt; &gt; &nbsp;')).toBe('& < >');
  });

  it('normalise les espaces multiples', () => {
    // \s+ collapse TOUS les espaces multiples → un seul espace entre les mots
    expect(stripHtml('<p>  trop   d espaces  </p>')).toBe('trop d espaces');
  });

  it('retourne une chaîne vide si contenu vide', () => {
    expect(stripHtml('')).toBe('');
  });

  it('gère le texte brut sans balises', () => {
    expect(stripHtml('Simple texte')).toBe('Simple texte');
  });

  it('gère le HTML imbriqué de TipTap', () => {
    const html = '<div><p>Paragraphe <strong>gras</strong></p></div>';
    expect(stripHtml(html)).toBe('Paragraphe gras');
  });
});

// ── Tests fmtDate ──────────────────────────────────────────────────────────

describe('fmtDate', () => {
  // Fixer Date.now() pour des tests déterministes
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retourne "Il y a Xh" pour aujourd\'hui', () => {
    const today = new Date('2026-03-18T08:00:00.000Z');
    expect(fmtDate(today)).toBe('Il y a 4h');
  });

  it('retourne "Hier" pour hier', () => {
    const yesterday = new Date('2026-03-17T08:00:00.000Z');
    expect(fmtDate(yesterday)).toBe('Hier');
  });

  it('retourne "Il y a Nj" pour N < 7 jours', () => {
    const threeDaysAgo = new Date('2026-03-15T08:00:00.000Z');
    expect(fmtDate(threeDaysAgo)).toBe('Il y a 3j');
  });

  it('retourne la date formatée pour >= 7 jours', () => {
    const oldDate = new Date('2026-03-01T08:00:00.000Z');
    const result = fmtDate(oldDate);
    // Doit contenir le jour et le mois (format fr-CA)
    expect(result).toMatch(/\d+/);
    expect(result.toLowerCase()).toContain('mars');
  });

  it('retourne "Il y a 6j" pour 6 jours', () => {
    const sixDaysAgo = new Date('2026-03-12T08:00:00.000Z');
    expect(fmtDate(sixDaysAgo)).toBe('Il y a 6j');
  });
});

// ── Tests daysUntilPurge ────────────────────────────────────────────────────

describe('daysUntilPurge', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-18T12:00:00.000Z'));
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('retourne 30 si supprimé aujourd\'hui', () => {
    const today = new Date('2026-03-18T10:00:00.000Z');
    expect(daysUntilPurge(today)).toBe(30);
  });

  it('retourne 20 si supprimé il y a 10 jours', () => {
    const tenDaysAgo = new Date('2026-03-08T10:00:00.000Z');
    expect(daysUntilPurge(tenDaysAgo)).toBe(20);
  });

  it('retourne 0 si supprimé il y a 30+ jours', () => {
    const thirtyOneDaysAgo = new Date('2026-02-15T10:00:00.000Z');
    expect(daysUntilPurge(thirtyOneDaysAgo)).toBe(0);
  });

  it('ne retourne jamais une valeur négative', () => {
    const oneYearAgo = new Date('2025-03-18T10:00:00.000Z');
    expect(daysUntilPurge(oneYearAgo)).toBe(0);
  });

  it('retourne 1 si supprimé il y a 29 jours', () => {
    const twentyNineDaysAgo = new Date('2026-02-17T10:00:00.000Z');
    expect(daysUntilPurge(twentyNineDaysAgo)).toBe(1);
  });
});

// ── Tests applySmartFilters ─────────────────────────────────────────────────

describe('applySmartFilters', () => {
  const now = new Date('2026-03-18T12:00:00.000Z');

  const notes: Note[] = [
    makeNote({ id: '1', tags: ['react', 'ts'], pinned: true,  createdAt: new Date('2026-03-18T00:00:00Z'), updatedAt: new Date('2026-03-18T00:00:00Z') }),
    makeNote({ id: '2', tags: ['react'],        pinned: false, createdAt: new Date('2026-03-15T00:00:00Z'), updatedAt: new Date('2026-03-15T00:00:00Z') }),
    makeNote({ id: '3', tags: ['python'],        pinned: false, createdAt: new Date('2026-01-01T00:00:00Z'), updatedAt: new Date('2026-01-01T00:00:00Z') }),
    makeNote({ id: '4', tags: [],               pinned: true,  createdAt: new Date('2026-03-10T00:00:00Z'), updatedAt: new Date('2026-03-10T00:00:00Z') }),
  ];

  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(now);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filtre par tag (logique OR — au moins un)', () => {
    const filters: SmartFolderFilter = { tags: ['react', 'python'], tagLogic: 'or' };
    const result = applySmartFilters(notes, filters);
    expect(result.map(n => n.id).sort()).toEqual(['1', '2', '3']);
  });

  it('filtre par tag (logique AND — tous les tags)', () => {
    const filters: SmartFolderFilter = { tags: ['react', 'ts'], tagLogic: 'and' };
    const result = applySmartFilters(notes, filters);
    expect(result.map(n => n.id)).toEqual(['1']);
  });

  it('filtre les notes épinglées', () => {
    const filters: SmartFolderFilter = { pinned: true };
    const result = applySmartFilters(notes, filters);
    expect(result.map(n => n.id).sort()).toEqual(['1', '4']);
  });

  it('filtre les notes non-épinglées', () => {
    const filters: SmartFolderFilter = { pinned: false };
    const result = applySmartFilters(notes, filters);
    expect(result.map(n => n.id).sort()).toEqual(['2', '3']);
  });

  it('filtre par createdWithinDays', () => {
    // Notes créées dans les 7 derniers jours (18 mars - 7j = 11 mars)
    const filters: SmartFolderFilter = { createdWithinDays: 7 };
    const result = applySmartFilters(notes, filters);
    expect(result.map(n => n.id).sort()).toEqual(['1', '2']);
  });

  it('filtre par modifiedWithinDays', () => {
    // Notes modifiées dans les 5 derniers jours (18 mars - 5j = 13 mars)
    const filters: SmartFolderFilter = { modifiedWithinDays: 5 };
    const result = applySmartFilters(notes, filters);
    expect(result.map(n => n.id).sort()).toEqual(['1', '2']);
  });

  it('combine plusieurs filtres (AND implicite)', () => {
    // Épinglées ET créées dans les 7 jours
    const filters: SmartFolderFilter = { pinned: true, createdWithinDays: 7 };
    const result = applySmartFilters(notes, filters);
    expect(result.map(n => n.id)).toEqual(['1']);
  });

  it('retourne toutes les notes si aucun filtre', () => {
    const filters: SmartFolderFilter = {};
    const result = applySmartFilters(notes, filters);
    expect(result).toHaveLength(4);
  });

  it('retourne tableau vide si aucune note ne correspond', () => {
    const filters: SmartFolderFilter = { tags: ['nonexistent'], tagLogic: 'or' };
    const result = applySmartFilters(notes, filters);
    expect(result).toHaveLength(0);
  });
});

// ── Tests buildFolderTree ───────────────────────────────────────────────────

describe('buildFolderTree', () => {
  it('construit un arbre simple (racines uniquement)', () => {
    const folders: Folder[] = [
      makeFolder({ id: 'a', name: 'Alpha', order: 1, parentId: null }),
      makeFolder({ id: 'b', name: 'Beta',  order: 0, parentId: null }),
    ];
    const tree = buildFolderTree(folders);
    // Trié par order : Beta (0) avant Alpha (1)
    expect(tree.map(n => n.id)).toEqual(['b', 'a']);
    expect(tree[0].children).toHaveLength(0);
  });

  it('imbrique les sous-dossiers', () => {
    const folders: Folder[] = [
      makeFolder({ id: 'parent', name: 'Parent',  order: 0, parentId: null }),
      makeFolder({ id: 'child',  name: 'Enfant',  order: 0, parentId: 'parent' }),
    ];
    const tree = buildFolderTree(folders);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('parent');
    expect(tree[0].children).toHaveLength(1);
    expect(tree[0].children[0].id).toBe('child');
  });

  it('ignore les dossiers intelligents (isSmart: true)', () => {
    const folders: Folder[] = [
      makeFolder({ id: 'normal', isSmart: false }),
      makeFolder({ id: 'smart',  isSmart: true,  name: 'Smart' }),
    ];
    const tree = buildFolderTree(folders);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('normal');
  });

  it('rattache les orphelins (parentId non trouvé) à la racine', () => {
    const folders: Folder[] = [
      makeFolder({ id: 'orphan', parentId: 'nonexistent', order: 0 }),
    ];
    const tree = buildFolderTree(folders);
    expect(tree).toHaveLength(1);
    expect(tree[0].id).toBe('orphan');
  });

  it('trie récursivement par order', () => {
    const folders: Folder[] = [
      makeFolder({ id: 'parent', name: 'Parent',    order: 0,  parentId: null }),
      makeFolder({ id: 'c2',    name: 'Enfant 2',  order: 1,  parentId: 'parent' }),
      makeFolder({ id: 'c1',    name: 'Enfant 1',  order: 0,  parentId: 'parent' }),
    ];
    const tree = buildFolderTree(folders);
    expect(tree[0].children.map(n => n.id)).toEqual(['c1', 'c2']);
  });

  it('retourne un arbre vide si toutes les dossiers sont intelligents', () => {
    const folders: Folder[] = [
      makeFolder({ id: 's1', isSmart: true }),
      makeFolder({ id: 's2', isSmart: true }),
    ];
    const tree = buildFolderTree(folders);
    expect(tree).toHaveLength(0);
  });

  it('gère une liste vide', () => {
    expect(buildFolderTree([])).toEqual([]);
  });
});
