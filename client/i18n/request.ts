import { getRequestConfig } from 'next-intl/server';
import { cookies } from 'next/headers';

export const locales = ['ru', 'en'] as const;
export type Locale = (typeof locales)[number];
export const defaultLocale: Locale = 'ru';
export const localeCookieName = 'rendlify-locale';

async function loadMessages(locale: Locale) {
  const [
    base,
    dashboardCore,
    dashboardModalsA,
    dashboardModalsB,
    pavilionDetail,
    pavilionArchiveMedia,
    summary,
    expenses,
    accounting,
    sidebarShared,
    storeOverview,
    expenseModals,
    householdUtilities,
    staff,
    settings,
    activityIncomeMedia,
  ] = await Promise.all([
    import(`../messages/${locale}.json`),
    import(`../messages/${locale}/dashboard-core.json`),
    import(`../messages/${locale}/dashboard-modals-a.json`),
    import(`../messages/${locale}/dashboard-modals-b.json`),
    import(`../messages/${locale}/pavilion-detail.json`),
    import(`../messages/${locale}/pavilion-archive-media.json`),
    import(`../messages/${locale}/summary.json`),
    import(`../messages/${locale}/expenses.json`),
    import(`../messages/${locale}/accounting.json`),
    import(`../messages/${locale}/sidebar-shared.json`),
    import(`../messages/${locale}/store-overview.json`),
    import(`../messages/${locale}/expense-modals.json`),
    import(`../messages/${locale}/household-utilities.json`),
    import(`../messages/${locale}/staff.json`),
    import(`../messages/${locale}/settings.json`),
    import(`../messages/${locale}/activity-income-media.json`),
  ]);

  return {
    ...base.default,
    ...dashboardCore.default,
    ...dashboardModalsA.default,
    ...dashboardModalsB.default,
    ...pavilionDetail.default,
    ...pavilionArchiveMedia.default,
    ...summary.default,
    ...expenses.default,
    ...accounting.default,
    ...sidebarShared.default,
    ...storeOverview.default,
    ...expenseModals.default,
    ...householdUtilities.default,
    ...staff.default,
    ...settings.default,
    ...activityIncomeMedia.default,
  };
}

export default getRequestConfig(async () => {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieName)?.value;
  const locale = (locales as readonly string[]).includes(cookieLocale ?? '')
    ? (cookieLocale as Locale)
    : defaultLocale;

  return {
    locale,
    messages: await loadMessages(locale),
  };
});
