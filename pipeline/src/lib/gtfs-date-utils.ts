/**
 * GTFS date parsing utility.
 *
 * Shared by pipeline validators and scripts that need to interpret
 * GTFS date strings ("YYYYMMDD" format).
 */

/**
 * Parse a GTFS date string ("YYYYMMDD") into a Date at UTC midnight.
 *
 * Returns `null` for invalid input (non-8-digit strings, invalid
 * month/day combinations). Uses Date round-trip validation to reject
 * overflows (e.g. month 13 silently becomes next year in Date.UTC).
 *
 * @param dateStr - GTFS date string, e.g. "20260322".
 * @returns Date at UTC midnight, or null if invalid.
 */
export function parseGtfsDate(dateStr: string): Date | null {
  if (!/^\d{8}$/.test(dateStr)) {
    return null;
  }
  const year = Number(dateStr.slice(0, 4));
  const month = Number(dateStr.slice(4, 6)) - 1; // 0-based for Date.UTC
  const day = Number(dateStr.slice(6, 8));
  const date = new Date(Date.UTC(year, month, day));
  // Round-trip validation: Date.UTC silently overflows invalid month/day
  // (e.g. month 13 → next year). Reject if the constructed date doesn't
  // match the requested Y-M-D.
  if (date.getUTCFullYear() !== year || date.getUTCMonth() !== month || date.getUTCDate() !== day) {
    return null;
  }
  return date;
}
