/**
 * Tests for v2-extract-timetable.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractTripPatternsAndTimetable } from '../lib/gtfs/extract-timetable';

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
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0);
      INSERT INTO stop_times VALUES ('T002', 'S002', 2, '09:10:00', '09:10:00', 0, 0);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const patternIds = Object.keys(tripPatterns);
    expect(patternIds).toHaveLength(1);
    expect(tripPatterns[patternIds[0]].stops).toEqual(['test:S001', 'test:S002']);
  });

  it('creates separate patterns for different stop sequences', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0);
      INSERT INTO stop_times VALUES ('T002', 'S003', 2, '09:10:00', '09:10:00', 0, 0);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(Object.keys(tripPatterns)).toHaveLength(2);
  });

  it('assigns deterministic pattern IDs: {prefix}:p{1-indexed}', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const ids = Object.keys(tripPatterns);
    expect(ids).toHaveLength(1);
    expect(ids[0]).toBe('test:p1');
  });

  it('pattern includes route, headsign, direction, stops', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 1);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:10:00', 0, 0);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    const p = tripPatterns['test:p1'];
    expect(p.v).toBe(2);
    expect(p.r).toBe('test:R001');
    expect(p.h).toBe('渋谷');
    expect(p.dir).toBe(1);
    expect(p.stops).toEqual(['test:S001', 'test:S002']);
  });

  it('omits dir when direction_id is NULL', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', NULL);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0);
    `);

    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    expect(tripPatterns['test:p1'].dir).toBeUndefined();
  });

  it('timetable d/a/pt/dt are positionally aligned', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '07:59:00', 0, 1);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, '08:10:00', '08:09:00', 2, 3);
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
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', NULL, 0, 0);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    const g = timetable['test:S001'][0];
    expect(g.d['test:WD']).toEqual([480]);
    expect(g.a['test:WD']).toEqual([480]);
  });

  it('handles overnight departures (25:00 etc.)', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '25:30:00', '25:30:00', 0, 0);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(timetable['test:S001'][0].d['test:WD']).toEqual([1530]);
  });

  it('multiple service_ids share the same pattern', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO trips VALUES ('T002', 'R001', 'HD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '09:00:00', '09:00:00', 0, 0);
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
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '09:00:00', '09:00:00', 0, 0);
      INSERT INTO stop_times VALUES ('T002', 'S001', 1, '08:00:00', '08:00:00', 0, 0);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    expect(timetable['test:S001'][0].d['test:WD']).toEqual([480, 540]);
  });

  it('GTFS always includes pt/dt (even when all values are 0)', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    const g = timetable['test:S001'][0];
    // pt/dt should be present even though all values are 0
    expect(g.pt).toBeDefined();
    expect(g.dt).toBeDefined();
    expect(g.pt!['test:WD']).toEqual([0]);
    expect(g.dt!['test:WD']).toEqual([0]);
  });

  it('skips stop_times with NULL departure_time', () => {
    db.exec(`
      INSERT INTO trips VALUES ('T001', 'R001', 'WD', '渋谷', 0);
      INSERT INTO stop_times VALUES ('T001', 'S001', 1, '08:00:00', '08:00:00', 0, 0);
      INSERT INTO stop_times VALUES ('T001', 'S002', 2, NULL, '08:05:00', 0, 0);
      INSERT INTO stop_times VALUES ('T001', 'S003', 3, '08:10:00', '08:10:00', 0, 0);
    `);

    const { timetable } = extractTripPatternsAndTimetable(db, 'test');
    // S002 should have no timetable entry (departure is NULL)
    expect(timetable['test:S002']).toBeUndefined();
    // S001 and S003 should have entries
    expect(timetable['test:S001']).toHaveLength(1);
    expect(timetable['test:S003']).toHaveLength(1);
  });
});
