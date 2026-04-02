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
    sub: 1999,
    email: 'summary@test.local',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });

  await page.addInitScript((jwt) => {
    window.localStorage.setItem('token', jwt);
  }, token);
}

async function mockSummaryApi(page: Page) {
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
          permissions: ['VIEW_PAYMENTS', 'VIEW_SUMMARY'],
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
              forecast: { total: 210000 },
              total: 200000,
              previousMonthBalance: 10000,
              previousMonthChannels: {
                bankTransfer: 3000,
                cashbox1: 4000,
                cashbox2: 3000,
                total: 10000,
              },
              carryAdjustment: 0,
              channels: {
                bankTransfer: 80000,
                cashbox1: 70000,
                cashbox2: 50000,
                total: 200000,
              },
            },
            expenses: {
              totals: { forecast: 70000, actual: 50000 },
              byType: {},
              channels: {
                bankTransfer: 25000,
                cashbox1: 15000,
                cashbox2: 10000,
                total: 50000,
              },
              channelsByType: {},
            },
            tradeArea: {},
            groupedByPavilionGroups: [],
            saldo: 150000,
            saldoChannels: {
              bankTransfer: 55000,
              cashbox1: 55000,
              cashbox2: 40000,
              total: 150000,
            },
            financeTrend: [],
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

<<<<<<< HEAD
test('summary shows money totals using temporary income-with-previous logic', async ({ page }) => {
=======
test.skip('summary shows money totals using actual income and actual expenses', async ({
  page,
}) => {
>>>>>>> ac4dab1e5b7ec83cc7a5323076c696ec668cde3d
  await setAuthorizedSession(page);
  await mockSummaryApi(page);

  await page.goto(`/stores/${STORE_ID}/summary`);

<<<<<<< HEAD
  const overview = page.locator('section').filter({ has: page.getByRole('heading', { name: /Доходы/i }) }).first();

  await expect(overview.getByText(/Факт:\s*210[\s\u00A0\u202F]000\.00/i)).toBeVisible();
  await expect(overview.getByText(/Факт:\s*50[\s\u00A0\u202F]000\.00/i)).toBeVisible();
  await expect(overview.getByText(/Факт:\s*150[\s\u00A0\u202F]000\.00/i)).toBeVisible();
=======
  await expect(page.getByText(/Факт:\s*210[\s\u00A0\u202F]000\.00/i).first()).toBeVisible();
  await expect(page.getByText(/Факт:\s*50[\s\u00A0\u202F]000\.00/i).first()).toBeVisible();
  await expect(page.getByText(/Факт:\s*150[\s\u00A0\u202F]000\.00/i).first()).toBeVisible();
>>>>>>> ac4dab1e5b7ec83cc7a5323076c696ec668cde3d
});
