import { type DayColorCategory, getDayColorCategory } from './day-of-week';

/**
 * Get the date in a specific timezone as a local Date object.
 *
 * Needed because getDayColorCategory uses date.getDay() which is
 * local-timezone-dependent. This converts via Intl to ensure the
 * weekday/holiday check matches the displayed timezone.
 */
function dateInTimeZone(date: Date, timeZone: string): Date {
  const parts = new Intl.DateTimeFormat('en', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone,
  }).formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '';
  return new Date(Number(get('year')), Number(get('month')) - 1, Number(get('day')));
}

/**
 * Options for {@link formatDateParts}.
 */
export interface FormatDatePartsOptions {
  /** Include year in date text. @default false */
  showYear?: boolean;
  /** Include time (HH:mm) in the result. @default false */
  showTime?: boolean;
}

/**
 * Result of {@link formatDateParts}.
 */
export interface FormattedDateParts {
  /** Locale-formatted date string (e.g. "3月4日" or "2026年3月4日"). */
  dateText: string;
  /** Locale-formatted weekday label (e.g. "水", "Wed"). */
  dayLabel: string;
  /** Time string in HH:mm format. Present only when `showTime` is true. */
  time?: string;
  /** Day-of-week color category for styling. */
  dayColorCategory: DayColorCategory;
}

/**
 * Format a date into locale-aware parts with day-of-week color info.
 *
 * Uses `Intl.DateTimeFormat` for locale-aware date and weekday formatting.
 * The weekday is extracted separately for color styling (e.g. Saturday=blue,
 * Sunday/holiday=red).
 *
 * @param date - The date to format.
 * @param lang - BCP 47 locale (e.g. `"ja"`, `"en"`, `"ko"`).
 * @param timeZone - IANA timezone (e.g. `"Asia/Tokyo"`).
 * @param options - Display options (showYear, showTime).
 * @returns Formatted parts with day color category.
 *
 * @example
 * ```ts
 * formatDateParts(date, 'ja', 'Asia/Tokyo', { showTime: true })
 * // => { dateText: "3月4日", dayLabel: "水", time: "09:15", ... }
 *
 * formatDateParts(date, 'en', 'Asia/Tokyo', { showYear: true })
 * // => { dateText: "Mar 4, 2026", dayLabel: "Wed", ... }
 * ```
 */
export function formatDateParts(
  date: Date,
  lang: string,
  timeZone: string,
  options: FormatDatePartsOptions = {},
): FormattedDateParts {
  const { showYear = false, showTime = false } = options;

  const dateOpts: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    timeZone,
    ...(showYear ? { year: 'numeric' } : {}),
  };
  const dateFmt = new Intl.DateTimeFormat(lang, dateOpts);
  const weekdayFmt = new Intl.DateTimeFormat(lang, { weekday: 'short', timeZone });

  const result: FormattedDateParts = {
    dateText: dateFmt.format(date),
    dayLabel: weekdayFmt.format(date),
    dayColorCategory: getDayColorCategory(dateInTimeZone(date, timeZone)),
  };

  if (showTime) {
    const timeFmt = new Intl.DateTimeFormat(lang, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZone,
    });
    result.time = timeFmt.format(date);
  }

  return result;
}

/**
 * Convert a Date to an `<input type="datetime-local">` value string.
 *
 * @param date - The date to convert.
 * @returns ISO-like local datetime string (`"YYYY-MM-DDTHH:mm"`).
 *
 * @example
 * ```ts
 * toDatetimeLocalValue(new Date("2026-03-04T09:05:00"))
 * // => "2026-03-04T09:05"
 * ```
 */
export function toDatetimeLocalValue(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  const h = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${y}-${m}-${d}T${h}:${min}`;
}
