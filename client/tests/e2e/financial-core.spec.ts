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

    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === `/stores/${STORE_ID}` || pathname === `/api/stores/${STORE_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: STORE_ID,
          name: 'Тестовый объект',
          currency: 'RUB',
          permissions: ['VIEW_PAVILIONS', 'VIEW_PAYMENTS', 'VIEW_SUMMARY'],
          pavilions: [],
          pavilionGroups: [],
          pavilionCategoryPresets: [],
          staff: [],
        }),
      });
      return;
    }

    if (
      pathname === `/stores/${STORE_ID}/analytics/summary-view` ||
      pathname === `/api/stores/${STORE_ID}/analytics/summary-view`
    ) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summaryPage: {
            income: {
              forecast: { total: 120000 },
              total: 90000,
              previousMonthBalance: 10000,
              previousMonthChannels: {
                bankTransfer: 4000,
                cashbox1: 3000,
                cashbox2: 3000,
                total: 10000,
              },
              carryAdjustment: 0,
              channels: {
                bankTransfer: 40000,
                cashbox1: 30000,
                cashbox2: 20000,
                total: 90000,
              },
              channelsByEntity: {
                rent: {
                  bankTransfer: 25000,
                  cashbox1: 15000,
                  cashbox2: 10000,
                  total: 50000,
                },
                facilities: {
                  bankTransfer: 7000,
                  cashbox1: 5000,
                  cashbox2: 3000,
                  total: 15000,
                },
                advertising: {
                  bankTransfer: 5000,
                  cashbox1: 6000,
                  cashbox2: 4000,
                  total: 15000,
                },
                additional: {
                  bankTransfer: 3000,
                  cashbox1: 4000,
                  cashbox2: 3000,
                  total: 10000,
                },
                storeExtra: {
                  bankTransfer: 0,
                  cashbox1: 0,
                  cashbox2: 0,
                  total: 0,
                },
              },
            },
            expenses: {
              totals: { forecast: 45000, actual: 30000 },
              byType: {},
              channels: {
                bankTransfer: 15000,
                cashbox1: 9000,
                cashbox2: 6000,
                total: 30000,
              },
              channelsByType: {},
              storeLevel: {
                manual: { forecast: 1000, actual: 500 },
                salaries: { forecast: 2000, actual: 1500 },
                household: { forecast: 300, actual: 250 },
              },
            },
            tradeArea: {},
            groupedByPavilionGroups: [],
            saldo: 70000,
            saldoChannels: {
              bankTransfer: 29000,
              cashbox1: 23000,
              cashbox2: 18000,
              total: 70000,
            },
            financeTrend: [],
          },
        }),
      });
      return;
    }

    if (
      pathname === `/stores/${STORE_ID}/accounting-table` ||
      pathname === `/api/stores/${STORE_ID}/accounting-table`
    ) {
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
  test.skip('summary cards compute forecast and actual profit', async ({ page }) => {
    await setAuthorizedSession(page);
    await mockStoreWithFinancials(page);

    await page.goto(`/stores/${STORE_ID}/summary`);

    await expect(page.getByRole('heading', { name: /Доходы/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Расходы/i })).toBeVisible();
    await expect(page.getByRole('heading', { name: /Прибыль/i })).toBeVisible();

    const overview = page.locator('section').filter({ has: page.getByRole('heading', { name: /Доходы/i }) }).first();

    await expect(overview.getByText(/Прогноз:\s*130[\s\u00A0\u202F]000\.00/i)).toBeVisible();
    await expect(overview.getByText(/Факт:\s*100[\s\u00A0\u202F]000\.00/i)).toBeVisible();
    await expect(overview.getByText(/Прогноз:\s*45[\s\u00A0\u202F]000\.00/i)).toBeVisible();
    await expect(overview.getByText(/Факт:\s*30[\s\u00A0\u202F]000\.00/i)).toBeVisible();
    await expect(overview.getByText(/Прогноз:\s*85[\s\u00A0\u202F]000\.00/i)).toBeVisible();
    await expect(overview.getByText(/Факт:\s*70[\s\u00A0\u202F]000\.00/i)).toBeVisible();
  });

  test('summary page shows channels and entity totals', async ({ page }) => {
    await setAuthorizedSession(page);
    await mockStoreWithFinancials(page);

    await page.goto(`/stores/${STORE_ID}/summary`);

    const incomeSection = page.locator('#summary-income');

    await expect(incomeSection.getByText('Итого приход', { exact: true })).toBeVisible();
    await expect(
      incomeSection.locator('p.text-2xl').filter({ hasText: /100[\s\u00A0\u202F]000\.00/i }),
    ).toBeVisible();
    await expect(incomeSection.getByText(/Безналичные/i).first()).toBeVisible();
    await expect(incomeSection.getByText(/Наличные касса 1/i).first()).toBeVisible();
    await expect(incomeSection.getByText(/Наличные касса 2/i).first()).toBeVisible();
    await expect(incomeSection.getByText(/50[\s\u00A0\u202F]000\.00/i).first()).toBeVisible();
    await expect(incomeSection.getByText(/15[\s\u00A0\u202F]000\.00/i).first()).toBeVisible();
    await expect(incomeSection.getByText(/10[\s\u00A0\u202F]000\.00/i).first()).toBeVisible();
  });

  test('user without VIEW_SUMMARY is redirected from summary page to store page', async ({
    page,
  }) => {
    await setAuthorizedSession(page);
    await page.route('**/*', async (route) => {
      const request = route.request();
      if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
        await route.continue();
        return;
      }

      const url = new URL(request.url());
      if (url.pathname === `/stores/${STORE_ID}` || url.pathname === `/api/stores/${STORE_ID}`) {
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
