import { test, expect } from '@playwright/test';

test.describe('Landing page', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('affiche le titre MyNoteSpace', async ({ page }) => {
    await expect(page.getByRole('heading', { name: 'MyNoteSpace' })).toBeVisible();
  });

  test('le bouton "Commencer gratuitement" navigue vers /register', async ({ page }) => {
    await page.getByRole('link', { name: 'Commencer gratuitement' }).first().click();
    await expect(page).toHaveURL('/register');
  });

  test('le lien "Se connecter" navigue vers /login', async ({ page }) => {
    await page.getByRole('link', { name: 'Se connecter' }).first().click();
    await expect(page).toHaveURL('/login');
  });

  test('affiche les 6 cartes de fonctionnalités', async ({ page }) => {
    const section = page.getByText('Fonctionnalités');
    await expect(section).toBeVisible();

    const cards = page.locator('section').filter({ hasText: 'Éditeur riche' }).locator('[class*="rounded"]');
    // Au moins 4 fonctionnalités visibles
    await expect(page.getByText('Éditeur riche et puissant')).toBeVisible();
    await expect(page.getByText('Recherche instantanée')).toBeVisible();
  });

  test('le footer affiche le copyright', async ({ page }) => {
    await expect(page.getByText(/MyNoteSpace/)).toBeVisible();
  });
});
