const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;

export type RelativeTimeDisplay =
  | { kind: 'past'; minutes: number }
  | { kind: 'future'; minutes: number };

/**
 * Classify a wall-clock difference into signed minute buckets for the UI.
 *
 * - any past time: negative minutes
 * - present or future: positive minutes, floored to whole minutes
 */
export function classifyRelativeTime(targetTime: Date, now: Date): RelativeTimeDisplay {
  const diffMs = targetTime.getTime() - now.getTime();

  if (diffMs < 0) {
    return { kind: 'past', minutes: Math.ceil(Math.abs(diffMs) / MILLISECONDS_PER_MINUTE) };
  }

  return { kind: 'future', minutes: Math.floor(diffMs / MILLISECONDS_PER_MINUTE) };
}

/**
 * Format a Date as a short absolute time string (`"H:MM"`).
 *
 * @param date - The date to format.
 * @returns Time string like `"9:05"` or `"14:30"`.
 *
 * @example
 * ```ts
 * formatAbsoluteTime(new Date("2026-03-04T14:30:00"))
 * // => "14:30"
 * ```
 */
export function formatAbsoluteTime(date: Date): string {
  return `${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`;
}

/**
 * Group departure minutes (from midnight) by hour for timetable display.
 *
 * Minutes >= 1440 (24:00+) are grouped under hour 24, 25, etc.
 *
 * @param departures - Sorted array of minutes from midnight.
 * @returns Map from hour to array of minute-within-hour values.
 *
 * @example
 * ```ts
 * groupByHour([540, 545, 600, 605])
 * // => Map { 9 => [0, 5], 10 => [0, 5] }
 * ```
 */
export function groupByHour(departures: number[]): Map<number, number[]> {
  const map = new Map<number, number[]>();
  for (const m of departures) {
    const hour = Math.floor(m / MINUTES_PER_HOUR);
    const min = m % MINUTES_PER_HOUR;
    const list = map.get(hour);
    if (list) {
      list.push(min);
    } else {
      map.set(hour, [min]);
    }
  }
  return map;
}
