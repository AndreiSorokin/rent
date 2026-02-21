import { expect, test } from '@playwright/test';

function makeJwt(payload: Record<string, unknown>) {
  const header = { alg: 'none', typ: 'JWT' };
  const base64Url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${base64Url(header)}.${base64Url(payload)}.signature`;
}

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
  const token = makeJwt({
    sub: 111,
    email: 'smoke@test.local',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });
  await page.addInitScript((jwt) => {
    window.localStorage.setItem('token', jwt);
  }, token);

  await page.goto('/this-route-does-not-exist');
  await expect(page).toHaveURL(/\/dashboard$/);
});
