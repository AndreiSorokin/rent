import { expect, test } from '@playwright/test';

test('login page renders form controls', async ({ page }) => {
  await page.goto('/login');

  await expect(page).toHaveURL(/\/login$/);
  await expect(page.locator('input[placeholder="Email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toBeVisible();
  await expect(page.locator('form button').first()).toBeVisible();
});

test('register page is reachable and has required controls', async ({ page }) => {
  await page.goto('/register');

  await expect(page).toHaveURL(/\/register$/);
  await expect(page.locator('input[placeholder="Email"]')).toBeVisible();
  await expect(page.locator('input[type="password"]')).toHaveCount(2);
  await expect(page.locator('form button').first()).toBeVisible();
});

test('unknown route redirects to dashboard (app not-found behavior)', async ({ page }) => {
  await page.goto('/this-route-does-not-exist');
  await expect(page).toHaveURL(/\/dashboard$/);
});
