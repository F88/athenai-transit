const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;

/**
 * Format the time difference between a departure and now as a
 * human-readable Japanese relative string.
 *
 * @param departureTime - Scheduled departure time.
 * @param now - Current reference time.
 * @returns `"まもなく"` when <= 0 min, otherwise `"あとN分"`.
 *
 * @example
 * ```ts
 * const now = new Date("2026-03-04T09:00:00");
 * const dep = new Date("2026-03-04T09:05:00");
 * formatRelativeTime(dep, now); // => "あと5分"
 * ```
 */
export function formatRelativeTime(departureTime: Date, now: Date): string {
  const diffMs = departureTime.getTime() - now.getTime();
  const diffMin = Math.floor(diffMs / MILLISECONDS_PER_MINUTE);
  if (diffMin <= 0) {
    return 'まもなく';
  }
  return `あと${diffMin}分`;
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
