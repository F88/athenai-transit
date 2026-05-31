const MILLISECONDS_PER_MINUTE = 60 * 1000;
const MINUTES_PER_HOUR = 60;

export type RelativeTimeParts =
  | { kind: 'pastWithinMinute'; seconds: number }
  | { kind: 'futureWithinMinute'; seconds: number }
  | {
      kind: 'minutes';
      tense: 'past' | 'future';
      minutes: number;
      showPrefix: boolean;
    };

/**
 * Build locale-agnostic relative-time parts while keeping sub-minute seconds.
 *
 * - `pastWithinMinute`: 1 to 59 seconds after the target time
 * - `futureWithinMinute`: target time through 59 seconds before departure
 * - `minutes`: minute-based past/future display for all other cases
 */
export function getRelativeTimeParts(
  targetTime: Date,
  now: Date,
  options: { hidePrefix?: boolean } = {},
): RelativeTimeParts {
  const { hidePrefix = false } = options;
  const diffMs = targetTime.getTime() - now.getTime();

  if (diffMs < 0) {
    const seconds = Math.floor(Math.abs(diffMs) / 1000);
    if (seconds < 60) {
      return { kind: 'pastWithinMinute', seconds };
    }

    return {
      kind: 'minutes',
      tense: 'past',
      minutes: Math.floor(Math.abs(diffMs) / MILLISECONDS_PER_MINUTE),
      showPrefix: false,
    };
  }

  if (diffMs < MILLISECONDS_PER_MINUTE) {
    return { kind: 'futureWithinMinute', seconds: Math.floor(diffMs / 1000) };
  }

  return {
    kind: 'minutes',
    tense: 'future',
    minutes: Math.floor(diffMs / MILLISECONDS_PER_MINUTE),
    showPrefix: !hidePrefix,
  };
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
