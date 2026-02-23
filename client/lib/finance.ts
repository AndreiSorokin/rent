export type StoreLevelExpenses = {
  manual?: { forecast?: number; actual?: number };
  salaries?: { forecast?: number; actual?: number };
  household?: { forecast?: number; actual?: number };
};

export function calcStoreLevelExpensesTotals(expenses: StoreLevelExpenses | null | undefined) {
  const manualForecast = expenses?.manual?.forecast ?? 0;
  const salariesForecast = expenses?.salaries?.forecast ?? 0;
  const householdForecast = expenses?.household?.forecast ?? 0;
  const manualActual = expenses?.manual?.actual ?? 0;
  const salariesActual = expenses?.salaries?.actual ?? 0;
  const householdActual = expenses?.household?.actual ?? 0;

  return {
    forecast: manualForecast + salariesForecast + householdForecast,
    actual: manualActual + salariesActual + householdActual,
  };
}

export function calcProfit(incomeTotal: number | null | undefined, expensesTotal: number | null | undefined) {
  return (incomeTotal ?? 0) - (expensesTotal ?? 0);
}

export function calcSummaryTotalMoney(
  incomeActualTotal: number | null | undefined,
  expensesActualTotal: number | null | undefined,
) {
  return calcProfit(incomeActualTotal, expensesActualTotal);
}
