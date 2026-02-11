export type StoreCurrency = 'RUB' | 'KZT';

export const CURRENCY_SYMBOL: Record<StoreCurrency, string> = {
  RUB: '₽',
  KZT: '₸',
};

export function getCurrencySymbol(currency?: string | null) {
  if (currency === 'KZT') return CURRENCY_SYMBOL.KZT;
  return CURRENCY_SYMBOL.RUB;
}

export function formatMoney(
  value: number | string | null | undefined,
  currency?: string | null,
) {
  const amount = Number(value ?? 0);
  const safeAmount = Number.isFinite(amount) ? amount : 0;
  return `${safeAmount.toFixed(2)} ${getCurrencySymbol(currency)}`;
}
