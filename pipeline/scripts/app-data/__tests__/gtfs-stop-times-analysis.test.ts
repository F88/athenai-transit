/**
 * Tests for gtfs-stop-times-analysis.ts analysis functions.
 *
 * Uses an in-memory SQLite database populated with minimal GTFS test data
 * to verify each analysis function detects the expected patterns.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { analyzeStopTimes, formatAnalysis } from '../lib/gtfs-stop-times-analysis';

// ---------------------------------------------------------------------------
// Test DB setup
// ---------------------------------------------------------------------------

let db: Database.Database;

/** Create minimal GTFS schema tables needed for stop_times analysis. */
function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE stops (
      stop_id TEXT PRIMARY KEY,
      stop_name TEXT NOT NULL,
      stop_lat REAL NOT NULL DEFAULT 0,
      stop_lon REAL NOT NULL DEFAULT 0
    );
    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY,
      route_short_name TEXT,
      route_long_name TEXT,
      route_type INTEGER NOT NULL DEFAULT 3
    );
    CREATE TABLE trips (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      service_id TEXT,
      trip_headsign TEXT
    );
    CREATE TABLE stop_times (
      trip_id TEXT NOT NULL,
      arrival_time TEXT,
      departure_time TEXT,
      stop_id TEXT NOT NULL,
      stop_sequence INTEGER NOT NULL,
      pickup_type INTEGER,
      drop_off_type INTEGER,
      PRIMARY KEY (trip_id, stop_sequence)
    );
  `);
}

/** Insert a basic route with a single trip and 3 stops (A -> B -> C). */
function insertBasicTrip(
  database: Database.Database,
  options?: {
    tripId?: string;
    routeId?: string;
    headsign?: string;
    stops?: Array<{
      stopId: string;
      stopName: string;
      seq: number;
      arrival?: string | null;
      departure?: string | null;
      pickupType?: number | null;
      dropOffType?: number | null;
    }>;
  },
): void {
  const tripId = options?.tripId ?? 'trip1';
  const routeId = options?.routeId ?? 'route1';
  const headsign = options?.headsign ?? 'Destination';

  // Insert route if not exists
  database.exec(
    `INSERT OR IGNORE INTO routes (route_id, route_short_name) VALUES ('${routeId}', '${routeId}')`,
  );
  // Insert trip
  database.exec(
    `INSERT OR IGNORE INTO trips (trip_id, route_id, trip_headsign) VALUES ('${tripId}', '${routeId}', '${headsign}')`,
  );

  const stops = options?.stops ?? [
    { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
    { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: '08:10:00', departure: '08:10:00' },
    { stopId: 'C', stopName: 'Stop C', seq: 3, arrival: '08:20:00', departure: '08:20:00' },
  ];

  for (const s of stops) {
    database.exec(
      `INSERT OR IGNORE INTO stops (stop_id, stop_name) VALUES ('${s.stopId}', '${s.stopName}')`,
    );
    const arr = s.arrival === null || s.arrival === undefined ? 'NULL' : `'${s.arrival}'`;
    const dep = s.departure === null || s.departure === undefined ? 'NULL' : `'${s.departure}'`;
    const pickup =
      s.pickupType === null || s.pickupType === undefined ? 'NULL' : String(s.pickupType);
    const dropoff =
      s.dropOffType === null || s.dropOffType === undefined ? 'NULL' : String(s.dropOffType);
    database.exec(
      `INSERT INTO stop_times (trip_id, stop_id, stop_sequence, arrival_time, departure_time, pickup_type, drop_off_type)
       VALUES ('${tripId}', '${s.stopId}', ${s.seq}, ${arr}, ${dep}, ${pickup}, ${dropoff})`,
    );
  }
}

beforeEach(() => {
  db = new Database(':memory:');
  createSchema(db);
});

afterEach(() => {
  db.close();
});

// ---------------------------------------------------------------------------
// #1 Position Summary
// ---------------------------------------------------------------------------

describe('positionSummary', () => {
  it('counts first, last, and middle stop_times', () => {
    insertBasicTrip(db);

    const result = analyzeStopTimes(db);
    expect(result.positionSummary).toEqual({
      totalStopTimes: 3,
      first: 1,
      last: 1,
      middle: 1,
    });
  });

  it('handles trips with only 2 stops (no middle)', () => {
    insertBasicTrip(db, {
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: '08:10:00', departure: '08:10:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.positionSummary.middle).toBe(0);
    expect(result.positionSummary.first).toBe(1);
    expect(result.positionSummary.last).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// #2 Terminal-Only Stops
// ---------------------------------------------------------------------------

describe('terminalOnlyStops', () => {
  it('detects stops that only appear at terminal position', () => {
    // Trip 1: A -> B -> C (C is terminal)
    insertBasicTrip(db);
    // Trip 2: A -> B -> C (C is terminal again)
    insertBasicTrip(db, {
      tripId: 'trip2',
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '09:00:00', departure: '09:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: '09:10:00', departure: '09:10:00' },
        { stopId: 'C', stopName: 'Stop C', seq: 3, arrival: '09:20:00', departure: '09:20:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    // C appears only as terminal
    const terminalOnly = result.terminalOnlyStops;
    expect(terminalOnly).toHaveLength(1);
    expect(terminalOnly[0].stopId).toBe('C');
    expect(terminalOnly[0].tripCount).toBe(2);
    expect(terminalOnly[0].terminalPercentage).toBe(100);
  });

  it('excludes stops that appear at non-terminal positions', () => {
    // Trip 1: A -> B -> C
    insertBasicTrip(db);
    // Trip 2: C -> B -> D (C is now origin, not terminal)
    insertBasicTrip(db, {
      tripId: 'trip2',
      stops: [
        { stopId: 'C', stopName: 'Stop C', seq: 1, arrival: '09:00:00', departure: '09:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: '09:10:00', departure: '09:10:00' },
        { stopId: 'D', stopName: 'Stop D', seq: 3, arrival: '09:20:00', departure: '09:20:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    const terminalOnly = result.terminalOnlyStops;
    // C appears as terminal in trip1 but as origin in trip2 -> not terminal-only
    // D appears only as terminal -> terminal-only
    expect(terminalOnly).toHaveLength(1);
    expect(terminalOnly[0].stopId).toBe('D');
  });
});

// ---------------------------------------------------------------------------
// #3 Circular Routes
// ---------------------------------------------------------------------------

describe('circularRoutes', () => {
  it('detects routes where first stop = last stop', () => {
    insertBasicTrip(db, {
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: '08:10:00', departure: '08:10:00' },
        { stopId: 'A', stopName: 'Stop A', seq: 3, arrival: '08:20:00', departure: '08:20:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.circularRoutes).toHaveLength(1);
    expect(result.circularRoutes[0].loopStopId).toBe('A');
    expect(result.circularRoutes[0].tripCount).toBe(1);
  });

  it('returns empty for non-circular routes', () => {
    insertBasicTrip(db);

    const result = analyzeStopTimes(db);
    expect(result.circularRoutes).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// #4 Dwell Time
// ---------------------------------------------------------------------------

describe('dwellTimeEntries', () => {
  it('detects stops where arrival != departure (dwell time)', () => {
    insertBasicTrip(db, {
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: '08:10:00', departure: '08:11:00' },
        { stopId: 'C', stopName: 'Stop C', seq: 3, arrival: '08:20:00', departure: '08:20:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.dwellTimeEntries).toHaveLength(1);
    expect(result.dwellTimeEntries[0].stopId).toBe('B');
    expect(result.dwellTimeEntries[0].count).toBe(1);
  });

  it('returns empty when all arrivals equal departures', () => {
    insertBasicTrip(db);

    const result = analyzeStopTimes(db);
    expect(result.dwellTimeEntries).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// #5 Terminal Time Pattern
// ---------------------------------------------------------------------------

describe('terminalTimePattern', () => {
  it('counts terminals where arrival = departure', () => {
    insertBasicTrip(db);

    const result = analyzeStopTimes(db);
    expect(result.terminalTimePattern.arrivalEqualsDeparture).toBe(1);
    expect(result.terminalTimePattern.totalTerminal).toBe(1);
  });

  it('counts terminals where arrival differs from departure', () => {
    insertBasicTrip(db, {
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: '08:20:00', departure: '08:21:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.terminalTimePattern.arrivalDiffersDeparture).toBe(1);
  });

  it('counts terminals where arrival is NULL', () => {
    insertBasicTrip(db, {
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: null, departure: '08:20:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.terminalTimePattern.arrivalNull).toBe(1);
  });

  it('counts terminals where both times are NULL', () => {
    insertBasicTrip(db, {
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: null, departure: null },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.terminalTimePattern.bothNull).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// #6 Pickup Type Distribution
// ---------------------------------------------------------------------------

describe('pickupDropOff', () => {
  it('counts pickup_type=1 at terminal vs non-terminal', () => {
    insertBasicTrip(db, {
      stops: [
        {
          stopId: 'A',
          stopName: 'Stop A',
          seq: 1,
          arrival: '08:00:00',
          departure: '08:00:00',
        },
        {
          stopId: 'B',
          stopName: 'Stop B',
          seq: 2,
          arrival: '08:10:00',
          departure: '08:10:00',
          pickupType: 1,
        },
        {
          stopId: 'C',
          stopName: 'Stop C',
          seq: 3,
          arrival: '08:20:00',
          departure: '08:20:00',
          pickupType: 1,
        },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.pickupDropOff.pickupType1Count).toBe(2);
    expect(result.pickupDropOff.pickupType1Terminal).toBe(1);
    expect(result.pickupDropOff.pickupType1NonTerminal).toBe(1);
  });

  it('counts drop_off_type=1 at first vs non-first', () => {
    insertBasicTrip(db, {
      stops: [
        {
          stopId: 'A',
          stopName: 'Stop A',
          seq: 1,
          arrival: '08:00:00',
          departure: '08:00:00',
          dropOffType: 1,
        },
        {
          stopId: 'B',
          stopName: 'Stop B',
          seq: 2,
          arrival: '08:10:00',
          departure: '08:10:00',
          dropOffType: 1,
        },
        {
          stopId: 'C',
          stopName: 'Stop C',
          seq: 3,
          arrival: '08:20:00',
          departure: '08:20:00',
        },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.pickupDropOff.dropOffType1Count).toBe(2);
    expect(result.pickupDropOff.dropOffType1First).toBe(1);
    expect(result.pickupDropOff.dropOffType1NonFirst).toBe(1);
  });

  it('returns zero when no pickup/dropoff type is set', () => {
    insertBasicTrip(db);

    const result = analyzeStopTimes(db);
    expect(result.pickupDropOff.pickupType1Count).toBe(0);
    expect(result.pickupDropOff.dropOffType1Count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// #8 Pass-Through Stops
// ---------------------------------------------------------------------------

describe('passThroughStops', () => {
  it('detects stops with both pickup=1 and drop_off=1', () => {
    insertBasicTrip(db, {
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
        {
          stopId: 'B',
          stopName: 'Stop B',
          seq: 2,
          arrival: null,
          departure: null,
          pickupType: 1,
          dropOffType: 1,
        },
        { stopId: 'C', stopName: 'Stop C', seq: 3, arrival: '08:20:00', departure: '08:20:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.passThroughStops.count).toBe(1);
    expect(result.passThroughStops.stops).toHaveLength(1);
    expect(result.passThroughStops.stops[0].stopId).toBe('B');
  });

  it('returns empty when no pass-through stops exist', () => {
    insertBasicTrip(db);

    const result = analyzeStopTimes(db);
    expect(result.passThroughStops.count).toBe(0);
    expect(result.passThroughStops.stops).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// #9 Interpolation
// ---------------------------------------------------------------------------

describe('interpolation', () => {
  it('counts stop_times where both arrival and departure are NULL', () => {
    insertBasicTrip(db, {
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: null, departure: null },
        { stopId: 'C', stopName: 'Stop C', seq: 3, arrival: '08:20:00', departure: '08:20:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.interpolation.count).toBe(1);
    expect(result.interpolation.totalStopTimes).toBe(3);
  });

  it('does not count when only one time is NULL', () => {
    insertBasicTrip(db, {
      stops: [
        { stopId: 'A', stopName: 'Stop A', seq: 1, arrival: '08:00:00', departure: '08:00:00' },
        { stopId: 'B', stopName: 'Stop B', seq: 2, arrival: null, departure: '08:10:00' },
        { stopId: 'C', stopName: 'Stop C', seq: 3, arrival: '08:20:00', departure: '08:20:00' },
      ],
    });

    const result = analyzeStopTimes(db);
    expect(result.interpolation.count).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// #10 Headsign Coverage
// ---------------------------------------------------------------------------

describe('headsignCoverage', () => {
  it('counts trips with and without headsign', () => {
    insertBasicTrip(db, { tripId: 'trip1', headsign: 'Tokyo' });
    insertBasicTrip(db, { tripId: 'trip2', headsign: '' });

    const result = analyzeStopTimes(db);
    expect(result.headsignCoverage.totalTrips).toBe(2);
    expect(result.headsignCoverage.withHeadsign).toBe(1);
    expect(result.headsignCoverage.withoutHeadsign).toBe(1);
  });

  it('counts all trips with headsign when all have one', () => {
    insertBasicTrip(db, { tripId: 'trip1', headsign: 'Shinjuku' });
    insertBasicTrip(db, { tripId: 'trip2', headsign: 'Shibuya' });

    const result = analyzeStopTimes(db);
    expect(result.headsignCoverage.withHeadsign).toBe(2);
    expect(result.headsignCoverage.withoutHeadsign).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// formatAnalysis
// ---------------------------------------------------------------------------

describe('formatAnalysis', () => {
  it('produces output containing source name and all section headers', () => {
    insertBasicTrip(db);

    const result = analyzeStopTimes(db);
    const output = formatAnalysis('test-source', result);

    expect(output).toContain('=== test-source ===');
    expect(output).toContain('## Stop Position Summary');
    expect(output).toContain('## Terminal-Only Stops');
    expect(output).toContain('## Circular Routes');
    expect(output).toContain('## Dwell Time Stops');
    expect(output).toContain('## Terminal Time Pattern');
    expect(output).toContain('## Pickup/Drop-off Type Usage');
    expect(output).toContain('## Pass-Through Stops');
    expect(output).toContain('## Interpolation');
    expect(output).toContain('## Headsign Coverage');
  });
});
