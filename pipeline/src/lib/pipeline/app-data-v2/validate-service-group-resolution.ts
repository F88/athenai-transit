/**
 * Cross-bundle validation for service-group resolvability.
 *
 * Ensures that for every date with at least one active service ID,
 * InsightsBundle.serviceGroups can resolve at least one matching group.
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  CalendarExceptionJson,
  CalendarServiceJson,
} from '../../../../../src/types/data/transit-json';
import type {
  DataBundle,
  InsightsBundle,
  ServiceGroupEntry,
} from '../../../../../src/types/data/transit-v2-json';
import { parseGtfsDate } from '../../gtfs-date-utils';
import type { ValidationIssue } from './validate-shapes';

export interface ServiceGroupResolutionValidationResult {
  issues: ValidationIssue[];
  checkedDays: number;
  unresolvedDays: number;
}

/**
 * Validate cross-bundle service-group resolvability for one source.
 *
 * @param prefix - Source prefix.
 * @param baseDir - Base output directory containing data.json and insights.json.
 * @returns Validation result and counters.
 */
export function validateServiceGroupResolution(
  prefix: string,
  baseDir: string,
): ServiceGroupResolutionValidationResult {
  const dataPath = join(baseDir, prefix, 'data.json');
  const insightsPath = join(baseDir, prefix, 'insights.json');

  if (!existsSync(dataPath) || !existsSync(insightsPath)) {
    return { issues: [], checkedDays: 0, unresolvedDays: 0 };
  }

  let data: DataBundle;
  let insights: InsightsBundle;
  try {
    data = JSON.parse(readFileSync(dataPath, 'utf-8')) as DataBundle;
    insights = JSON.parse(readFileSync(insightsPath, 'utf-8')) as InsightsBundle;
  } catch {
    // Structural parsers already report JSON errors.
    return { issues: [], checkedDays: 0, unresolvedDays: 0 };
  }

  if (data.kind !== 'data' || insights.kind !== 'insights') {
    return { issues: [], checkedDays: 0, unresolvedDays: 0 };
  }

  const range = getCalendarDateRange(data.calendar.data.services, data.calendar.data.exceptions);
  if (!range) {
    return { issues: [], checkedDays: 0, unresolvedDays: 0 };
  }

  const groups = insights.serviceGroups.data;
  const exceptionMap = buildExceptionMap(data.calendar.data.exceptions);

  let checkedDays = 0;
  let unresolvedDays = 0;
  const samples: string[] = [];

  for (let date = range.min; date <= range.max; date = addUtcDays(date, 1)) {
    const active = computeActiveServiceIds(date, data.calendar.data.services, exceptionMap);
    if (active.size === 0) {
      continue;
    }

    checkedDays++;
    const groupKey = selectServiceGroupKey(groups, active);
    if (!groupKey) {
      unresolvedDays++;
      if (samples.length < 3) {
        samples.push(formatGtfsDateKey(date));
      }
    }
  }

  const issues: ValidationIssue[] = [];
  if (unresolvedDays > 0) {
    const sampleText = samples.length > 0 ? ` (sample dates: ${samples.join(', ')})` : '';
    issues.push({
      prefix,
      level: 'error',
      category: 'integrity',
      message: `service-group resolution failed on ${unresolvedDays} active day(s)${sampleText}`,
    });
  }

  return { issues, checkedDays, unresolvedDays };
}

function getCalendarDateRange(
  services: CalendarServiceJson[],
  exceptions: CalendarExceptionJson[],
): { min: Date; max: Date } | null {
  const parsedDates: Date[] = [];

  for (const service of services) {
    const start = parseGtfsDate(service.s);
    const end = parseGtfsDate(service.e);
    if (start) {
      parsedDates.push(start);
    }
    if (end) {
      parsedDates.push(end);
    }
  }

  for (const ex of exceptions) {
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
  const key = formatGtfsDateKey(date);
  const dayIndex = getMondayFirstDayIndex(date);
  const active = new Set<string>();

  for (const service of services) {
    if (key >= service.s && key <= service.e && service.d[dayIndex] === 1) {
      active.add(service.i);
    }
  }

  for (const [serviceId, exceptions] of exceptionsByServiceId) {
    for (const ex of exceptions) {
      if (ex.d !== key) {
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
    for (const serviceId of group.serviceIds) {
      if (activeServiceIds.has(serviceId)) {
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
