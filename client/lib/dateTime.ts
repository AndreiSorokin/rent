export type DatePartsInTimeZone = {
  year: number;
  month: number;
  day: number;
};

const getPartsMap = (value: string | Date, timeZone: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(date);
  return new Map(parts.map((part) => [part.type, part.value]));
};

export function getDatePartsInTimeZone(
  value: string | Date | null | undefined,
  timeZone: string,
): DatePartsInTimeZone | null {
  if (!value) return null;
  const map = getPartsMap(value, timeZone);
  if (!map) return null;
  const year = Number(map.get('year'));
  const month = Number(map.get('month'));
  const day = Number(map.get('day'));
  if (!year || !month || !day) return null;
  return { year, month, day };
}

export function getDateKeyInTimeZone(
  value: string | Date,
  timeZone: string,
): string {
  const parts = getDatePartsInTimeZone(value, timeZone);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}-${String(parts.day).padStart(2, '0')}`;
}

export function getTodayDateKeyInTimeZone(timeZone = 'UTC'): string {
  return getDateKeyInTimeZone(new Date(), timeZone) || new Date().toISOString().slice(0, 10);
}

export function getMonthKeyInTimeZone(
  value: string | Date,
  timeZone: string,
): string {
  const parts = getDatePartsInTimeZone(value, timeZone);
  if (!parts) return '';
  return `${parts.year}-${String(parts.month).padStart(2, '0')}`;
}

export function getCurrentMonthKeyInTimeZone(timeZone = 'UTC'): string {
  return getMonthKeyInTimeZone(new Date(), timeZone);
}

export function formatDateInTimeZone(
  value: string | Date | null | undefined,
  timeZone: string,
  locale = 'ru-RU',
  options?: Intl.DateTimeFormatOptions,
): string {
  if (!value) return '-';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString(locale, {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    ...options,
    timeZone,
  });
}

export function formatMonthLabelFromKey(
  monthKey: string,
  timeZone: string,
  locale = 'ru-RU',
): string {
  const [yearRaw, monthRaw] = monthKey.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  if (!year || !month) return monthKey;
  const date = new Date(Date.UTC(year, month - 1, 1));
  return date.toLocaleDateString(locale, {
    month: 'long',
    year: 'numeric',
    timeZone,
  });
}

export function formatMonthNumberYearInTimeZone(
  value: string | Date,
  timeZone: string,
): string {
  const monthKey = getMonthKeyInTimeZone(value, timeZone);
  const [yearRaw, monthRaw] = monthKey.split('-');
  if (!yearRaw || !monthRaw) return '-';
  return `${monthRaw}.${yearRaw}`;
}

export function isSameMonthInTimeZone(
  dateValue: string | Date | null | undefined,
  year: number,
  monthIndex: number,
  timeZone: string,
): boolean {
  const parts = getDatePartsInTimeZone(dateValue, timeZone);
  if (!parts) return false;
  return parts.year === year && parts.month === monthIndex + 1;
}

export function isSameDayKeyInTimeZone(
  dateValue: string | Date | null | undefined,
  dayKey: string,
  timeZone: string,
): boolean {
  if (!dateValue || !dayKey) return true;
  const parts = getDatePartsInTimeZone(dateValue, timeZone);
  if (!parts) return false;
  const [year, month, day] = dayKey.split('-').map(Number);
  if (!year || !month || !day) return true;
  return parts.year === year && parts.month === month && parts.day === day;
}
