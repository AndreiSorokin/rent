'use client';

export type TimeZoneOption = {
  value: string;
  label: string;
  keywords: string[];
  priority: number;
};

type TimeZoneCity = {
  city: string;
  region: string;
  timeZone: string;
  aliases?: string[];
  priority?: number;
};

const TIME_ZONE_CITIES: TimeZoneCity[] = [
  { city: 'UTC', region: 'Стандартное время', timeZone: 'UTC', aliases: ['utc', 'gmt', 'гринвич'], priority: 100 },
  { city: 'Москва', region: 'Россия', timeZone: 'Europe/Moscow', aliases: ['moscow', 'msk'], priority: 99 },
  { city: 'Санкт-Петербург', region: 'Россия', timeZone: 'Europe/Moscow', aliases: ['saint petersburg', 'spb', 'питер'], priority: 97 },
  { city: 'Казань', region: 'Россия', timeZone: 'Europe/Moscow', aliases: ['kazan'], priority: 94 },
  { city: 'Сочи', region: 'Россия', timeZone: 'Europe/Moscow', aliases: ['sochi'], priority: 90 },
  { city: 'Самара', region: 'Россия', timeZone: 'Europe/Samara', aliases: ['samara'], priority: 93 },
  { city: 'Екатеринбург', region: 'Россия', timeZone: 'Asia/Yekaterinburg', aliases: ['yekaterinburg', 'ekaterinburg'], priority: 95 },
  { city: 'Омск', region: 'Россия', timeZone: 'Asia/Omsk', aliases: ['omsk'], priority: 89 },
  { city: 'Новосибирск', region: 'Россия', timeZone: 'Asia/Novosibirsk', aliases: ['novosibirsk'], priority: 96 },
  { city: 'Красноярск', region: 'Россия', timeZone: 'Asia/Krasnoyarsk', aliases: ['krasnoyarsk'], priority: 88 },
  { city: 'Иркутск', region: 'Россия', timeZone: 'Asia/Irkutsk', aliases: ['irkutsk'], priority: 87 },
  { city: 'Владивосток', region: 'Россия', timeZone: 'Asia/Vladivostok', aliases: ['vladivostok'], priority: 91 },
  { city: 'Алматы', region: 'Казахстан', timeZone: 'Asia/Almaty', aliases: ['almaty'], priority: 98 },
  { city: 'Астана', region: 'Казахстан', timeZone: 'Asia/Almaty', aliases: ['astana', 'nur-sultan', 'нурсултан'], priority: 97 },
  { city: 'Шымкент', region: 'Казахстан', timeZone: 'Asia/Almaty', aliases: ['shymkent'], priority: 92 },
  { city: 'Караганда', region: 'Казахстан', timeZone: 'Asia/Almaty', aliases: ['karaganda'], priority: 90 },
  { city: 'Павлодар', region: 'Казахстан', timeZone: 'Asia/Almaty', aliases: ['pavlodar'], priority: 86 },
  { city: 'Актобе', region: 'Казахстан', timeZone: 'Asia/Aqtobe', aliases: ['aktobe', 'aqtobe'], priority: 89 },
  { city: 'Атырау', region: 'Казахстан', timeZone: 'Asia/Atyrau', aliases: ['atyrau'], priority: 85 },
  { city: 'Актау', region: 'Казахстан', timeZone: 'Asia/Aqtau', aliases: ['aktau', 'aqtau'], priority: 84 },
];

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function getUtcOffsetLabel(timeZone: string) {
  try {
    const dtf = new Intl.DateTimeFormat('en-US', {
      timeZone,
      timeZoneName: 'shortOffset',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
    const parts = dtf.formatToParts(new Date());
    const offset = parts.find((part) => part.type === 'timeZoneName')?.value;
    return offset ? offset.replace('GMT', 'UTC') : '';
  } catch {
    return '';
  }
}

function scoreOption(query: string, option: TimeZoneOption) {
  if (!query) return option.priority;

  let score = 0;
  for (const keyword of option.keywords) {
    if (keyword === query) score = Math.max(score, 1000);
    else if (keyword.startsWith(query)) score = Math.max(score, 800);
    else if (keyword.includes(query)) score = Math.max(score, 600);
    else if (query.includes(keyword) && keyword.length >= 3) score = Math.max(score, 450);
  }

  return score + option.priority;
}

function diceCoefficient(left: string, right: string) {
  if (!left || !right) return 0;
  if (left === right) return 1;
  if (left.length < 2 || right.length < 2) return 0;

  const pairs = new Map<string, number>();
  for (let index = 0; index < left.length - 1; index += 1) {
    const pair = left.slice(index, index + 2);
    pairs.set(pair, (pairs.get(pair) || 0) + 1);
  }

  let intersection = 0;
  for (let index = 0; index < right.length - 1; index += 1) {
    const pair = right.slice(index, index + 2);
    const count = pairs.get(pair) || 0;
    if (count > 0) {
      pairs.set(pair, count - 1);
      intersection += 1;
    }
  }

  return (2 * intersection) / (left.length + right.length - 2);
}

export function buildTimeZoneOptions(): TimeZoneOption[] {
  return TIME_ZONE_CITIES.map((item) => {
    const offset = getUtcOffsetLabel(item.timeZone);
    return {
      value: item.timeZone,
      label:
        item.timeZone === 'UTC'
          ? `UTC${offset ? ` (${offset})` : ''}`
          : `${item.city}, ${item.region}${offset ? ` (${offset})` : ''}`,
      keywords: [item.city, item.region, item.timeZone, ...(item.aliases || [])].map(normalize),
      priority: item.priority ?? 50,
    };
  });
}

export function searchTimeZoneOptions(query: string, options: TimeZoneOption[], limit = 12) {
  const normalizedQuery = normalize(query);

  if (!normalizedQuery) {
    return {
      options: options
        .slice()
        .sort(
          (left, right) =>
            right.priority - left.priority || left.label.localeCompare(right.label),
        )
        .slice(0, limit),
      fallbackUsed: false,
    };
  }

  const exactMatches = options
    .map((option) => ({ option, score: scoreOption(normalizedQuery, option) }))
    .filter((entry) => entry.score > 0)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.option.priority - left.option.priority ||
        left.option.label.localeCompare(right.option.label),
    )
    .slice(0, limit)
    .map((entry) => entry.option);

  if (exactMatches.length > 0) {
    return { options: exactMatches, fallbackUsed: false };
  }

  const fuzzyMatches = options
    .map((option) => ({
      option,
      score: Math.max(...option.keywords.map((keyword) => diceCoefficient(normalizedQuery, keyword))),
    }))
    .filter((entry) => entry.score >= 0.22)
    .sort(
      (left, right) =>
        right.score - left.score ||
        right.option.priority - left.option.priority ||
        left.option.label.localeCompare(right.option.label),
    )
    .slice(0, Math.min(limit, 6))
    .map((entry) => entry.option);

  return {
    options: fuzzyMatches,
    fallbackUsed: true,
  };
}
