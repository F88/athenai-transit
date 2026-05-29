/**
 * Utilities for the HTML date/time string formats described in MDN
 * "Using date and time formats in HTML":
 * https://developer.mozilla.org/en-US/docs/Web/HTML/Guides/Date_and_time_formats
 *
 * The formats covered here are used by:
 * - `<input type="date" | "datetime-local" | "month" | "time" | "week">`
 * - `<ins>` / `<del>` `datetime` attribute
 */

/**
 * Convert a Date to an `<input type="datetime-local">` value string.
 *
 * The HTML spec requires the year to be at least 4 digits, so
 * 1-3 digit years are zero-padded. Months, days, hours and minutes
 * are zero-padded to 2 digits. Seconds and milliseconds are omitted
 * because the default `step` of `datetime-local` is minute-precision.
 *
 * @param date - The date to convert.
 * @returns datetime-local value string (`"YYYY-MM-DDTHH:mm"`).
 *
 * @example
 * ```ts
 * toDatetimeLocalInputValue(new Date("2026-03-04T09:05:00"))
 * // => "2026-03-04T09:05"
 * ```
 */
export function toDatetimeLocalInputValue(date: Date): string {
  const yyyy = String(date.getFullYear()).padStart(4, '0');
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  const hh = String(date.getHours()).padStart(2, '0');
  const min = String(date.getMinutes()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}T${hh}:${min}`;
}
