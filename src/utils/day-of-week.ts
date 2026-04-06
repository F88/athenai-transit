/**
 * Day-of-week color classification for calendar display.
 *
 * - Monday–Friday: 'weekday' (default text color)
 * - Saturday: 'saturday' (blue)
 * - Sunday: 'sunday' (red)
 * - National holiday: 'holiday' (red)
 *
 * Holiday detection currently uses Japanese holidays only.
 * See Issue #100 for future locale-dependent detection.
 */
import { isJapaneseHoliday } from './japanese-holidays';

/** Day-of-week color category. */
export type DayColorCategory = 'weekday' | 'saturday' | 'sunday' | 'holiday';

/**
 * Classify a date into a day-of-week color category.
 *
 * @param date - The date to classify.
 * @returns The day color category.
 */
export function getDayColorCategory(date: Date): DayColorCategory {
  if (isJapaneseHoliday(date)) {
    return 'holiday';
  }
  const day = date.getDay();
  if (day === 0) {
    return 'sunday';
  }
  if (day === 6) {
    return 'saturday';
  }
  return 'weekday';
}

/** CSS color class names for each day color category. */
export const DAY_COLOR_CATEGORY_CLASSES: Record<DayColorCategory, string> = {
  weekday: 'text-foreground',
  saturday: 'text-blue-600 dark:text-blue-400',
  sunday: 'text-red-600 dark:text-red-400',
  holiday: 'text-red-600 dark:text-red-400',
};
