import {
  calcProfit,
  calcStoreLevelExpensesTotals,
  calcSummaryTotalMoney,
} from './finance';

describe('finance calculations', () => {
  it('calculates store-level forecast and actual totals', () => {
    const totals = calcStoreLevelExpensesTotals({
      manual: { forecast: 1000, actual: 500 },
      salaries: { forecast: 2000, actual: 1500 },
      household: { forecast: 300, actual: 250 },
    });

    expect(totals).toEqual({
      forecast: 3300,
      actual: 2250,
    });
  });

  it('treats missing values as zero', () => {
    const totals = calcStoreLevelExpensesTotals({
      manual: { forecast: 1000 },
    });

    expect(totals).toEqual({
      forecast: 1000,
      actual: 0,
    });
  });

  it('calculates profit as income minus expenses', () => {
    expect(calcProfit(120000, 45000)).toBe(75000);
    expect(calcProfit(0, 100)).toBe(-100);
  });

  it('calculates summary total money from actual totals', () => {
    expect(calcSummaryTotalMoney(210000, 50000)).toBe(160000);
  });
});
