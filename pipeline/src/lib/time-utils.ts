/**
 * Time conversion utilities shared by pipeline builders (v1 and v2).
 */

/**
 * Convert a time string to minutes from midnight.
 *
 * Accepts both GTFS format ("HH:MM:SS") and ODPT format ("HH:MM").
 * Supports hours >= 24 for overnight trips (e.g. "25:01:00" → 1501).
 *
 * @param time - Time string in "HH:MM:SS" or "HH:MM" format.
 * @returns Minutes from midnight.
 */
export function timeToMinutes(time: string): number {
  const parts = time.split(':');
  return parseInt(parts[0], 10) * 60 + parseInt(parts[1], 10);
}

/**
 * Convert ODPT overnight times by adding 24 hours after a time reversal.
 *
 * ODPT API Spec v4.15 Section 3.3.6:
 * > 日付を超える場合、odpt:arrivalTime, odpt:departureTimeは
 * > 00:00〜23:59 までの時刻表現となる。
 * > 日付超えを判断するには、前駅からの時刻（時）変化で
 * > 23 -> 00 となった場合に日付を超えたとクライアント側で判定する必要がある。
 *
 * The `stationTimetableObject` array is chronologically ordered
 * within a single calendar day. This function detects the point where
 * time reverses (e.g. 23:50 → 00:00) and adds 24 hours to ALL
 * subsequent times unconditionally — once the reversal is detected,
 * every remaining entry belongs to the next calendar day.
 *
 * No hour threshold is applied: the adjustment is `original_hour + 24`,
 * regardless of the hour value. This correctly handles 終夜運転
 * (all-night service) where departures continue past 05:00.
 * The reversal is detected at most once — subsequent reversals within
 * the same array do not add another +24h (no +48h accumulation).
 *
 * Empty or invalid entries (e.g. `''` from missing departure/arrival)
 * are returned unchanged and do not affect reversal detection.
 *
 * @param times - Array of ODPT time strings ("HH:MM") in chronological order.
 *   The input array is NOT modified.
 * @returns New array with overnight times adjusted (e.g. "00:10" → "24:10").
 *   Times before the reversal point are returned unchanged.
 */
export function adjustOdptOvernightTimes(times: string[]): string[] {
  let isOvernight = false;
  let lastValidHour: number | null = null;

  return times.map((time) => {
    const parts = time.split(':');
    // Skip invalid or empty entries: they should neither trigger nor block
    // overnight detection, and are returned unchanged.
    if (parts.length < 2 || parts[0].trim() === '') {
      return time;
    }

    const hour = parseInt(parts[0], 10);
    if (Number.isNaN(hour)) {
      return time;
    }

    if (!isOvernight && lastValidHour !== null) {
      // Detect reversal: previous valid hour >= 23, current hour < 23
      if (lastValidHour >= 23 && hour < lastValidHour) {
        isOvernight = true;
      }
    }

    lastValidHour = hour;

    if (isOvernight) {
      return `${hour + 24}:${parts.slice(1).join(':')}`;
    }

    return time;
  });
}
