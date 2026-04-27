/**
 * Tests for v2-extract-timetable.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

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

  it('pure pass-through stop (NULL dep AND NULL arr) is excluded from pattern.stops and timetable', () => {
    // Pre-#154 behavior kept S002 in pattern.stops but skipped it from
    // timetable, leaving the two arrays misaligned. Post-#154 the pattern
    // key is built from served stops only, so S002 is excluded from both.
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, NULL, NULL, 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S003', 3, '08:10:00', '08:10:00', 0, 0, NULL);
    `);

    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns['test:p1'].stops).toEqual([{ id: 'test:S001' }, { id: 'test:S003' }]);
    expect(timetable['test:S002']).toBeUndefined();
    // si values reflect the served-only positions: S001=0, S003=1.
    expect(timetable['test:S001'][0].si).toBe(0);
    expect(timetable['test:S003'][0].si).toBe(1);
  });

  it('NULL departure_time stop is excluded from both pattern.stops and timetable', () => {
    // Same shape as the pure pass-through case, but S002 keeps an arrival_time.
    // Per Issue #154 we use `departure_time != null` as the served signal,
    // so S002 is still excluded (pattern.stops index must match timetable.si).
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, NULL, '08:05:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S003', 3, '08:10:00', '08:10:00', 0, 0, NULL);
    `);

    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns['test:p1'].stops).toEqual([{ id: 'test:S001' }, { id: 'test:S003' }]);
    expect(timetable['test:S002']).toBeUndefined();
    expect(timetable['test:S001']).toHaveLength(1);
    expect(timetable['test:S003']).toHaveLength(1);
  });

  it('terminal arr-only stop (last stop has NULL dep but valid arr) is excluded from pattern.stops', () => {
    // Edge case noted in the Issue #154 plan: when the *terminal* stop has
    // departure_time = NULL but arrival_time set (drop-off only), the served
    // filter (`departure_time != null`) excludes it from pattern.stops, so
    // the trip's nominal terminus does not appear in the trip stops list.
    // Real GTFS feeds usually populate dep == arr at terminals, so this
    // should be rare; this test pins the contract anyway to catch regressions.
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:05:00', '08:05:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', 'S003', 3, NULL, '08:10:00', 0, 0, NULL);
    `);

    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns['test:p1'].stops).toEqual([{ id: 'test:S001' }, { id: 'test:S002' }]);
    expect(timetable['test:S003']).toBeUndefined();
    expect(timetable['test:S001']).toHaveLength(1);
    expect(timetable['test:S002']).toHaveLength(1);
    // The included stops sit at si=0 and si=1 — the served-only sequence,
    // not the raw stop_sequence (which would have made S002 si=1, S003 si=2).
    expect(timetable['test:S001'][0].si).toBe(0);
    expect(timetable['test:S002'][0].si).toBe(1);
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

  describe('duplicate stop_id within pattern (Issue #47)', () => {
    it('pure circular: origin and terminal share stop_id — splits by si', () => {
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
      // S001 appears at array positions 0 and 2 → 2 separate groups distinguished by si
      const groups = timetable['test:S001'];
      expect(groups).toHaveLength(2);
      expect(groups.map((g) => g.si)).toEqual([0, 2]);
      expect(groups[0].d['test:WD']).toEqual([480]);
      expect(groups[1].d['test:WD']).toEqual([500]);
      // Interior stop has only one group at si=1
      expect(timetable['test:S002']).toHaveLength(1);
      expect(timetable['test:S002'][0].si).toBe(1);
    });

    it('6-shape: stop at non-terminal middle position emits 2 groups', () => {
      // S001 at index 0 (origin) and index 2 (mid-trip), S003 at terminal (index 3)
      db.exec(`
        INSERT INTO trips VALUES ('T001', 'R001', 'WD', '光が丘', 0);
        INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:05:00', '08:05:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S001', 3, '08:10:00', '08:10:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S003', 4, '08:15:00', '08:15:00', 0, 0, NULL);
      `);

      const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
      const p = Object.values(tripPatterns)[0];
      expect(p.stops).toEqual([
        { id: 'test:S001' },
        { id: 'test:S002' },
        { id: 'test:S001' },
        { id: 'test:S003' },
      ]);

      // S001 splits into si=0 (origin) and si=2 (mid-trip pass-through)
      const groups = timetable['test:S001'];
      expect(groups).toHaveLength(2);
      expect(groups.map((g) => g.si)).toEqual([0, 2]);
      expect(groups[0].d['test:WD']).toEqual([480]);
      expect(groups[1].d['test:WD']).toEqual([490]);
    });

    it('complex multi-duplicate: 2 different stops each at 2 positions', () => {
      // Pattern: S001 → S002 → S003 → S001 → S002 → S004
      // S001 at [0, 3], S002 at [1, 4]
      db.exec(`
        INSERT INTO trips VALUES ('T001', 'R001', 'WD', 'S004', 0);
        INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:02:00', '08:02:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S003', 3, '08:04:00', '08:04:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S001', 4, '08:06:00', '08:06:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S002', 5, '08:08:00', '08:08:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S004', 6, '08:10:00', '08:10:00', 0, 0, NULL);
      `);

      const { timetable } = extractTripPatternsAndTimetable(db, 'test');
      // S001 at positions 0 and 3
      expect(timetable['test:S001']).toHaveLength(2);
      expect(timetable['test:S001'].map((g) => g.si)).toEqual([0, 3]);
      // S002 at positions 1 and 4
      expect(timetable['test:S002']).toHaveLength(2);
      expect(timetable['test:S002'].map((g) => g.si)).toEqual([1, 4]);
      // S003 only at position 2
      expect(timetable['test:S003']).toHaveLength(1);
      expect(timetable['test:S003'][0].si).toBe(2);
      // S004 only at position 5
      expect(timetable['test:S004']).toHaveLength(1);
      expect(timetable['test:S004'][0].si).toBe(5);
    });

    it('consecutive duplicate (dwell): same stop_id at adjacent positions', () => {
      // dwell representation: S002 appears consecutively at positions 1 and 2
      db.exec(`
        INSERT INTO trips VALUES ('T001', 'R001', 'WD', 'S003', 0);
        INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:05:00', '08:05:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S002', 3, '08:05:00', '08:05:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('T001', 'S003', 4, '08:10:00', '08:10:00', 0, 0, NULL);
      `);

      const { timetable } = extractTripPatternsAndTimetable(db, 'test');
      // S002 at consecutive positions 1 and 2 → still emitted as 2 separate groups
      const groups = timetable['test:S002'];
      expect(groups).toHaveLength(2);
      expect(groups.map((g) => g.si)).toEqual([1, 2]);
      // Both groups have the same departure time (dwell = 0)
      expect(groups[0].d['test:WD']).toEqual([485]);
      expect(groups[1].d['test:WD']).toEqual([485]);
    });
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

  it('does not conflate patterns when stop_id contains commas', () => {
    // GTFS stop_id is "any UTF-8 characters" so commas are valid.
    // Pattern key must use delimiter-safe encoding (JSON.stringify)
    // so that ["S,1","2"] and ["S","1,2"] produce different keys.
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', 'X', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', 'X', 0);
      INSERT INTO stop_times VALUES ('T001', 'S,1', 1, '08:00:00', '08:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T001', '2', 2, '08:10:00', '08:10:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', 'S', 1, '09:00:00', '09:00:00', 0, 0, NULL);
      INSERT INTO stop_times VALUES ('T002', '1,2', 2, '09:10:00', '09:10:00', 0, 0, NULL);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    // ["S,1","2"] vs ["S","1,2"] — must be 2 separate patterns
    expect(Object.keys(tripPatterns)).toHaveLength(2);
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

  // -------------------------------------------------------------------------
  // Issue #154: served-only pattern key tests
  // -------------------------------------------------------------------------

  describe('served-only pattern key (Issue #154)', () => {
    it('splits express vs local trips with same raw stop sequence into separate patterns', () => {
      // Both trips list S1..S5 in stop_times, but the express trip skips S2
      // and S4 (NULL departure_time). Pre-#154 they shared a pattern and the
      // per-stop d[serviceId] arrays became inconsistent across stops.
      // Post-#154 they form two patterns with served stops [S1,S3,S5] and
      // [S1,S2,S3,S4,S5] respectively.
      db.exec(`
        INSERT INTO trips VALUES ('EXP', 'R001', 'WD', '快速', 0);
        INSERT INTO trips VALUES ('LOC', 'R001', 'WD', '快速', 0);
        INSERT INTO stop_times VALUES ('EXP', 'S1', 1, '08:00:00', '08:00:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('EXP', 'S2', 2, NULL, NULL, 0, 0, NULL);
        INSERT INTO stop_times VALUES ('EXP', 'S3', 3, '08:05:00', '08:05:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('EXP', 'S4', 4, NULL, NULL, 0, 0, NULL);
        INSERT INTO stop_times VALUES ('EXP', 'S5', 5, '08:10:00', '08:10:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S1', 1, '09:00:00', '09:00:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S2', 2, '09:02:00', '09:02:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S3', 3, '09:04:00', '09:04:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S4', 4, '09:06:00', '09:06:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S5', 5, '09:08:00', '09:08:00', 0, 0, NULL);
      `);

      const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');

      expect(Object.keys(tripPatterns)).toHaveLength(2);
      const patterns = Object.values(tripPatterns);
      const expressPattern = patterns.find((p) => p.stops.length === 3)!;
      const localPattern = patterns.find((p) => p.stops.length === 5)!;
      expect(expressPattern).toBeDefined();
      expect(localPattern).toBeDefined();
      expect(expressPattern.stops.map((s) => s.id)).toEqual(['test:S1', 'test:S3', 'test:S5']);
      expect(localPattern.stops.map((s) => s.id)).toEqual([
        'test:S1',
        'test:S2',
        'test:S3',
        'test:S4',
        'test:S5',
      ]);

      // S1 sits in both patterns -> 2 timetable groups, each with 1 trip.
      const s1Groups = timetable['test:S1'];
      expect(s1Groups).toHaveLength(2);
      for (const g of s1Groups) {
        expect(g.d['test:WD']).toHaveLength(1);
      }
      // S2 only sits in the local pattern.
      expect(timetable['test:S2']).toHaveLength(1);
      expect(timetable['test:S2'][0].d['test:WD']).toHaveLength(1);
    });

    it('through-running mid-pattern skip splits into separate patterns', () => {
      // Same route/headsign/direction; trip B skips S3. Approximates the
      // toaran case where express services through-run and skip Asakusa-line
      // stations that local services serve.
      db.exec(`
        INSERT INTO trips VALUES ('TA', 'R001', 'WD', '成田空港', 0);
        INSERT INTO trips VALUES ('TB', 'R001', 'WD', '成田空港', 0);
        INSERT INTO stop_times VALUES ('TA', 'S1', 1, '08:00:00', '08:00:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('TA', 'S2', 2, '08:05:00', '08:05:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('TA', 'S3', 3, '08:10:00', '08:10:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('TA', 'S4', 4, '08:15:00', '08:15:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('TB', 'S1', 1, '09:00:00', '09:00:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('TB', 'S2', 2, '09:05:00', '09:05:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('TB', 'S3', 3, NULL, NULL, 0, 0, NULL);
        INSERT INTO stop_times VALUES ('TB', 'S4', 4, '09:13:00', '09:13:00', 0, 0, NULL);
      `);

      const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
      expect(Object.keys(tripPatterns)).toHaveLength(2);
      // Within each (patId, serviceId), every stop in the pattern has the
      // same d[serviceId].length.
      for (const [patId, pattern] of Object.entries(tripPatterns)) {
        const lengths: number[] = [];
        for (const stop of pattern.stops) {
          const groups = timetable[stop.id];
          const group = groups.find((g) => g.tp === patId);
          expect(group).toBeDefined();
          lengths.push(group!.d['test:WD'].length);
        }
        const unique = [...new Set(lengths)];
        expect(unique).toHaveLength(1);
      }
    });

    it('cross-stop d/a length consistency within (patternId, serviceId)', () => {
      // Re-use the express + local fixture from the first test and assert
      // that for each pattern, every stop has the same d/a length. This is
      // the structural invariant Issue #154 directly targets.
      db.exec(`
        INSERT INTO trips VALUES ('EXP', 'R001', 'WD', '快速', 0);
        INSERT INTO trips VALUES ('LOC', 'R001', 'WD', '快速', 0);
        INSERT INTO stop_times VALUES ('EXP', 'S1', 1, '08:00:00', '08:00:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('EXP', 'S2', 2, NULL, NULL, 0, 0, NULL);
        INSERT INTO stop_times VALUES ('EXP', 'S3', 3, '08:05:00', '08:05:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('EXP', 'S4', 4, NULL, NULL, 0, 0, NULL);
        INSERT INTO stop_times VALUES ('EXP', 'S5', 5, '08:10:00', '08:10:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S1', 1, '09:00:00', '09:00:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S2', 2, '09:02:00', '09:02:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S3', 3, '09:04:00', '09:04:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S4', 4, '09:06:00', '09:06:00', 0, 0, NULL);
        INSERT INTO stop_times VALUES ('LOC', 'S5', 5, '09:08:00', '09:08:00', 0, 0, NULL);
      `);

      const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
      for (const [patId, pattern] of Object.entries(tripPatterns)) {
        const dLengths: number[] = [];
        const aLengths: number[] = [];
        for (const stop of pattern.stops) {
          const group = timetable[stop.id].find((g) => g.tp === patId)!;
          dLengths.push(group.d['test:WD'].length);
          aLengths.push(group.a['test:WD'].length);
        }
        expect([...new Set(dLengths)]).toHaveLength(1);
        expect([...new Set(aLengths)]).toHaveLength(1);
        expect(dLengths[0]).toBe(aLengths[0]);
      }
    });

    it('served-only filter keeps stop_headsign attached to the correct stop (regression guard)', () => {
      // The pre-#154 code read sh from refTrip.stopHeadsigns indexed by raw
      // position. Once pattern.stops becomes served-only, that raw index
      // misaligns and sh would attach to the wrong stop. This test pins the
      // fix that step 5 reads sh from the served-only group field instead.
      db.exec(`
        INSERT INTO trips VALUES ('T001', 'R001', 'WD', '', 0);
        INSERT INTO stop_times VALUES ('T001', 'S1', 1, '08:00:00', '08:00:00', 0, 0, 'A');
        INSERT INTO stop_times VALUES ('T001', 'S2', 2, NULL, NULL, 0, 0, 'X');
        INSERT INTO stop_times VALUES ('T001', 'S3', 3, '08:10:00', '08:10:00', 0, 0, 'C');
      `);

      const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
      const p = tripPatterns['test:p1'];
      expect(p.stops).toEqual([
        { id: 'test:S1', sh: 'A' },
        { id: 'test:S3', sh: 'C' },
      ]);
      // Specifically: S3's sh must be 'C' (its own value), not 'X' (the
      // pass-through stop's value that would leak in if raw index was used).
      expect(p.stops[1].sh).toBe('C');
    });

    it('skips trips where all stops have NULL departure_time and emits a warning', () => {
      // A trip with no served stops would otherwise produce a zero-length
      // pattern.stops, which downstream consumers cannot meaningfully use.
      // Check both behaviors: the trip is dropped and the warning is emitted.
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
      try {
        db.exec(`
          INSERT INTO trips VALUES ('EMPTY', 'R001', 'WD', '回送', 0);
          INSERT INTO trips VALUES ('NORMAL', 'R001', 'WD', '渋谷', 0);
          INSERT INTO stop_times VALUES ('EMPTY', 'S1', 1, NULL, NULL, 0, 0, NULL);
          INSERT INTO stop_times VALUES ('EMPTY', 'S2', 2, NULL, NULL, 0, 0, NULL);
          INSERT INTO stop_times VALUES ('EMPTY', 'S3', 3, NULL, NULL, 0, 0, NULL);
          INSERT INTO stop_times VALUES ('NORMAL', 'S1', 1, '09:00:00', '09:00:00', 0, 0, NULL);
          INSERT INTO stop_times VALUES ('NORMAL', 'S2', 2, '09:05:00', '09:05:00', 0, 0, NULL);
        `);

        const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
        // Only the normal trip's pattern is emitted.
        expect(Object.keys(tripPatterns)).toHaveLength(1);
        expect(tripPatterns['test:p1'].stops).toEqual([{ id: 'test:S1' }, { id: 'test:S2' }]);

        // Warning fires once with the skipped count.
        const warnings = warnSpy.mock.calls
          .map((args) => String(args[0]))
          .filter((msg) => msg.includes('trips skipped (all stops have NULL departure_time)'));
        expect(warnings).toHaveLength(1);
        expect(warnings[0]).toContain('1 trips skipped');
      } finally {
        warnSpy.mockRestore();
      }
    });
  });
});
