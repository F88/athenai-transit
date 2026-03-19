/**
 * Stop times pattern analysis for GTFS databases.
 *
 * Provides pure functions to analyze stop_times patterns such as
 * terminal-only stops, circular routes, pickup/drop-off types, and more.
 * Used by the analyze-stop-times CLI script.
 */

import type Database from 'better-sqlite3';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** Stop position summary within trips. */
export interface StopPositionSummary {
  totalStopTimes: number;
  /** Count of stop_times at trip origin (stop_sequence = MIN). */
  first: number;
  /** Count of stop_times at trip terminal (stop_sequence = MAX). */
  last: number;
  /** Count of stop_times at intermediate positions. */
  middle: number;
}

/** A stop that only appears as terminal in all its trips. */
export interface TerminalOnlyStop {
  stopId: string;
  stopName: string;
  tripCount: number;
  /** Percentage of appearances that are terminal (0–100). */
  terminalPercentage: number;
}

/** A circular route where first stop_id = last stop_id. */
export interface CircularRoute {
  routeId: string;
  routeShortName: string;
  tripCount: number;
  loopStopId: string;
  loopStopName: string;
}

/** Dwell time entry (arrival_time ≠ departure_time at the same stop). */
export interface DwellTimeEntry {
  stopId: string;
  stopName: string;
  count: number;
}

/** Terminal stop_times time pattern (arrival vs departure at terminals). */
export interface TerminalTimePattern {
  /** Terminal stop_times where both arrival and departure are present and equal. */
  arrivalEqualsDeparture: number;
  /** Terminal stop_times where arrival differs from departure. */
  arrivalDiffersDeparture: number;
  /** Terminal stop_times where arrival is NULL. */
  arrivalNull: number;
  /** Terminal stop_times where departure is NULL. */
  departureNull: number;
  /** Terminal stop_times where both are NULL. */
  bothNull: number;
  /** Total terminal stop_times. */
  totalTerminal: number;
}

/** pickup_type / drop_off_type usage counts by position. */
export interface PickupDropOffSummary {
  /** Count of stop_times with pickup_type = 1 (no pickup). */
  pickupType1Count: number;
  /** pickup_type=1 at terminal positions. */
  pickupType1Terminal: number;
  /** pickup_type=1 at non-terminal positions. */
  pickupType1NonTerminal: number;
  /** Count of stop_times with drop_off_type = 1 (no drop-off). */
  dropOffType1Count: number;
  /** drop_off_type=1 at first (origin) positions. */
  dropOffType1First: number;
  /** drop_off_type=1 at non-first positions. */
  dropOffType1NonFirst: number;
  totalStopTimes: number;
}

/** Pass-through stops (pickup_type=1 AND drop_off_type=1). */
export interface PassThroughSummary {
  /** Total stop_times where both pickup and drop-off are disabled. */
  count: number;
  /** Unique stops with pass-through entries. */
  stops: Array<{ stopId: string; stopName: string; count: number }>;
}

/** Headsign coverage for trips. */
export interface HeadsignCoverage {
  totalTrips: number;
  /** Trips with non-empty trip_headsign. */
  withHeadsign: number;
  /** Trips with empty or NULL trip_headsign. */
  withoutHeadsign: number;
}

/** Interpolation needed (both arrival_time and departure_time are NULL). */
export interface InterpolationSummary {
  count: number;
  totalStopTimes: number;
}

/** Full analysis result for a single GTFS source. */
export interface StopTimesAnalysis {
  positionSummary: StopPositionSummary;
  terminalOnlyStops: TerminalOnlyStop[];
  circularRoutes: CircularRoute[];
  dwellTimeEntries: DwellTimeEntry[];
  terminalTimePattern: TerminalTimePattern;
  pickupDropOff: PickupDropOffSummary;
  passThroughStops: PassThroughSummary;
  interpolation: InterpolationSummary;
  headsignCoverage: HeadsignCoverage;
}

// ---------------------------------------------------------------------------
// Analysis
// ---------------------------------------------------------------------------

/**
 * Run full stop_times analysis on a GTFS database.
 *
 * @param db - An open better-sqlite3 database containing GTFS tables
 *   (stop_times, stops, trips, routes).
 * @returns Comprehensive analysis covering stop positions, terminal-only stops,
 *   circular routes, dwell times, pickup/drop-off patterns, and headsign coverage.
 */
export function analyzeStopTimes(db: Database.Database): StopTimesAnalysis {
  return {
    positionSummary: analyzePositions(db),
    terminalOnlyStops: findTerminalOnlyStops(db),
    circularRoutes: findCircularRoutes(db),
    dwellTimeEntries: findDwellTimeEntries(db),
    terminalTimePattern: analyzeTerminalTimePattern(db),
    pickupDropOff: analyzePickupDropOff(db),
    passThroughStops: analyzePassThroughStops(db),
    interpolation: analyzeInterpolation(db),
    headsignCoverage: analyzeHeadsignCoverage(db),
  };
}

// ---------------------------------------------------------------------------
// Individual analyses
// ---------------------------------------------------------------------------

function analyzePositions(db: Database.Database): StopPositionSummary {
  const row = db
    .prepare(
      `WITH trip_bounds AS (
         SELECT trip_id,
                MIN(stop_sequence) AS min_seq,
                MAX(stop_sequence) AS max_seq
         FROM stop_times
         GROUP BY trip_id
       )
       SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN st.stop_sequence = tb.min_seq THEN 1 ELSE 0 END) AS first_cnt,
         SUM(CASE WHEN st.stop_sequence = tb.max_seq THEN 1 ELSE 0 END) AS last_cnt
       FROM stop_times st
       JOIN trip_bounds tb ON tb.trip_id = st.trip_id`,
    )
    .get() as { total: number; first_cnt: number; last_cnt: number };

  return {
    totalStopTimes: row.total,
    first: row.first_cnt,
    last: row.last_cnt,
    middle: row.total - row.first_cnt - row.last_cnt,
  };
}

function findTerminalOnlyStops(db: Database.Database): TerminalOnlyStop[] {
  // For each stop, count how many times it appears as terminal vs total
  const rows = db
    .prepare(
      `WITH trip_bounds AS (
         SELECT trip_id, MAX(stop_sequence) AS max_seq
         FROM stop_times
         GROUP BY trip_id
       )
       SELECT
         st.stop_id,
         s.stop_name,
         COUNT(*) AS total_count,
         SUM(CASE WHEN st.stop_sequence = tb.max_seq THEN 1 ELSE 0 END) AS terminal_count
       FROM stop_times st
       JOIN trip_bounds tb ON tb.trip_id = st.trip_id
       LEFT JOIN stops s ON s.stop_id = st.stop_id
       GROUP BY st.stop_id
       HAVING terminal_count = total_count
       ORDER BY total_count DESC`,
    )
    .all() as Array<{
    stop_id: string;
    stop_name: string | null;
    total_count: number;
    terminal_count: number;
  }>;

  return rows.map((r) => ({
    stopId: r.stop_id,
    stopName: r.stop_name ?? '',
    tripCount: r.total_count,
    terminalPercentage: 100,
  }));
}

function findCircularRoutes(db: Database.Database): CircularRoute[] {
  // Find trips where first stop_id = last stop_id, grouped by route
  const rows = db
    .prepare(
      `WITH trip_bounds AS (
         SELECT trip_id,
                MIN(stop_sequence) AS min_seq,
                MAX(stop_sequence) AS max_seq
         FROM stop_times
         GROUP BY trip_id
       )
       SELECT
         t.route_id,
         r.route_short_name,
         COUNT(DISTINCT t.trip_id) AS trip_count,
         first_st.stop_id AS loop_stop_id,
         s.stop_name AS loop_stop_name
       FROM trips t
       JOIN trip_bounds tb ON tb.trip_id = t.trip_id
       JOIN stop_times first_st ON first_st.trip_id = t.trip_id
         AND first_st.stop_sequence = tb.min_seq
       JOIN stop_times last_st ON last_st.trip_id = t.trip_id
         AND last_st.stop_sequence = tb.max_seq
       LEFT JOIN routes r ON r.route_id = t.route_id
       LEFT JOIN stops s ON s.stop_id = first_st.stop_id
       WHERE first_st.stop_id = last_st.stop_id
       GROUP BY t.route_id, first_st.stop_id
       ORDER BY trip_count DESC`,
    )
    .all() as Array<{
    route_id: string;
    route_short_name: string | null;
    trip_count: number;
    loop_stop_id: string;
    loop_stop_name: string | null;
  }>;

  return rows.map((r) => ({
    routeId: r.route_id,
    routeShortName: r.route_short_name ?? '',
    tripCount: r.trip_count,
    loopStopId: r.loop_stop_id,
    loopStopName: r.loop_stop_name ?? '',
  }));
}

function findDwellTimeEntries(db: Database.Database): DwellTimeEntry[] {
  const rows = db
    .prepare(
      `SELECT
         st.stop_id,
         s.stop_name,
         COUNT(*) AS cnt
       FROM stop_times st
       LEFT JOIN stops s ON s.stop_id = st.stop_id
       WHERE st.arrival_time IS NOT NULL
         AND st.departure_time IS NOT NULL
         AND st.arrival_time != st.departure_time
       GROUP BY st.stop_id
       ORDER BY cnt DESC`,
    )
    .all() as Array<{
    stop_id: string;
    stop_name: string | null;
    cnt: number;
  }>;

  return rows.map((r) => ({
    stopId: r.stop_id,
    stopName: r.stop_name ?? '',
    count: r.cnt,
  }));
}

function analyzeTerminalTimePattern(db: Database.Database): TerminalTimePattern {
  const row = db
    .prepare(
      `WITH trip_bounds AS (
         SELECT trip_id, MAX(stop_sequence) AS max_seq
         FROM stop_times
         GROUP BY trip_id
       )
       SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN st.arrival_time IS NOT NULL AND st.departure_time IS NOT NULL
                   AND st.arrival_time = st.departure_time THEN 1 ELSE 0 END) AS arr_eq_dep,
         SUM(CASE WHEN st.arrival_time IS NOT NULL AND st.departure_time IS NOT NULL
                   AND st.arrival_time != st.departure_time THEN 1 ELSE 0 END) AS arr_diff_dep,
         SUM(CASE WHEN st.arrival_time IS NULL AND st.departure_time IS NOT NULL
              THEN 1 ELSE 0 END) AS arr_null,
         SUM(CASE WHEN st.arrival_time IS NOT NULL AND st.departure_time IS NULL
              THEN 1 ELSE 0 END) AS dep_null,
         SUM(CASE WHEN st.arrival_time IS NULL AND st.departure_time IS NULL
              THEN 1 ELSE 0 END) AS both_null
       FROM stop_times st
       JOIN trip_bounds tb ON tb.trip_id = st.trip_id
       WHERE st.stop_sequence = tb.max_seq`,
    )
    .get() as {
    total: number;
    arr_eq_dep: number;
    arr_diff_dep: number;
    arr_null: number;
    dep_null: number;
    both_null: number;
  };

  return {
    arrivalEqualsDeparture: row.arr_eq_dep,
    arrivalDiffersDeparture: row.arr_diff_dep,
    arrivalNull: row.arr_null,
    departureNull: row.dep_null,
    bothNull: row.both_null,
    totalTerminal: row.total,
  };
}

function analyzePickupDropOff(db: Database.Database): PickupDropOffSummary {
  const row = db
    .prepare(
      `WITH trip_bounds AS (
         SELECT trip_id,
                MIN(stop_sequence) AS min_seq,
                MAX(stop_sequence) AS max_seq
         FROM stop_times
         GROUP BY trip_id
       )
       SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN st.pickup_type = 1 THEN 1 ELSE 0 END) AS pickup1,
         SUM(CASE WHEN st.pickup_type = 1 AND st.stop_sequence = tb.max_seq
              THEN 1 ELSE 0 END) AS pickup1_terminal,
         SUM(CASE WHEN st.drop_off_type = 1 THEN 1 ELSE 0 END) AS dropoff1,
         SUM(CASE WHEN st.drop_off_type = 1 AND st.stop_sequence = tb.min_seq
              THEN 1 ELSE 0 END) AS dropoff1_first
       FROM stop_times st
       JOIN trip_bounds tb ON tb.trip_id = st.trip_id`,
    )
    .get() as {
    total: number;
    pickup1: number;
    pickup1_terminal: number;
    dropoff1: number;
    dropoff1_first: number;
  };

  return {
    pickupType1Count: row.pickup1,
    pickupType1Terminal: row.pickup1_terminal,
    pickupType1NonTerminal: row.pickup1 - row.pickup1_terminal,
    dropOffType1Count: row.dropoff1,
    dropOffType1First: row.dropoff1_first,
    dropOffType1NonFirst: row.dropoff1 - row.dropoff1_first,
    totalStopTimes: row.total,
  };
}

function analyzePassThroughStops(db: Database.Database): PassThroughSummary {
  const countRow = db
    .prepare(
      `SELECT COUNT(*) AS cnt FROM stop_times
       WHERE pickup_type = 1 AND drop_off_type = 1`,
    )
    .get() as { cnt: number };

  const stops = db
    .prepare(
      `SELECT st.stop_id, s.stop_name, COUNT(*) AS cnt
       FROM stop_times st
       LEFT JOIN stops s ON s.stop_id = st.stop_id
       WHERE st.pickup_type = 1 AND st.drop_off_type = 1
       GROUP BY st.stop_id
       ORDER BY cnt DESC`,
    )
    .all() as Array<{ stop_id: string; stop_name: string | null; cnt: number }>;

  return {
    count: countRow.cnt,
    stops: stops.map((r) => ({
      stopId: r.stop_id,
      stopName: r.stop_name ?? '',
      count: r.cnt,
    })),
  };
}

function analyzeInterpolation(db: Database.Database): InterpolationSummary {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN arrival_time IS NULL AND departure_time IS NULL THEN 1 ELSE 0 END) AS interp
       FROM stop_times`,
    )
    .get() as { total: number; interp: number };

  return {
    count: row.interp,
    totalStopTimes: row.total,
  };
}

function analyzeHeadsignCoverage(db: Database.Database): HeadsignCoverage {
  const row = db
    .prepare(
      `SELECT
         COUNT(*) AS total,
         SUM(CASE WHEN trip_headsign IS NOT NULL AND trip_headsign != '' THEN 1 ELSE 0 END) AS with_hs
       FROM trips`,
    )
    .get() as { total: number; with_hs: number };

  return {
    totalTrips: row.total,
    withHeadsign: row.with_hs,
    withoutHeadsign: row.total - row.with_hs,
  };
}

// ---------------------------------------------------------------------------
// Formatting
// ---------------------------------------------------------------------------

/**
 * Format analysis result as human-readable text.
 *
 * @param sourceName - Display name of the GTFS source (used as the report header).
 * @param analysis - Analysis result from {@link analyzeStopTimes}.
 * @returns Multi-line formatted string suitable for console output or file writing.
 */
export function formatAnalysis(sourceName: string, analysis: StopTimesAnalysis): string {
  const lines: string[] = [];
  const {
    positionSummary,
    terminalOnlyStops,
    circularRoutes,
    dwellTimeEntries,
    terminalTimePattern,
    pickupDropOff,
    passThroughStops,
    interpolation,
    headsignCoverage,
  } = analysis;

  lines.push(`=== ${sourceName} ===`);
  lines.push('');

  // Position summary
  lines.push('## Stop Position Summary');
  lines.push(`  Total stop_times: ${positionSummary.totalStopTimes}`);
  lines.push(`  First (origin):   ${positionSummary.first}`);
  lines.push(`  Last (terminal):  ${positionSummary.last}`);
  lines.push(`  Middle:           ${positionSummary.middle}`);
  lines.push('');

  // Terminal-only stops
  lines.push(`## Terminal-Only Stops (${terminalOnlyStops.length})`);
  if (terminalOnlyStops.length > 0) {
    for (const s of terminalOnlyStops.slice(0, 20)) {
      lines.push(`  ${s.stopId} ${s.stopName} (${s.tripCount} trips)`);
    }
    if (terminalOnlyStops.length > 20) {
      lines.push(`  ... and ${terminalOnlyStops.length - 20} more`);
    }
  } else {
    lines.push('  (none)');
  }
  lines.push('');

  // Circular routes
  lines.push(`## Circular Routes (${circularRoutes.length})`);
  if (circularRoutes.length > 0) {
    for (const r of circularRoutes.slice(0, 20)) {
      lines.push(
        `  ${r.routeId} [${r.routeShortName}] loop at ${r.loopStopId} ${r.loopStopName} (${r.tripCount} trips)`,
      );
    }
    if (circularRoutes.length > 20) {
      lines.push(`  ... and ${circularRoutes.length - 20} more`);
    }
  } else {
    lines.push('  (none)');
  }
  lines.push('');

  // Dwell time
  lines.push(`## Dwell Time Stops (arrival != departure) (${dwellTimeEntries.length})`);
  if (dwellTimeEntries.length > 0) {
    for (const d of dwellTimeEntries.slice(0, 10)) {
      lines.push(`  ${d.stopId} ${d.stopName} (${d.count} entries)`);
    }
    if (dwellTimeEntries.length > 10) {
      lines.push(`  ... and ${dwellTimeEntries.length - 10} more`);
    }
  } else {
    lines.push('  (none)');
  }
  lines.push('');

  // Terminal time pattern
  lines.push('## Terminal Time Pattern');
  lines.push(`  Total terminal:         ${terminalTimePattern.totalTerminal}`);
  lines.push(`  arrival = departure:    ${terminalTimePattern.arrivalEqualsDeparture}`);
  lines.push(`  arrival != departure:   ${terminalTimePattern.arrivalDiffersDeparture}`);
  lines.push(`  arrival NULL:           ${terminalTimePattern.arrivalNull}`);
  lines.push(`  departure NULL:         ${terminalTimePattern.departureNull}`);
  lines.push(`  both NULL:              ${terminalTimePattern.bothNull}`);
  lines.push('');

  // Pickup/Drop-off
  lines.push('## Pickup/Drop-off Type Usage');
  lines.push(
    `  pickup_type=1 (no pickup):     ${pickupDropOff.pickupType1Count} / ${pickupDropOff.totalStopTimes}`,
  );
  lines.push(`    at terminal:                 ${pickupDropOff.pickupType1Terminal}`);
  lines.push(`    at non-terminal:             ${pickupDropOff.pickupType1NonTerminal}`);
  lines.push(
    `  drop_off_type=1 (no drop-off): ${pickupDropOff.dropOffType1Count} / ${pickupDropOff.totalStopTimes}`,
  );
  lines.push(`    at first (origin):           ${pickupDropOff.dropOffType1First}`);
  lines.push(`    at non-first:                ${pickupDropOff.dropOffType1NonFirst}`);
  lines.push('');

  // Pass-through stops
  lines.push(`## Pass-Through Stops (pickup=1 AND drop_off=1) (${passThroughStops.count})`);
  if (passThroughStops.stops.length > 0) {
    for (const s of passThroughStops.stops.slice(0, 10)) {
      lines.push(`  ${s.stopId} ${s.stopName} (${s.count} entries)`);
    }
    if (passThroughStops.stops.length > 10) {
      lines.push(`  ... and ${passThroughStops.stops.length - 10} more`);
    }
  } else {
    lines.push('  (none)');
  }
  lines.push('');

  // Interpolation
  lines.push('## Interpolation (both times NULL)');
  lines.push(`  ${interpolation.count} / ${interpolation.totalStopTimes}`);
  lines.push('');

  // Headsign coverage
  lines.push('## Headsign Coverage');
  lines.push(`  Total trips:      ${headsignCoverage.totalTrips}`);
  lines.push(`  With headsign:    ${headsignCoverage.withHeadsign}`);
  lines.push(`  Without headsign: ${headsignCoverage.withoutHeadsign}`);
  lines.push('');

  return lines.join('\n');
}
