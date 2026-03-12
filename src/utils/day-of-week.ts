/**
 * Day-of-week color classification for Japanese calendar conventions.
 *
 * - Monday–Friday: 'weekday' (black)
 * - Saturday: 'saturday' (blue)
 * - Sunday: 'sunday' (red)
 * - National holiday: 'holiday' (red)
 */
import { isJapaneseHoliday } from './japanese-holidays';

/** Day-of-week color category. */
export type DayColorCategory = 'weekday' | 'saturday' | 'sunday' | 'holiday';

/**
 * Classify a date into a day-of-week color category.
 * Japanese national holidays return 'holiday' (displayed in red, same as sunday).
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

/** Japanese day-of-week labels (short). */
const DAY_LABELS = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * Format a date as Japanese date string with day-of-week category.
 *
 * Does not include CSS classes — callers decide how to style each category
 * based on their display context.
 *
 * @param date - The date to format.
 * @returns Object with formatted text and day color category.
 */
export function formatDateWithDay(date: Date): {
  dateText: string;
  dayLabel: string;
  dayColorCategory: DayColorCategory;
} {
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const dayIndex = date.getDay();
  const category = getDayColorCategory(date);

  return {
    dateText: `${date.getFullYear()}年${m}月${d}日`,
    dayLabel: DAY_LABELS[dayIndex],
    dayColorCategory: category,
  };
}
