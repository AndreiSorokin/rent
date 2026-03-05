import { expect, test, type Page } from '@playwright/test';

const STORE_ID = 2;
const PAVILION_ID = 47;

function makeJwt(payload: Record<string, unknown>) {
  const header = { alg: 'none', typ: 'JWT' };
  const base64Url = (value: unknown) =>
    Buffer.from(JSON.stringify(value)).toString('base64url');
  return `${base64Url(header)}.${base64Url(payload)}.signature`;
}

async function setAuthorizedSession(page: Page) {
  const token = makeJwt({
    sub: 3333,
    email: 'monthly-visibility@test.local',
    exp: Math.floor(Date.now() / 1000) + 60 * 60,
  });

  await page.addInitScript((jwt) => {
    window.localStorage.setItem('token', jwt);
  }, token);
}

function buildPavilionPayload() {
  const now = new Date();
  const currentPeriod = new Date(now.getFullYear(), now.getMonth(), 1);
  const previousPeriod = new Date(now.getFullYear(), now.getMonth() - 1, 1);

  return {
    id: PAVILION_ID,
    number: 'A-47',
    category: 'Тест',
    squareMeters: 10,
    pricePerSqM: 100,
    rentAmount: 1000,
    status: 'RENTED',
    tenantName: 'ООО Тест',
    utilitiesAmount: 0,
    advertisingAmount: 0,
    prepaidUntil: null,
    discounts: [],
    contracts: [],
    householdExpenses: [],
    expenses: [],
    additionalCharges: [],
    payments: [
      {
        id: 1,
        period: currentPeriod.toISOString(),
        rentPaid: 2222.22,
        utilitiesPaid: 0,
        advertisingPaid: 0,
      },
      {
        id: 2,
        period: previousPeriod.toISOString(),
        rentPaid: 1111.11,
        utilitiesPaid: 0,
        advertisingPaid: 0,
      },
    ],
    paymentTransactions: [
      {
        id: 101,
        period: currentPeriod.toISOString(),
        createdAt: currentPeriod.toISOString(),
        rentPaid: 2222.22,
        utilitiesPaid: 0,
        advertisingPaid: 0,
        bankTransferPaid: 2222.22,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
      },
      {
        id: 102,
        period: previousPeriod.toISOString(),
        createdAt: previousPeriod.toISOString(),
        rentPaid: 1111.11,
        utilitiesPaid: 0,
        advertisingPaid: 0,
        bankTransferPaid: 1111.11,
        cashbox1Paid: 0,
        cashbox2Paid: 0,
      },
    ],
    store: {
      currency: 'RUB',
    },
  };
}

async function mockStoreAndPavilion(page: Page) {
  const pavilionPayload = buildPavilionPayload();

  await page.route('**/*', async (route) => {
    const request = route.request();
    if (request.resourceType() !== 'fetch' && request.resourceType() !== 'xhr') {
      await route.continue();
      return;
    }

    const url = new URL(request.url());
    const pathname = url.pathname;

    if (pathname === `/stores/${STORE_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: STORE_ID,
          name: 'Тестовый объект',
          currency: 'RUB',
          permissions: [
            'VIEW_PAVILIONS',
            'VIEW_CHARGES',
            'VIEW_PAYMENTS',
            'CREATE_PAYMENTS',
          ],
          pavilions: [{ id: PAVILION_ID, category: 'Тест' }],
          pavilionCategoryPresets: ['Тест'],
          pavilionGroups: [],
          staff: [],
        }),
      });
      return;
    }

    if (pathname === `/stores/${STORE_ID}/pavilions/${PAVILION_ID}`) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify(pavilionPayload),
      });
      return;
    }

    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({}),
    });
  });
}

test.describe('Monthly visibility on pavilion pages', () => {
  test('pavilion page shows current-month payment in history', async ({ page }) => {
    await setAuthorizedSession(page);
    await mockStoreAndPavilion(page);

    await page.goto(`/stores/${STORE_ID}/pavilions/${PAVILION_ID}`);

    await expect(page.getByText('2 222.22', { exact: false }).first()).toBeVisible();
  });

  test('archive page shows previous-month payments', async ({ page }) => {
    await setAuthorizedSession(page);
    await mockStoreAndPavilion(page);

    await page.goto(`/stores/${STORE_ID}/pavilions/${PAVILION_ID}/archive`);

    await expect(page.getByText('1 111.11', { exact: false }).first()).toBeVisible();
  });
});

