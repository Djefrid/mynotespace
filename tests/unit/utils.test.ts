/**
 * ============================================================================
 * TESTS — lib/utils.ts
 * ============================================================================
 *
 * Tests unitaires pour la fonction `cn()` (fusion de classes Tailwind).
 * Vérifie la résolution des conflits, les valeurs conditionnelles, etc.
 * ============================================================================
 */

import { describe, it, expect } from 'vitest';
import { cn } from '@/lib/utils';

describe('cn() — fusion de classes Tailwind', () => {
  it('retourne une chaîne vide si aucun argument', () => {
    expect(cn()).toBe('');
  });

  it('retourne la classe unique sans modification', () => {
    expect(cn('text-red-500')).toBe('text-red-500');
  });

  it('fusionne plusieurs classes', () => {
    expect(cn('text-sm', 'font-bold')).toBe('text-sm font-bold');
  });

  it('résout les conflits Tailwind — la dernière classe gagne', () => {
    // p-2 et p-4 sont en conflit → p-4 doit gagner
    expect(cn('p-2', 'p-4')).toBe('p-4');
  });

  it('résout les conflits padding sur un axe précis', () => {
    // px-2 remplacé par px-4
    expect(cn('px-2', 'px-4')).toBe('px-4');
  });

  it('supporte les valeurs conditionnelles (clsx)', () => {
    expect(cn('base', true && 'active', false && 'inactive')).toBe('base active');
  });

  it('supporte les objets conditionnels clsx', () => {
    expect(cn({ 'text-white': true, 'text-black': false })).toBe('text-white');
  });

  it('ignore les valeurs null, undefined, false', () => {
    expect(cn('base', null, undefined, false)).toBe('base');
  });

  it('supporte les tableaux de classes', () => {
    expect(cn(['text-sm', 'font-bold'])).toBe('text-sm font-bold');
  });

  it('fusionne classes normales et conditionnelles imbriquées', () => {
    const isActive = true;
    expect(cn('btn', isActive ? 'bg-primary-500' : 'bg-gray-700', 'text-white'))
      .toBe('btn bg-primary-500 text-white');
  });
});
