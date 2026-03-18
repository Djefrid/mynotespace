/**
 * ============================================================================
 * TESTS — lib/notes-service.ts :: extractHashtags()
 * ============================================================================
 *
 * Tests unitaires pour la fonction `extractHashtags()` qui extrait les tags
 * (#tag) depuis le contenu HTML d'une note.
 * Firebase n'est pas impliqué — les tests sont purement synchrones.
 * ============================================================================
 */

import { describe, it, expect, vi } from 'vitest';

// Mock Firebase pour éviter son initialisation pendant les tests
vi.mock('@/lib/firebase/config', () => ({
  db:      null,
  storage: null,
  auth:    null,
  isFirebaseConfigured: false,
}));

import { extractHashtags } from '@/lib/notes-service';

describe('extractHashtags() — extraction des hashtags', () => {
  it('retourne un tableau vide si aucun tag dans le texte', () => {
    expect(extractHashtags('<p>Bonjour monde</p>')).toEqual([]);
  });

  it('extrait un tag simple', () => {
    expect(extractHashtags('<p>Note avec #travail</p>')).toContain('travail');
  });

  it('extrait plusieurs tags', () => {
    const tags = extractHashtags('<p>#react #typescript #nextjs</p>');
    expect(tags).toContain('react');
    expect(tags).toContain('typescript');
    expect(tags).toContain('nextjs');
  });

  it('convertit les tags en minuscules', () => {
    expect(extractHashtags('<p>#React #TypeScript</p>')).toEqual(
      expect.arrayContaining(['react', 'typescript'])
    );
  });

  it('déduplique les tags identiques', () => {
    const tags = extractHashtags('<p>#react et encore #react</p>');
    expect(tags.filter(t => t === 'react')).toHaveLength(1);
  });

  it('supporte les tags avec tirets et underscores', () => {
    const tags = extractHashtags('<p>#mon-projet #mon_tag</p>');
    expect(tags).toContain('mon-projet');
    expect(tags).toContain('mon_tag');
  });

  it('supporte les caractères accentués français', () => {
    const tags = extractHashtags('<p>#développement #réunion #tâche</p>');
    expect(tags).toContain('développement');
    expect(tags).toContain('réunion');
    expect(tags).toContain('tâche');
  });

  it('ignore les # dans les URLs (fragment)', () => {
    const tags = extractHashtags('<p><a href="https://example.com/page#section">lien</a></p>');
    expect(tags).not.toContain('section');
  });

  it('ignore les # de titres Markdown (## heading)', () => {
    // Le lookbehind évite # précédé par un autre #
    const tags = extractHashtags('## Titre\n\n#vrai-tag');
    expect(tags).toContain('vrai-tag');
  });

  it('ignore les tags qui commencent par un chiffre', () => {
    // Regex exige une lettre comme premier caractère après #
    const tags = extractHashtags('<p>#123abc</p>');
    expect(tags).not.toContain('123abc');
  });

  it('extrait les tags depuis du HTML avec balises imbriquées', () => {
    const html = '<p><strong>#important</strong> et <em>#urgent</em></p>';
    expect(extractHashtags(html)).toEqual(expect.arrayContaining(['important', 'urgent']));
  });

  it('retourne un tableau vide sur une chaîne vide', () => {
    expect(extractHashtags('')).toEqual([]);
  });
});
