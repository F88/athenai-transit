/**
 * Validate a v2 DataBundle file.
 *
 * Pure validation logic — no CLI, no console output.
 * Used by the validate-v2-bundles script.
 *
 * Checks:
 * - File existence
 * - JSON parse
 * - Bundle structure (bundle_version, kind)
 * - Required sections exist with correct version
 * - Non-empty stops, routes, calendar services
 * - Calendar expiration (warn if earliest end_date <= 30 days)
 * - Referential integrity: timetable → tripPatterns → routes/stops
 * - Timetable d/a array length consistency
 * - Stop coordinate range (lat: -90..90, lon: -180..180)
 *
 * @module
 */

import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

import type { DataBundle } from '../../../../../src/types/data/transit-v2-json';
import { parseGtfsDate } from '../../gtfs-date-utils';
import type { ValidationIssue } from './validate-shapes';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CalendarServiceMeta {
  serviceId: string;
  /** GTFS end_date string "YYYYMMDD". */
  endDate: string;
}

export interface DataValidationResult {
  issues: ValidationIssue[];
  stopCount: number;
  routeCount: number;
  serviceCount: number;
  patternCount: number;
  timetableStopCount: number;
  /** Calendar service metadata for summary reporting. */
  calendarServices: CalendarServiceMeta[];
}

// ---------------------------------------------------------------------------
// Section version map
// ---------------------------------------------------------------------------

/** Expected section versions for DataBundle. */
const SECTION_VERSIONS: Record<string, number> = {
  stops: 2,
  routes: 2,
  agency: 2,
  calendar: 1,
  feedInfo: 1,
  timetable: 2,
  tripPatterns: 2,
  translations: 1,
  lookup: 2,
};

// ---------------------------------------------------------------------------
// Validator
// ---------------------------------------------------------------------------

/**
 * Validate a single DataBundle file at `{baseDir}/{prefix}/data.json`.
 *
 * @param prefix - Source prefix (e.g. `"toei-bus"`).
 * @param baseDir - Base output directory (e.g. `pipeline/workspace/_build/data-v2`).
 * @returns Validation result with issues and stats.
 */
export function validateDataBundle(prefix: string, baseDir: string): DataValidationResult {
  const issues: ValidationIssue[] = [];
  let stopCount = 0;
  let routeCount = 0;
  let serviceCount = 0;
  let patternCount = 0;
  let timetableStopCount = 0;

  const filePath = join(baseDir, prefix, 'data.json');

  // File existence
  if (!existsSync(filePath)) {
    issues.push({ prefix, level: 'error', category: 'structure', message: 'data.json not found' });
    return {
      issues,
      stopCount,
      routeCount,
      serviceCount,
      patternCount,
      timetableStopCount,
      calendarServices: [],
    };
  }

  // JSON parse
  let bundle: DataBundle;
  try {
    const raw = readFileSync(filePath, 'utf-8');
    bundle = JSON.parse(raw) as DataBundle;
  } catch (e) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Failed to parse data.json: ${e instanceof Error ? e.message : String(e)}`,
    });
    return {
      issues,
      stopCount,
      routeCount,
      serviceCount,
      patternCount,
      timetableStopCount,
      calendarServices: [],
    };
  }

  // Bundle structure
  if (bundle.bundle_version !== 2) {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Invalid bundle_version: expected 2, got ${String(bundle.bundle_version)}`,
    });
  }
  if (bundle.kind !== 'data') {
    issues.push({
      prefix,
      level: 'error',
      category: 'structure',
      message: `Invalid kind: expected "data", got "${String(bundle.kind)}"`,
    });
  }

  // Required sections and version checks
  for (const [sectionName, expectedVersion] of Object.entries(SECTION_VERSIONS)) {
    const section = (bundle as unknown as Record<string, unknown>)[sectionName];
    if (!section || typeof section !== 'object') {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: `Missing required section: ${sectionName}`,
      });
      continue;
    }
    const v = (section as { v?: unknown }).v;
    if (v !== expectedVersion) {
      issues.push({
        prefix,
        level: 'error',
        category: 'structure',
        message: `Invalid ${sectionName}.v: expected ${expectedVersion}, got ${String(v)}`,
      });
    }
  }

  // Bail on structure errors — data checks below depend on valid structure
  if (issues.some((i) => i.level === 'error')) {
    return {
      issues,
      stopCount,
      routeCount,
      serviceCount,
      patternCount,
      timetableStopCount,
      calendarServices: [],
    };
  }

  // ---------------------------------------------------------------------------
  // Build lookup sets for referential integrity
  // ---------------------------------------------------------------------------

  const stopIds = new Set<string>();
  for (const stop of bundle.stops.data) {
    stopIds.add(stop.i);
  }
  stopCount = stopIds.size;

  const routeIds = new Set<string>();
  for (const route of bundle.routes.data) {
    routeIds.add(route.i);
  }
  routeCount = routeIds.size;

  serviceCount = bundle.calendar.data.services.length;

  const patternIds = new Set<string>();
  for (const id of Object.keys(bundle.tripPatterns.data)) {
    patternIds.add(id);
  }
  patternCount = patternIds.size;

  timetableStopCount = Object.keys(bundle.timetable.data).length;

  // ---------------------------------------------------------------------------
  // Non-empty warnings
  // ---------------------------------------------------------------------------

  if (stopCount === 0) {
    issues.push({
      prefix,
      level: 'warn',
      category: 'quality',
      message: 'stops.data is empty (0 stops)',
    });
  }
  if (routeCount === 0) {
    issues.push({
      prefix,
      level: 'warn',
      category: 'quality',
      message: 'routes.data is empty (0 routes)',
    });
  }
  if (serviceCount === 0) {
    issues.push({
      prefix,
      level: 'warn',
      category: 'quality',
      message: 'calendar.data.services is empty (0 services)',
    });
  }

  // ---------------------------------------------------------------------------
  // Calendar expiration check
  // ---------------------------------------------------------------------------

  if (bundle.calendar.data.services.length > 0) {
    // Normalize "now" to UTC midnight for date-only comparison.
    // GTFS end_date is inclusive (the service runs on that day),
    // and parseGtfsDate returns UTC midnight. Without normalization,
    // running on a UTC server (e.g. GitHub Actions) at 00:01 UTC
    // would incorrectly mark end_date=today as expired.
    const raw = new Date();
    const now = new Date(Date.UTC(raw.getUTCFullYear(), raw.getUTCMonth(), raw.getUTCDate()));
    const thirtyDaysMs = 30 * 24 * 60 * 60 * 1000;

    let earliestEnd: Date | null = null;
    for (const svc of bundle.calendar.data.services) {
      const endDate = parseGtfsDate(svc.e);
      if (endDate && (!earliestEnd || endDate < earliestEnd)) {
        earliestEnd = endDate;
      }
    }

    if (earliestEnd) {
      const diffMs = earliestEnd.getTime() - now.getTime();
      if (diffMs < 0) {
        issues.push({
          prefix,
          level: 'warn',
          category: 'calendar',
          message: `Calendar has expired services (earliest end_date already passed)`,
        });
      } else if (diffMs < thirtyDaysMs) {
        issues.push({
          prefix,
          level: 'warn',
          category: 'calendar',
          message: `Calendar expires within 30 days (earliest end_date approaching)`,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Stop coordinate range
  // ---------------------------------------------------------------------------

  for (const stop of bundle.stops.data) {
    if (stop.a < -90 || stop.a > 90) {
      issues.push({
        prefix,
        level: 'error',
        category: 'quality',
        message: `Stop ${stop.i}: lat ${stop.a} out of range [-90, 90]`,
      });
    }
    if (stop.o < -180 || stop.o > 180) {
      issues.push({
        prefix,
        level: 'error',
        category: 'quality',
        message: `Stop ${stop.i}: lon ${stop.o} out of range [-180, 180]`,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Referential integrity: tripPatterns → routes, stops
  // ---------------------------------------------------------------------------

  for (const [patternId, pattern] of Object.entries(bundle.tripPatterns.data)) {
    if (!routeIds.has(pattern.r)) {
      issues.push({
        prefix,
        level: 'error',
        category: 'integrity',
        message: `tripPattern ${patternId}: route "${pattern.r}" not found in routes`,
      });
    }
    for (const stop of pattern.stops) {
      if (!stopIds.has(stop.id)) {
        issues.push({
          prefix,
          level: 'error',
          category: 'integrity',
          message: `tripPattern ${patternId}: stop "${stop.id}" not found in stops`,
        });
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Referential integrity: timetable → tripPatterns
  // Timetable d/a array length consistency
  // ---------------------------------------------------------------------------

  for (const [stopId, groups] of Object.entries(bundle.timetable.data)) {
    for (let gi = 0; gi < groups.length; gi++) {
      const group = groups[gi];

      // timetable → tripPatterns reference
      if (!patternIds.has(group.tp)) {
        issues.push({
          prefix,
          level: 'error',
          category: 'integrity',
          message: `timetable[${stopId}][${gi}]: tripPattern "${group.tp}" not found in tripPatterns`,
        });
      }

      // d/a array length consistency per service_id
      for (const sid of Object.keys(group.d)) {
        const dLen = group.d[sid]?.length ?? 0;
        const aArr = group.a[sid];
        if (!aArr) {
          issues.push({
            prefix,
            level: 'error',
            category: 'integrity',
            message: `timetable[${stopId}][${gi}]: service "${sid}" has departures but no arrivals`,
          });
          continue;
        }
        if (dLen !== aArr.length) {
          issues.push({
            prefix,
            level: 'error',
            category: 'integrity',
            message: `timetable[${stopId}][${gi}]: service "${sid}" d.length (${dLen}) !== a.length (${aArr.length})`,
          });
        }
      }
    }
  }

  const calendarServices: CalendarServiceMeta[] = bundle.calendar.data.services.map((svc) => ({
    serviceId: svc.i,
    endDate: svc.e,
  }));

  return {
    issues,
    stopCount,
    routeCount,
    serviceCount,
    patternCount,
    timetableStopCount,
    calendarServices,
  };
}
