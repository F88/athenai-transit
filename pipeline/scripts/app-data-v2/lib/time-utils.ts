/**
 * Time conversion utilities shared by v2 pipeline builders.
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
