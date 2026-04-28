/**
 * Build service groups from calendar data.
 *
 * Groups GTFS services by their day-of-week pattern (the `d` array in
 * CalendarServiceJson), assigns a short key to each group, and returns
 * them sorted by priority (weekday → Saturday → Sunday → weekend → every day → others).
 *
 * This is the mandatory section of InsightsBundle — every source that
 * has a DataBundle can produce serviceGroups.
 */

import type {
  CalendarExceptionJson,
  CalendarJson,
  CalendarServiceJson,
} from '../../../../../src/types/data/transit-json';
import type { ServiceGroupEntry } from '../../../../../src/types/data/transit-v2-json';
import type { TimetableGroupV2Json } from '../../../../../src/types/data/transit-v2-json';
import { parseGtfsDate } from '../../gtfs-date-utils';

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
 * Each calendar service is assigned to exactly one group based on its
 * day-of-week pattern (`d` array). Groups are sorted by priority
 * (weekday first).
 *
 * Conservative `calendar_dates` support:
 * - Services defined in `calendar.services` are always grouped by `d`.
 * - `calendar_dates`-only services are added only when needed to resolve
 *   days where active service IDs would otherwise match no group.
 * - For those added services, weekday bits are derived from exception
 *   entries with `t=1` (service added).
 *
 * @param calendar - The `calendar` section from a DataBundle.
 * @param timetable - Optional timetable section, used to restrict
 * calendar_dates-only additions to service IDs that actually appear in
 * the timetable.
 * @returns Sorted array of service groups. Empty array if no services.
 */
export function buildServiceGroups(
  calendar: CalendarJson,
  timetable?: Record<string, TimetableGroupV2Json[]>,
): ServiceGroupEntry[] {
  const services = calendar.services;

  // Group calendar.services by their day-of-week pattern string.
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

  if (timetable) {
    const currentGroups = buildGroupsFromPatternMap(patternMap);
    const exceptionOnlyServiceIds = collectNeededExceptionOnlyServiceIds(
      calendar,
      timetable,
      services,
      currentGroups,
    );

    if (exceptionOnlyServiceIds.size > 0) {
      const bitsByServiceId = deriveExceptionWeekdayBits(
        calendar.exceptions,
        exceptionOnlyServiceIds,
      );
      for (const [serviceId, bits] of bitsByServiceId) {
        const patternKey = bits.join(',');
        const existing = patternMap.get(patternKey);
        if (existing) {
          existing.push(serviceId);
        } else {
          patternMap.set(patternKey, [serviceId]);
        }
      }
    }
  }

  return buildGroupsFromPatternMap(patternMap);
}

/**
 * Find all service IDs that are active on at least one occurrence of the
 * given weekday within the calendar date range.
 *
 * Weekly calendar bits and calendar_dates exceptions are both considered.
 * The result is the union across every matching weekday date.
 *
 * @param calendar - The `calendar` section from a DataBundle.
 * @param weekdayIndex - Monday-first weekday index (0=Mon, ..., 6=Sun).
 * @returns Service IDs active on at least one matching weekday.
 */
export function findServicesActiveOnWeekday(
  calendar: CalendarJson,
  weekdayIndex: number,
): Set<string> {
  const range = getCalendarDateRange(calendar);
  if (!range) {
    return new Set();
  }

  const exceptionsByServiceId = buildExceptionMap(calendar.exceptions);
  const activeIds = new Set<string>();

  for (let date = range.min; date <= range.max; date = addUtcDays(date, 1)) {
    if (getMondayFirstDayIndex(date) !== weekdayIndex) {
      continue;
    }

    const activeOnDate = computeActiveServiceIds(date, calendar.services, exceptionsByServiceId);
    for (const serviceId of activeOnDate) {
      activeIds.add(serviceId);
    }
  }

  return activeIds;
}

function buildGroupsFromPatternMap(patternMap: Map<string, string[]>): ServiceGroupEntry[] {
  if (patternMap.size === 0) {
    return [];
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
    // Both unknown: code-unit comparison for deterministic output
    // (avoid localeCompare which can vary across environments)
    if (a.key < b.key) {
      return -1;
    }
    if (a.key > b.key) {
      return 1;
    }
    return 0;
  });

  return groups;
}

function collectNeededExceptionOnlyServiceIds(
  calendar: CalendarJson,
  timetable: Record<string, TimetableGroupV2Json[]>,
  services: CalendarServiceJson[],
  currentGroups: ServiceGroupEntry[],
): Set<string> {
  const range = getCalendarDateRange(calendar);
  if (!range) {
    return new Set();
  }

  const weeklyServiceIds = new Set(services.map((s) => s.i));
  const timetableServiceIds = collectTimetableServiceIds(timetable);
  const exceptionsByServiceId = buildExceptionMap(calendar.exceptions);
  const needed = new Set<string>();

  for (let date = range.min; date <= range.max; date = addUtcDays(date, 1)) {
    const activeIds = computeActiveServiceIds(date, services, exceptionsByServiceId);
    if (activeIds.size === 0) {
      continue;
    }
    if (selectServiceGroupKey(currentGroups, activeIds)) {
      continue;
    }
    for (const serviceId of activeIds) {
      if (!weeklyServiceIds.has(serviceId) && timetableServiceIds.has(serviceId)) {
        needed.add(serviceId);
      }
    }
  }

  return needed;
}

function collectTimetableServiceIds(
  timetable: Record<string, TimetableGroupV2Json[]>,
): Set<string> {
  const serviceIds = new Set<string>();
  for (const groups of Object.values(timetable)) {
    for (const group of groups) {
      for (const sid of Object.keys(group.d)) {
        serviceIds.add(sid);
      }
    }
  }
  return serviceIds;
}

function deriveExceptionWeekdayBits(
  exceptions: CalendarExceptionJson[],
  serviceIds: Set<string>,
): Map<string, number[]> {
  const bitsByServiceId = new Map<string, number[]>();
  for (const ex of exceptions) {
    if (ex.t !== 1 || !serviceIds.has(ex.i)) {
      continue;
    }
    const date = parseGtfsDate(ex.d);
    if (!date) {
      continue;
    }
    const dayIndex = getMondayFirstDayIndex(date);
    const bits = bitsByServiceId.get(ex.i) ?? [0, 0, 0, 0, 0, 0, 0];
    bits[dayIndex] = 1;
    bitsByServiceId.set(ex.i, bits);
  }
  return bitsByServiceId;
}

function getCalendarDateRange(calendar: CalendarJson): { min: Date; max: Date } | null {
  const parsedDates: Date[] = [];
  for (const service of calendar.services) {
    const start = parseGtfsDate(service.s);
    const end = parseGtfsDate(service.e);
    if (start) {
      parsedDates.push(start);
    }
    if (end) {
      parsedDates.push(end);
    }
  }
  for (const ex of calendar.exceptions) {
    const date = parseGtfsDate(ex.d);
    if (date) {
      parsedDates.push(date);
    }
  }

  if (parsedDates.length === 0) {
    return null;
  }

  let min = parsedDates[0];
  let max = parsedDates[0];
  for (const date of parsedDates) {
    if (date < min) {
      min = date;
    }
    if (date > max) {
      max = date;
    }
  }
  return { min, max };
}

function buildExceptionMap(
  exceptions: CalendarExceptionJson[],
): Map<string, CalendarExceptionJson[]> {
  const map = new Map<string, CalendarExceptionJson[]>();
  for (const ex of exceptions) {
    const list = map.get(ex.i) ?? [];
    list.push(ex);
    map.set(ex.i, list);
  }
  return map;
}

function computeActiveServiceIds(
  date: Date,
  services: CalendarServiceJson[],
  exceptionsByServiceId: Map<string, CalendarExceptionJson[]>,
): Set<string> {
  const dateKey = formatGtfsDateKey(date);
  const dayIndex = getMondayFirstDayIndex(date);
  const active = new Set<string>();

  for (const service of services) {
    if (dateKey >= service.s && dateKey <= service.e && service.d[dayIndex] === 1) {
      active.add(service.i);
    }
  }

  for (const [serviceId, exceptions] of exceptionsByServiceId) {
    for (const ex of exceptions) {
      if (ex.d !== dateKey) {
        continue;
      }
      if (ex.t === 1) {
        active.add(serviceId);
      } else if (ex.t === 2) {
        active.delete(serviceId);
      }
    }
  }

  return active;
}

function selectServiceGroupKey(
  groups: ServiceGroupEntry[],
  activeServiceIds: Set<string>,
): string | undefined {
  let bestKey: string | undefined;
  let bestOverlap = 0;

  for (const group of groups) {
    let overlap = 0;
    for (const sid of group.serviceIds) {
      if (activeServiceIds.has(sid)) {
        overlap++;
      }
    }
    if (overlap > bestOverlap) {
      bestOverlap = overlap;
      bestKey = group.key;
    }
  }

  return bestKey;
}

function formatGtfsDateKey(date: Date): string {
  const y = String(date.getUTCFullYear());
  const m = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function getMondayFirstDayIndex(date: Date): number {
  const day = date.getUTCDay();
  return day === 0 ? 6 : day - 1;
}

function addUtcDays(date: Date, deltaDays: number): Date {
  const next = new Date(date.getTime());
  next.setUTCDate(next.getUTCDate() + deltaDays);
  return next;
}
