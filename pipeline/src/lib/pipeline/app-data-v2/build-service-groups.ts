/**
 * Build service groups from calendar data.
 *
 * Groups GTFS services by their day-of-week pattern (the `d` array in
 * CalendarServiceJson), assigns a short key to each group, and returns
 * them sorted by priority (weekday → Saturday → Sunday → others).
 *
 * This is the mandatory section of InsightsBundle — every source that
 * has a DataBundle can produce serviceGroups.
 */

import type { CalendarJson } from '../../../../../src/types/data/transit-json';
import type { ServiceGroupEntry } from '../../../../../src/types/data/transit-v2-json';

// ---------------------------------------------------------------------------
// Well-known day-of-week patterns → key mapping
// ---------------------------------------------------------------------------

/** Map of stringified `d` pattern to human-readable key. */
const KNOWN_PATTERNS: ReadonlyMap<string, string> = new Map([
  ['1,1,1,1,1,0,0', 'wd'], // weekday
  ['0,0,0,0,0,1,0', 'sa'], // saturday
  ['0,0,0,0,0,0,1', 'su'], // sunday
  ['0,0,0,0,0,1,1', 'wk'], // weekend
  ['1,1,1,1,1,1,1', 'all'], // every day
]);

/**
 * Priority order for sorting service groups.
 * Lower index = higher priority. Unknown keys get appended last.
 */
const KEY_PRIORITY: readonly string[] = ['wd', 'sa', 'su', 'wk', 'all'];

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Build {@link ServiceGroupEntry} array from calendar data.
 *
 * Each service is assigned to exactly one group based on its day-of-week
 * pattern (`d` array). Groups are sorted by priority (weekday first).
 *
 * `calendar_dates` exceptions do NOT affect grouping — they are handled
 * at runtime by the app's service matching logic.
 *
 * @param calendar - The `calendar` section from a DataBundle.
 * @returns Sorted array of service groups. Empty array if no services.
 */
export function buildServiceGroups(calendar: CalendarJson): ServiceGroupEntry[] {
  const services = calendar.services;
  if (services.length === 0) {
    return [];
  }

  // Group service_ids by their day-of-week pattern string
  const patternMap = new Map<string, string[]>();
  for (const service of services) {
    const patternKey = service.d.join(',');
    const existing = patternMap.get(patternKey);
    if (existing) {
      existing.push(service.i);
    } else {
      patternMap.set(patternKey, [service.i]);
    }
  }

  // Convert to ServiceGroupEntry[]
  const groups: ServiceGroupEntry[] = [];
  for (const [pattern, serviceIds] of patternMap) {
    const key = KNOWN_PATTERNS.get(pattern) ?? `d${pattern.replace(/,/g, '')}`;
    groups.push({ key, serviceIds });
  }

  // Sort by priority: known keys first (in KEY_PRIORITY order), then unknown alphabetically
  groups.sort((a, b) => {
    const ai = KEY_PRIORITY.indexOf(a.key);
    const bi = KEY_PRIORITY.indexOf(b.key);
    // Both known: sort by priority index
    if (ai !== -1 && bi !== -1) {
      return ai - bi;
    }
    // Only one known: known first
    if (ai !== -1) {
      return -1;
    }
    if (bi !== -1) {
      return 1;
    }
    // Both unknown: alphabetical
    return a.key.localeCompare(b.key);
  });

  return groups;
}
