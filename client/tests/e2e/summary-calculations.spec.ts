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
          permissions: ['VIEW_PAYMENTS'],
        }),
      });
      return;
    }

    if (pathname === `/stores/${STORE_ID}/analytics`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          summaryPage: {
            income: {
              total: 200000,
              previousMonthBalance: 10000,
              channels: { bankTransfer: 80000, cashbox1: 70000, cashbox2: 50000, total: 200000 },
            },
            expenses: {
              totals: { forecast: 70000, actual: 50000 },
              byType: {},
              storeLevel: {
                manual: { forecast: 1000, actual: 500 },
                salaries: { forecast: 2000, actual: 1500 },
                household: { forecast: 300, actual: 250 },
              },
            },
            tradeArea: {},
            groupedByPavilionGroups: [],
          },
        }),
      });
      return;
    }

    await route.continue();
  });
}

test('summary shows money totals using actual income and actual expenses', async ({ page }) => {
  await setAuthorizedSession(page);
  await mockSummaryApi(page);

  await page.goto(`/stores/${STORE_ID}/summary`);

  await expect(page.getByText('150 000.00 ₽').first()).toBeVisible();
});
