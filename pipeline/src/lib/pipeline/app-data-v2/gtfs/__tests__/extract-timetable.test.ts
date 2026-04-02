/**
 * Tests for v2-extract-timetable.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractTripPatternsAndTimetable } from '../extract-timetable';

let db: Database.Database;

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE trips (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      service_id TEXT,
      trip_headsign TEXT,
      direction_id INTEGER
    );
    CREATE TABLE stop_times (
      trip_id TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      stop_sequence INTEGER NOT NULL,
      departure_time TEXT,
      arrival_time TEXT,
      pickup_type INTEGER,
      drop_off_type INTEGER,
      stop_headsign TEXT,
      PRIMARY KEY (trip_id, stop_sequence)
    );
  `);
}

beforeEach(() => {
  db = new Database(':memory:');
  createSchema(db);
});

afterEach(() => {
  db.close();
});

describe('extractTripPatternsAndTimetable', () => {
  it('returns empty results when no trips exist', () => {
    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns).toEqual({});
    expect(timetable).toEqual({});
  });

  it('groups trips with identical stop sequences into the same pattern', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S002', 2, '09:10:00', '09:10:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const patternIds = Object.keys(tripPatterns);
    expect(patternIds).toHaveLength(1);
    expect(tripPatterns[patternIds[0]].stops).toEqual([{ id: 'test:S001' }, { id: 'test:S002' }]);
  });

  it('creates separate patterns for different stop sequences', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S003', 2, '09:10:00', '09:10:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(Object.keys(tripPatterns)).toHaveLength(2);
  });

  it('assigns deterministic pattern IDs: {prefix}:p{1-indexed}', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const ids = Object.keys(tripPatterns);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe('test:p1');
  });

  it('pattern includes route, headsign, direction, stops', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 1);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const p = tripPatterns['test:p1'];
    expect(p.v).toBe(2);
    expect(p.r).toBe('test:R001');
    expect(p.h).toBe('渋谷');
    expect(p.dir).toBe(1);
    expect(p.stops).toEqual([{ id: 'test:S001' }, { id: 'test:S002' }]);
  });

  it('omits dir when direction_id is NULL', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', NULL);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns['test:p1'].dir).toBeUndefined();
  });

  it('timetable d/a/pt/dt are positionally aligned', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '07:59:00', 0, 1, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:09:00', 2, 3, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    const s1Groups = timetable['test:S001'];
    expect(s1Groups).toHaveLength(1);
    const g = s1Groups[0];
    expect(g.d['test:WD']).toEqual([480]);
    expect(g.a['test:WD']).toEqual([479]);
    expect(g.pt!['test:WD']).toEqual([0]);
    expect(g.dt!['test:WD']).toEqual([1]);

    const s2Groups = timetable['test:S002'];
    expect(s2Groups[0].d['test:WD']).toEqual([490]);
    expect(s2Groups[0].a['test:WD']).toEqual([489]);
    expect(s2Groups[0].pt!['test:WD']).toEqual([2]);
    expect(s2Groups[0].dt!['test:WD']).toEqual([3]);
  });

  it('copies departure to arrival when arrival_time is NULL', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', NULL, 0, 0, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    const g = timetable['test:S001'][0];
    expect(g.d['test:WD']).toEqual([480]);
    expect(g.a['test:WD']).toEqual([480]);
  });

  it('handles overnight departures (25:00 etc.)', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '25:30:00', '25:30:00', 0, 0, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(timetable['test:S001'][0].d['test:WD']).toEqual([1530]);
  });

  it('multiple service_ids share the same pattern', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'HD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, NULL);
    `);

    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(Object.keys(tripPatterns)).toHaveLength(1);

    const g = timetable['test:S001'][0];
    expect(g.d['test:WD']).toEqual([480]);
    expect(g.d['test:HD']).toEqual([540]);
  });

  it('departures are sorted in ascending order', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '09:00:00', '09:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(timetable['test:S001'][0].d['test:WD']).toEqual([480, 540]);
  });

  it('GTFS always includes pt/dt (even when all values are 0)', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    const g = timetable['test:S001'][0];
    // pt/dt should be present even though all values are 0
    expect(g.pt).toBeDefined();
    expect(g.dt).toBeDefined();
    expect(g.pt!['test:WD']).toEqual([0]);
    expect(g.dt!['test:WD']).toEqual([0]);
  });

  it('creates separate patterns for different headsigns on the same route', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '新宿', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    const headsigns = Object.values(tripPatterns)
      .map((p) => p.h)
      .sort();
    expect(headsigns).toEqual(['新宿', '渋谷']);
  });

  it('includes direction_id=0 in pattern (not omitted)', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns['test:p1'].dir).toBe(0);
  });

  it('handles pickup_type/drop_off_type NULL as 0', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', NULL, NULL, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    const g = timetable['test:S001'][0];
    expect(g.pt!['test:WD']).toEqual([0]);
    expect(g.dt!['test:WD']).toEqual([0]);
  });

  it('NULL departure stop is in pattern.stops but not in timetable', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, NULL, NULL, 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S003', 3, '08:10:00', '08:10:00', 0, 0, NULL);
    `);

    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
    // Pattern includes all 3 stops (including pass-through)
    expect(tripPatterns['test:p1'].stops).toEqual([
      { id: 'test:S001' },
      { id: 'test:S002' },
      { id: 'test:S003' },
    ]);
    // But timetable has no entry for S002
    expect(timetable['test:S002']).toBeUndefined();
  });

  it('skips stop_times with NULL departure_time', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, NULL, '08:05:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S003', 3, '08:10:00', '08:10:00', 0, 0, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    // S002 should have no timetable entry (departure is NULL)
    expect(timetable['test:S002']).toBeUndefined();
    // S001 and S003 should have entries
    expect(timetable['test:S001']).toHaveLength(1);
    expect(timetable['test:S003']).toHaveLength(1);
  });

  it('d/a/pt/dt array lengths are equal for each service_id', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '07:59:00', 1, 2, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '08:59:00', 0, 0, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    const g = timetable['test:S001'][0];
    const dLen = g.d['test:WD'].length;
    expect(g.a['test:WD']).toHaveLength(dLen);
    expect(g.pt!['test:WD']).toHaveLength(dLen);
    expect(g.dt!['test:WD']).toHaveLength(dLen);
    expect(dLen).toBe(2);
  });

  it('produces multiple timetable groups when different patterns serve the same stop', () => {
    // Two trips with different stop sequences both pass through S002
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S003', 1, '09:00:00', '09:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S002', 2, '09:10:00', '09:10:00', 0, 0, NULL);
    `);

    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
    // Two different patterns (different first stop)
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    // S002 appears in both patterns -> 2 timetable groups
    expect(timetable['test:S002']).toHaveLength(2);
  });

  it('handles circular route (same first and last stop)', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '都庁前', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S001', 3, '08:20:00', '08:20:00', 0, 0, NULL);
    `);

    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
    const p = Object.values(tripPatterns)[0];
    // Circular: first and last stop are the same
    expect(p.stops[0].id).toBe(p.stops[p.stops.length - 1].id);
    expect(p.stops).toEqual([{ id: 'test:S001' }, { id: 'test:S002' }, { id: 'test:S001' }]);
    // S001 appears twice in the pattern -> timetable has 2 departures (at seq 1 and seq 3)
    const g = timetable['test:S001'][0];
    expect(g.d['test:WD']).toEqual([480, 500]);
  });

  it('route_url is NOT included in route output (moved to lookup)', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const p = Object.values(tripPatterns)[0];
    // RouteV2Json should not have 'u' (route_url) field
    expect(p).not.toHaveProperty('u');
  });

  it('pattern sort is deterministic: route_id -> headsign -> direction -> stops', () => {
    // R002/新宿/0 should come after R001/渋谷/0
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R002', 'WD', '新宿', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const patterns = Object.entries(tripPatterns);
    // p1 should be R001 (sorts before R002)
    expect(patterns[0][0]).toBe('test:p1');
    expect(patterns[0][1].r).toBe('test:R001');
    expect(patterns[1][0]).toBe('test:p2');
    expect(patterns[1][1].r).toBe('test:R002');
  });

  it('a/d/pt/dt remain positionally aligned after sorting by departure time', () => {
    // Two departures in reverse time order to verify sort preserves alignment
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '10:00:00', '09:58:00', 1, 2, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '08:00:00', '07:55:00', 0, 3, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    const g = timetable['test:S001'][0];
    // After sort: T002 (08:00) first, T001 (10:00) second
    expect(g.d['test:WD']).toEqual([480, 600]);
    expect(g.a['test:WD']).toEqual([475, 598]);
    expect(g.pt!['test:WD']).toEqual([0, 1]);
    expect(g.dt!['test:WD']).toEqual([3, 2]);
  });

  it('creates separate patterns for same route+headsign+stops but different direction_id', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '都庁前', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '都庁前', 1);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S002', 2, '09:10:00', '09:10:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    const dirs = Object.values(tripPatterns)
      .map((p) => p.dir)
      .sort();
    expect(dirs).toEqual([0, 1]);
  });

  it('skips stop_times whose trip_id is not in trips table', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('ORPHAN', 'S001', 1, '09:00:00', '09:00:00', 0, 0, NULL);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(timetable['test:S001'][0].d['test:WD']).toEqual([480]);
  });

  it('empty headsign is preserved (not converted to undefined)', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns['test:p1'].h).toBe('');
  });

  it('NULL trip_headsign is converted to empty string', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', NULL, 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns['test:p1'].h).toBe('');
  });

  it('ignores orphan stop_times across multiple rows and keeps valid patterns intact', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('ORPHAN', 'SX01', 1, '07:00:00', '07:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('ORPHAN', 'SX02', 2, '07:10:00', '07:10:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
    `);

    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');

    expect(Object.keys(tripPatterns)).toEqual(['test:p1']);
    expect(tripPatterns['test:p1'].stops).toEqual([{ id: 'test:S001' }, { id: 'test:S002' }]);
    expect(timetable['test:S001'][0].d['test:WD']).toEqual([480]);
    expect(timetable['test:SX01']).toBeUndefined();
    expect(timetable['test:SX02']).toBeUndefined();
  });

  it('sorts NULL direction_id before 0 when assigning pattern IDs', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', NULL);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, NULL);
    `);

    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');

    expect(Object.keys(tripPatterns)).toEqual(['test:p1', 'test:p2']);
    expect(tripPatterns['test:p1'].dir).toBeUndefined();
    expect(tripPatterns['test:p2'].dir).toBe(0);

    const groups = timetable['test:S001'];
    expect(groups).toHaveLength(2);
    expect(groups.find((g) => g.tp === 'test:p1')!.d['test:WD']).toEqual([480]);
    expect(groups.find((g) => g.tp === 'test:p2')!.d['test:WD']).toEqual([540]);
  });

  // -------------------------------------------------------------------------
  // stop_headsign (sh) tests
  // -------------------------------------------------------------------------

  it('omits sh when stop_headsign is NULL', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const p = tripPatterns['test:p1'];
    expect(p.stops[0]).toEqual({ id: 'test:S001' });
    expect(p.stops[1]).toEqual({ id: 'test:S002' });
    expect(p.stops[0].sh).toBeUndefined();
    expect(p.stops[1].sh).toBeUndefined();
  });

  it('preserves empty string sh when DB contains empty string', () => {
    // In practice the CSV→DB import converts empty fields to NULL,
    // so empty strings rarely appear. This test verifies the pipeline
    // does not silently drop them if they do exist in the DB.
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, '');
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns['test:p1'].stops[0].sh).toBe('');
  });

  it('creates separate patterns for NULL vs empty string stop_headsign in DB', () => {
    // NULL and empty string produce different pattern keys.
    // In practice empty strings do not appear (CSV import normalizes to NULL),
    // but if they did, they must not be conflated.
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, '');
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    const patterns = Object.values(tripPatterns);
    const withNull = patterns.find((p) => p.stops[0].sh === undefined)!;
    const withEmpty = patterns.find((p) => p.stops[0].sh === '')!;
    expect(withNull).toBeDefined();
    expect(withEmpty).toBeDefined();
  });

  it('includes sh when stop_headsign equals trip_headsign (no omission)', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, '渋谷');
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    // Pipeline stores raw GTFS value without comparing to trip_headsign
    expect(tripPatterns['test:p1'].stops[0].sh).toBe('渋谷');
  });

  it('includes sh when stop_headsign differs from trip_headsign', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '豊洲市場', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, '豊洲市場（急行）');
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, '豊洲市場');
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const p = tripPatterns['test:p1'];
    expect(p.h).toBe('豊洲市場');
    expect(p.stops[0].sh).toBe('豊洲市場（急行）');
    expect(p.stops[1].sh).toBe('豊洲市場');
  });

  it('includes sh when trip_headsign is empty but stop_headsign is provided', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, '中野駅');
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const p = tripPatterns['test:p1'];
    expect(p.h).toBe('');
    expect(p.stops[0].sh).toBe('中野駅');
    // Terminal stop with NULL stop_headsign
    expect(p.stops[1].sh).toBeUndefined();
  });

  it('stores different sh per stop within the same trip (mid-trip headsign change)', () => {
    // Simulates kyoto-city-bus pattern: headsign changes as bus passes intermediate stops
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '北大路BT・出町柳駅', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, '北大路BT・出町柳駅');
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, '出町柳駅');
      INSERT INTO stop_times VALUES ('T001', 'S003', 3, '08:20:00', '08:20:00', 0, 0, '西賀茂車庫');
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const p = tripPatterns['test:p1'];
    expect(p.stops[0].sh).toBe('北大路BT・出町柳駅');
    expect(p.stops[1].sh).toBe('出町柳駅');
    expect(p.stops[2].sh).toBe('西賀茂車庫');
  });

  it('creates separate patterns when stop_headsign differs but stop sequence is the same', () => {
    // Same route, same stops, but different stop_headsign at S001
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, '永福町');
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, '峰');
      INSERT INTO stop_times VALUES ('T002', 'S002', 2, '09:10:00', '09:10:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    // Must be 2 separate patterns because stop_headsign differs
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    const patterns = Object.values(tripPatterns);
    const shs = patterns.map((p) => p.stops[0].sh).sort();
    expect(shs).toEqual(['峰', '永福町']);
  });

  it('does not conflate patterns when stop_headsign contains commas', () => {
    // stop_headsign is free text and may contain commas.
    // Pattern key must use delimiter-safe encoding (JSON.stringify)
    // so that ["A,B", "C"] and ["A", "B,C"] produce different keys.
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, 'A,B');
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, 'C');
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, 'A');
      INSERT INTO stop_times VALUES ('T002', 'S002', 2, '09:10:00', '09:10:00', 0, 0, 'B,C');
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    // Must be 2 separate patterns — comma in headsign must not cause conflation
    expect(Object.keys(tripPatterns)).toHaveLength(2);
    const patterns = Object.values(tripPatterns);
    const p1 = patterns.find((p) => p.stops[0].sh === 'A,B')!;
    const p2 = patterns.find((p) => p.stops[0].sh === 'A')!;
    expect(p1.stops[1].sh).toBe('C');
    expect(p2.stops[1].sh).toBe('B,C');
  });

  it('uses first trip stop_headsign as representative for same-pattern trips', () => {
    // All trips in the same pattern should have the same stop_headsign at each stop
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, '渋谷駅');
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0, '渋谷駅');
      INSERT INTO stop_times VALUES ('T002', 'S002', 2, '09:10:00', '09:10:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const patternIds = Object.keys(tripPatterns);
    expect(patternIds).toHaveLength(1);
    const p = tripPatterns[patternIds[0]];
    expect(p.stops[0].sh).toBe('渋谷駅');
    expect(p.stops[1].sh).toBeUndefined();
  });
});
