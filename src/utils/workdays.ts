// Client-side working-day helpers for the leave calendar. This mirrors
// server/services/workdays.service.ts — the server remains the authority and
// re-validates every request; this copy only drives what is selectable in the UI.

export const addDays = (dateStr: string, n: number): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const isWeekend = (dateStr: string): boolean => {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

// Easter Sunday (anonymous Gregorian computus)
const easterSunday = (year: number): string => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
};

const holidayCache = new Map<number, Set<string>>();

/** SA public holidays incl. the Sunday→Monday observance rule. */
export const publicHolidays = (year: number): Set<string> => {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const base = [
    `${year}-01-01`,
    `${year}-03-21`,
    addDays(easter, -2), // Good Friday
    addDays(easter, 1),  // Family Day
    `${year}-04-27`,
    `${year}-05-01`,
    `${year}-06-16`,
    `${year}-08-09`,
    `${year}-09-24`,
    `${year}-12-16`,
    `${year}-12-25`,
    `${year}-12-26`
  ];

  const holidays = new Set<string>();
  for (const date of base) {
    holidays.add(date);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) {
      holidays.add(addDays(date, 1));
    }
  }

  holidayCache.set(year, holidays);
  return holidays;
};

export const isPublicHoliday = (dateStr: string): boolean =>
  publicHolidays(parseInt(dateStr.slice(0, 4), 10)).has(dateStr);

export const isWorkingDay = (dateStr: string): boolean =>
  !isWeekend(dateStr) && !isPublicHoliday(dateStr);

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Cells for a Monday-first month grid: leading/trailing days of neighbouring
 * months are included (flagged inMonth: false) so the grid is always full weeks.
 */
export const buildMonthGrid = (year: number, month: number): { date: string; inMonth: boolean }[] => {
  const first = new Date(Date.UTC(year, month, 1));
  const lead = (first.getUTCDay() + 6) % 7; // days shown before the 1st (Mon-first)
  const start = new Date(first);
  start.setUTCDate(1 - lead);

  const cells: { date: string; inMonth: boolean }[] = [];
  const cursor = new Date(start);
  do {
    cells.push({
      date: cursor.toISOString().slice(0, 10),
      inMonth: cursor.getUTCMonth() === month
    });
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  } while (cells.length % 7 !== 0 || cursor.getUTCMonth() === month);
  return cells;
};

/** '2026-07-08T…' → 'just now' / '5m ago' / '3h ago' / '2d ago'. */
export const relativeTime = (iso: string): string => {
  const ms = Date.now() - new Date(iso).getTime();
  if (!Number.isFinite(ms) || ms < 0) return 'just now';
  const minutes = Math.floor(ms / 60_000);
  if (minutes < 1) return 'just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
};
