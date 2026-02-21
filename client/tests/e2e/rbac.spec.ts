import { expect, test, type Page } from '@playwright/test';

const STORE_ID = 2;

function makeJwt(payload: Record<string, unknown>) {
  const header = { alg: 'none', typ: 'JWT' };
  const base64Url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${base64Url(header)}.${base64Url(payload)}.signature`;
}

async function setAuthorizedSession(page: Page) {
  const token = makeJwt({
    sub: 999,
    email: 'rbac@test.local',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });

  await page.addInitScript((jwt) => {
    window.localStorage.setItem('token', jwt);
  }, token);
}

async function mockStoreApi(page: Page, permissions: string[]) {
  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
      await route.continue();
      return;
    }

    const url = new URL(route.request().url());
    const pathname = url.pathname;

    if (pathname === `/stores/${STORE_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: STORE_ID,
          name: 'Тестовый объект',
          currency: 'RUB',
          permissions,
          pavilions: [
            {
              id: 11,
              number: 'A-11',
              squareMeters: 10,
              pricePerSqM: 100,
              status: 'AVAILABLE',
              tenantName: null,
              category: 'Одежда',
              groupMemberships: [],
            },
          ],
          pavilionGroups: [{ id: 1, name: 'Первый этаж' }],
          pavilionCategoryPresets: ['Одежда', 'Обувь'],
          staff: [],
        }),
      });
      return;
    }

    if (pathname === `/stores/${STORE_ID}/users`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    if (pathname === `/stores/${STORE_ID}/analytics`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          income: { forecast: { total: 0 }, actual: { total: 0 } },
          expenses: { total: { forecast: 0, actual: 0 } },
          summaryPage: { income: { previousMonthBalance: 0 } },
        }),
      });
      return;
    }

    if (pathname === `/stores/${STORE_ID}/accounting-table`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
      return;
    }

    await route.continue();
  });
}

test.describe('RBAC UI', () => {
  test('view-only pavilion user cannot see create/settings/admin controls', async ({
    page,
  }) => {
    await setAuthorizedSession(page);
    await mockStoreApi(page, ['VIEW_PAVILIONS']);

    await page.goto(`/stores/${STORE_ID}`);

    await expect(page.locator(`a[href="/stores/${STORE_ID}/settings"]`)).toHaveCount(0);
    await expect(page.getByRole('button', { name: /\+ Добавить павильон/i })).toHaveCount(0);
    await expect(page.getByText(/Пользователи и права/i)).toHaveCount(0);
  });

  test('user with EDIT_PAVILIONS sees settings and can use group assignment controls', async ({
    page,
  }) => {
    await setAuthorizedSession(page);
    await mockStoreApi(page, ['VIEW_PAVILIONS', 'EDIT_PAVILIONS']);

    await page.goto(`/stores/${STORE_ID}`);

    await expect(page.locator(`a[href="/stores/${STORE_ID}/settings"]`)).toBeVisible();
    await expect(page.getByRole('button', { name: /Добавить/i }).first()).toBeVisible();
  });

  test('user without admin permissions cannot access management sections on settings page', async ({
    page,
  }) => {
    await setAuthorizedSession(page);
    await mockStoreApi(page, ['VIEW_PAVILIONS']);

    await page.goto(`/stores/${STORE_ID}/settings`);

    await expect(page.getByText(/Основные настройки/i)).toHaveCount(0);
    await expect(page.getByText(/Пользователи и права/i)).toHaveCount(0);
    await expect(page.getByText(/Опасная зона/i)).toHaveCount(0);
  });

  test('admin can access management sections on settings page', async ({ page }) => {
    await setAuthorizedSession(page);
    await mockStoreApi(page, ['ASSIGN_PERMISSIONS', 'EDIT_PAVILIONS']);

    await page.goto(`/stores/${STORE_ID}/settings`);

    await expect(page.getByText(/Основные настройки/i)).toBeVisible();
    await expect(page.getByText(/Категории павильонов/i)).toBeVisible();
    await expect(page.getByText(/Группы павильонов/i)).toBeVisible();
    await expect(page.getByText(/Пользователи и права/i)).toBeVisible();
    await expect(page.getByText(/Опасная зона/i)).toBeVisible();
  });
});
