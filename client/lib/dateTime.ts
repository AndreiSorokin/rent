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

export function formatDateKey(value: string | null | undefined): string {
  if (!value) return '-';
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value.trim());
  if (!match) return value;
  return `${match[3]}.${match[2]}.${match[1]}`;
}

export function normalizeDateInputToDateKey(
  value: string | null | undefined,
): string {
  const normalized = String(value ?? '').trim();
  if (!normalized) return '';

  if (/^\d{4}-\d{2}-\d{2}$/.test(normalized)) {
    return normalized;
  }

  const displayMatch = /^(\d{1,2})[./-](\d{1,2})[./-](\d{4})$/.exec(normalized);
  if (!displayMatch) return '';

  const day = displayMatch[1].padStart(2, '0');
  const month = displayMatch[2].padStart(2, '0');
  const year = displayMatch[3];

  if (Number(day) < 1 || Number(day) > 31 || Number(month) < 1 || Number(month) > 12) {
    return '';
  }

  const candidate = new Date(Date.UTC(Number(year), Number(month) - 1, Number(day)));
  if (
    Number.isNaN(candidate.getTime()) ||
    candidate.getUTCFullYear() !== Number(year) ||
    candidate.getUTCMonth() !== Number(month) - 1 ||
    candidate.getUTCDate() !== Number(day)
  ) {
    return '';
  }

  return `${year}-${month}-${day}`;
}

export function formatDateInputDisplay(
  value: string | null | undefined,
): string {
  const digits = String(value ?? '').replace(/\D/g, '').slice(0, 8);

  if (!digits) return '';
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) {
    return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  }

  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
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

export function getDaysUntilDateKey(
  value: string | null | undefined,
  timeZone: string,
): number | null {
  const normalized = normalizeDateInputToDateKey(value);
  if (!normalized) return null;

  const [yearRaw, monthRaw, dayRaw] = normalized.split('-');
  const year = Number(yearRaw);
  const month = Number(monthRaw);
  const day = Number(dayRaw);
  if (!year || !month || !day) return null;

  const targetUtc = Date.UTC(year, month - 1, day);
  const todayKey = getTodayDateKeyInTimeZone(timeZone);
  const [todayYearRaw, todayMonthRaw, todayDayRaw] = todayKey.split('-');
  const todayYear = Number(todayYearRaw);
  const todayMonth = Number(todayMonthRaw);
  const todayDay = Number(todayDayRaw);
  if (!todayYear || !todayMonth || !todayDay) return null;

  const todayUtc = Date.UTC(todayYear, todayMonth - 1, todayDay);
  return Math.round((targetUtc - todayUtc) / (24 * 60 * 60 * 1000));
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
