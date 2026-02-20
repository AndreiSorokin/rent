import { CURRENCY_SYMBOL, formatMoney, getCurrencySymbol } from './currency';

describe('currency utils', () => {
  it('returns default RUB symbol when currency is missing', () => {
    expect(getCurrencySymbol()).toBe(CURRENCY_SYMBOL.RUB);
    expect(getCurrencySymbol(null)).toBe(CURRENCY_SYMBOL.RUB);
  });

  it('formats money with grouped thousands and 2 decimals', () => {
    expect(formatMoney(13000, 'RUB')).toBe(`13 000.00 ${CURRENCY_SYMBOL.RUB}`);
    expect(formatMoney(1000000.5, 'KZT')).toBe(
      `1 000 000.50 ${CURRENCY_SYMBOL.KZT}`,
    );
  });

  it('formats negative amounts', () => {
    expect(formatMoney(-1520.4, 'RUB')).toBe(`-1 520.40 ${CURRENCY_SYMBOL.RUB}`);
  });
});
