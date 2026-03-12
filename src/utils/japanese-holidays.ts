/**
 * Japanese holiday detection using @holiday-jp/holiday_jp.
 *
 * Wraps the holiday_jp library to provide a simple API for checking
 * whether a given date is a Japanese national holiday.
 */
import * as holiday_jp from '@holiday-jp/holiday_jp';

/**
 * Check if a date is a Japanese national holiday.
 * @param date - The date to check.
 * @returns `true` if the date is a national holiday.
 */
export function isJapaneseHoliday(date: Date): boolean {
  return holiday_jp.isHoliday(date);
}

/**
 * Get the Japanese holiday name for a date, if it is a holiday.
 * @param date - The date to check.
 * @returns The holiday name in Japanese, or `undefined` if not a holiday.
 */
export function getJapaneseHolidayName(date: Date): string | undefined {
  // holiday_jp has no single-date lookup API, so we use between(date, date).
  // A single date always returns 0 or 1 result (Japanese law does not
  // define multiple holidays on the same date).
  const holidays = holiday_jp.between(date, date);
  if (holidays.length === 0) {
    return undefined;
  }
  return holidays[0].name;
}
