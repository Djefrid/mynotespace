import { test, expect } from '@playwright/test';

test.describe('Page connexion', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('affiche le lien "← Accueil"', async ({ page }) => {
    await expect(page.getByRole('link', { name: "Retour à la page d'accueil" })).toBeVisible();
  });

  test('le lien ← Accueil ramène à la landing page', async ({ page }) => {
    await page.getByRole('link', { name: "Retour à la page d'accueil" }).click();
    await expect(page).toHaveURL('/');
  });

  test('affiche une erreur avec des identifiants incorrects', async ({ page }) => {
    await page.getByLabel('Adresse courriel').fill('inconnu@exemple.com');
    await page.getByLabel('Mot de passe').fill('mauvais-mot-de-passe');
    await page.getByRole('button', { name: 'Se connecter' }).click();

    await expect(page.getByRole('alert')).toBeVisible({ timeout: 8_000 });
    await expect(page.getByRole('alert')).toContainText('incorrect');
  });

  test('le lien "Créer un compte" navigue vers /register', async ({ page }) => {
    await page.getByRole('link', { name: 'Créer un compte' }).click();
    await expect(page).toHaveURL('/register');
  });
});

test.describe('Page inscription', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/register');
  });

  test('affiche le lien "← Accueil"', async ({ page }) => {
    await expect(page.getByRole('link', { name: "Retour à la page d'accueil" })).toBeVisible();
  });

  test('affiche une erreur si les mots de passe ne correspondent pas', async ({ page }) => {
    await page.getByLabel('Adresse courriel').fill('nouveau@exemple.com');
    await page.getByLabel('Mot de passe').fill('motdepasse123');
    await page.getByLabel('Confirmer le mot de passe').fill('autrechose456');
    await page.getByRole('button', { name: 'Créer mon compte' }).click();

    await expect(page.getByRole('alert')).toBeVisible();
    await expect(page.getByRole('alert')).toContainText('ne correspondent pas');
  });

  test('le lien "Se connecter" navigue vers /login', async ({ page }) => {
    await page.getByRole('link', { name: 'Se connecter' }).click();
    await expect(page).toHaveURL('/login');
  });
});
