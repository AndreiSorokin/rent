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
    sub: 2222,
    email: 'finance@test.local',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });

  await page.addInitScript((jwt) => {
    window.localStorage.setItem('token', jwt);
  }, token);
}

async function mockStoreWithFinancials(page: Page) {
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
          permissions: ['VIEW_PAVILIONS', 'VIEW_PAYMENTS'],
          pavilions: [],
          pavilionGroups: [],
          pavilionCategoryPresets: [],
          staff: [],
        }),
      });
      return;
    }

    if (pathname === `/stores/${STORE_ID}/analytics`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          income: {
            forecast: { total: 120000 },
            actual: { total: 90000 },
          },
          expenses: {
            total: { forecast: 45000, actual: 30000 },
          },
          summaryPage: {
            income: {
              total: 90000,
              previousMonthBalance: 10000,
              channels: {
                bankTransfer: 40000,
                cashbox1: 30000,
                cashbox2: 20000,
                total: 90000,
              },
              channelsByEntity: {
                rent: { bankTransfer: 25000, cashbox1: 15000, cashbox2: 10000, total: 50000 },
                facilities: { bankTransfer: 7000, cashbox1: 5000, cashbox2: 3000, total: 15000 },
                advertising: { bankTransfer: 5000, cashbox1: 6000, cashbox2: 4000, total: 15000 },
                additional: { bankTransfer: 3000, cashbox1: 4000, cashbox2: 3000, total: 10000 },
              },
            },
            expenses: {
              totals: { forecast: 70000, actual: 30000 },
              byType: {},
              storeLevel: {
                manual: { forecast: 1000, actual: 500 },
                salaries: { forecast: 2000, actual: 1500 },
                household: { forecast: 300, actual: 250 },
              },
            },
            tradeArea: {},
            groupedByPavilionGroups: [],
            saldo: 60000,
          },
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

test.describe('Financial core', () => {
  test('store page cards compute forecast and actual profit', async ({ page }) => {
    await setAuthorizedSession(page);
    await mockStoreWithFinancials(page);

    await page.goto(`/stores/${STORE_ID}`);

    await expect(page.getByText(/Доходы/i)).toBeVisible();
    await expect(page.getByText(/Расходы/i)).toBeVisible();
    await expect(page.getByText(/Прибыль/i)).toBeVisible();

    await expect(page.getByText(/Прогноз:\s*120 000\.00/i).first()).toBeVisible();
    await expect(page.getByText(/Факт:\s*90 000\.00/i).first()).toBeVisible();
    await expect(page.getByText(/Прогноз:\s*45 000\.00/i).first()).toBeVisible();
    await expect(page.getByText(/Факт:\s*30 000\.00/i).first()).toBeVisible();
    await expect(page.getByText(/Прогноз:\s*75 000\.00/i).first()).toBeVisible();
    await expect(page.getByText(/Факт:\s*60 000\.00/i).first()).toBeVisible();
  });

  test('summary page shows channel totals and section totals', async ({ page }) => {
    await setAuthorizedSession(page);
    await mockStoreWithFinancials(page);

    await page.goto(`/stores/${STORE_ID}/summary`);

    await expect(page.getByText(/Итого доход:\s*90 000\.00/i)).toBeVisible();
    await expect(page.getByText(/Итого по каналам:\s*90 000\.00/i)).toBeVisible();
    await expect(page.getByText(/Итого:\s*50 000\.00/i)).toBeVisible();
    await expect(page.getByText(/Итого:\s*15 000\.00/i).first()).toBeVisible();
    await expect(page.getByText(/Итого:\s*10 000\.00/i)).toBeVisible();
    await expect(page.getByText(/60 000\.00 ₽/).first()).toBeVisible();
  });

  test('user without VIEW_PAYMENTS is redirected from summary page to store page', async ({
    page,
  }) => {
    await setAuthorizedSession(page);
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        await route.continue();
        return;
      }

      const url = new URL(route.request().url());
      if (url.pathname === `/stores/${STORE_ID}`) {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            id: STORE_ID,
            name: 'Тестовый объект',
            currency: 'RUB',
            permissions: ['VIEW_PAVILIONS'],
            pavilions: [],
            pavilionGroups: [],
            pavilionCategoryPresets: [],
            staff: [],
          }),
        });
        return;
      }

      await route.continue();
    });

    await page.goto(`/stores/${STORE_ID}/summary`);
    await expect(page).toHaveURL(new RegExp(`/stores/${STORE_ID}$`));
  });
});
