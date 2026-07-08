// Working-day arithmetic for leave management and SLA deadline tracking.
// All "today/tomorrow" decisions are made in SAST (Africa/Johannesburg, UTC+2,
// no daylight saving) — never in server-local or UTC time, otherwise the
// midnight cut-off for activation/revocation shifts by two hours.

const SAST_OFFSET_MS = 2 * 60 * 60 * 1000;

/** Current date in SAST as 'YYYY-MM-DD'. */
export const sastToday = (): string =>
  new Date(Date.now() + SAST_OFFSET_MS).toISOString().slice(0, 10);

/** ISO timestamp → its calendar date in SAST ('YYYY-MM-DD'); null when unparseable. */
export const sastDateOf = (iso: string): string | null => {
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return null;
  return new Date(t + SAST_OFFSET_MS).toISOString().slice(0, 10);
};

/** dateStr ± n days, as 'YYYY-MM-DD'. */
export const addDays = (dateStr: string, n: number): string => {
  const d = new Date(`${dateStr}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
};

export const isWeekend = (dateStr: string): boolean => {
  const day = new Date(`${dateStr}T00:00:00Z`).getUTCDay();
  return day === 0 || day === 6;
};

// Easter Sunday (anonymous Gregorian computus) — Good Friday and Family Day
// move with it, so the holiday list cannot be a fixed table.
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

/**
 * South African public holidays (Public Holidays Act 36 of 1994), including the
 * rule that a holiday falling on a Sunday is observed the following Monday.
 * Once-off proclaimed holidays (e.g. special election days) can be added via the
 * EXTRA_PUBLIC_HOLIDAYS env var as a comma-separated list of 'YYYY-MM-DD' dates.
 */
export const publicHolidays = (year: number): Set<string> => {
  const cached = holidayCache.get(year);
  if (cached) return cached;

  const easter = easterSunday(year);
  const base = [
    `${year}-01-01`, // New Year's Day
    `${year}-03-21`, // Human Rights Day
    addDays(easter, -2), // Good Friday
    addDays(easter, 1), // Family Day
    `${year}-04-27`, // Freedom Day
    `${year}-05-01`, // Workers' Day
    `${year}-06-16`, // Youth Day
    `${year}-08-09`, // National Women's Day
    `${year}-09-24`, // Heritage Day
    `${year}-12-16`, // Day of Reconciliation
    `${year}-12-25`, // Christmas Day
    `${year}-12-26`  // Day of Goodwill
  ];

  const holidays = new Set<string>();
  for (const date of base) {
    holidays.add(date);
    if (new Date(`${date}T00:00:00Z`).getUTCDay() === 0) {
      holidays.add(addDays(date, 1)); // observed Monday
    }
  }

  for (const extra of (process.env.EXTRA_PUBLIC_HOLIDAYS || '').split(',')) {
    const trimmed = extra.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed) && trimmed.startsWith(String(year))) {
      holidays.add(trimmed);
    }
  }

  holidayCache.set(year, holidays);
  return holidays;
};

export const isPublicHoliday = (dateStr: string): boolean =>
  publicHolidays(parseInt(dateStr.slice(0, 4), 10)).has(dateStr);

/** Leave may only be taken (and only consumes balance) on working days. */
export const isWorkingDay = (dateStr: string): boolean =>
  !isWeekend(dateStr) && !isPublicHoliday(dateStr);

/** dateStr advanced by n working days (the "within N working days" policy deadlines). */
export const addWorkingDays = (dateStr: string, n: number): string => {
  let d = dateStr;
  let remaining = n;
  while (remaining > 0) {
    d = addDays(d, 1);
    if (isWorkingDay(d)) remaining--;
  }
  return d;
};

/** Working days in (from, to] — 0 on the report day itself, and 0 when to ≤ from. */
export const workingDaysBetween = (from: string, to: string): number => {
  let count = 0;
  let d = from;
  while (d < to) {
    d = addDays(d, 1);
    if (isWorkingDay(d)) count++;
  }
  return count;
};
