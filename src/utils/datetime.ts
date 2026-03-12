import { type DayColorCategory, getDayColorCategory } from './day-of-week';

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * Format a Date as a compact Japanese datetime string.
 *
 * @param date - The date to format.
 * @returns Formatted string like `"3 月 4 日 (水) 09:15"`.
 *
 * @example
 * ```ts
 * formatDateTimeJaJp(new Date("2026-03-04T09:15:00"))
 * // => "3 月 4 日 (水) 09:15"
 * ```
 */
export function formatDateTimeJaJp(date: Date): string {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayName = DAY_NAMES[date.getDay()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${month} 月 ${day} 日 (${dayName}) ${hours}:${minutes}`;
}

/**
 * Split a Japanese datetime string into parts with day-of-week color info.
 *
 * Useful for rendering the day-of-week label in a different color (e.g.
 * red for Sunday/holidays, blue for Saturday).
 *
 * @param date - The date to format.
 * @returns Object with prefix, dayLabel, suffix, and dayColorCategory.
 *
 * @example
 * ```ts
 * formatDateTimeJaJpParts(new Date("2026-03-04T09:15:00"))
 * // => { prefix: "3 月 4 日 ", dayLabel: "(水)", suffix: " 09:15",
 * //      dayColorCategory: "weekday" }
 * ```
 */
export function formatDateTimeJaJpParts(date: Date): {
  prefix: string;
  dayLabel: string;
  suffix: string;
  dayColorCategory: DayColorCategory;
} {
  const month = date.getMonth() + 1;
  const day = date.getDate();
  const dayName = DAY_NAMES[date.getDay()];
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  const category = getDayColorCategory(date);

  return {
    prefix: `${month} 月 ${day} 日 `,
    dayLabel: `(${dayName})`,
    suffix: ` ${hours}:${minutes}`,
    dayColorCategory: category,
  };
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
