/**
 * Tests for v2-extract-stops.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractStopsV2 } from '../extract-stops';

let db: Database.Database;

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE stops (
      stop_id TEXT PRIMARY KEY,
      stop_name TEXT NOT NULL,
      stop_lat REAL NOT NULL,
      stop_lon REAL NOT NULL,
      location_type INTEGER DEFAULT 0,
      wheelchair_boarding INTEGER,
      parent_station TEXT,
      platform_code TEXT
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

describe('extractStopsV2', () => {
  it('returns empty array when no stops exist', () => {
    const result = extractStopsV2(db, 'test');
    expect(result).toEqual([]);
  });

  it('returns stops with v:2 and prefixed IDs', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type)
      VALUES ('S001', '新橋', 35.6658, 139.7584, 0);
    `);

    const result = extractStopsV2(db, 'test');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      v: 2,
      i: 'test:S001',
      n: '新橋',
      a: 35.6658,
      o: 139.7584,
      l: 0,
    });
  });

  it('does NOT filter by location_type — includes parent stations (l=1)', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type)
      VALUES ('S001', '新橋駅', 35.6658, 139.7584, 1),
             ('S002', '新橋1番', 35.6659, 139.7585, 0);
    `);

    const result = extractStopsV2(db, 'test');
    expect(result).toHaveLength(2);
    expect(result[0].l).toBe(1);
    expect(result[1].l).toBe(0);
  });

  it('includes wheelchair_boarding when present', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, wheelchair_boarding)
      VALUES ('S001', '新橋', 35.6658, 139.7584, 1);
    `);

    const result = extractStopsV2(db, 'test');
    expect(result[0].wb).toBe(1);
  });

  it('omits wheelchair_boarding when NULL', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon)
      VALUES ('S001', '新橋', 35.6658, 139.7584);
    `);

    const result = extractStopsV2(db, 'test');
    expect(result[0].wb).toBeUndefined();
  });

  it('includes wheelchair_boarding when 0 (no info)', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, wheelchair_boarding)
      VALUES ('S001', '新橋', 35.6658, 139.7584, 0);
    `);

    const result = extractStopsV2(db, 'test');
    expect(result[0].wb).toBe(0);
  });

  it('includes parent_station as prefixed FK', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station)
      VALUES ('P001', '新橋駅', 35.6658, 139.7584, 1, NULL),
             ('S001', '新橋1番', 35.6659, 139.7585, 0, 'P001');
    `);

    const result = extractStopsV2(db, 'test');
    const child = result.find((s) => s.i === 'test:S001')!;
    const parent = result.find((s) => s.i === 'test:P001')!;
    expect(child.ps).toBe('test:P001');
    expect(parent.ps).toBeUndefined();
  });

  it('includes platform_code when present', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, platform_code)
      VALUES ('S001', '新橋', 35.6658, 139.7584, '1');
    `);

    const result = extractStopsV2(db, 'test');
    expect(result[0].pc).toBe('1');
  });

  it('omits platform_code when NULL', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon)
      VALUES ('S001', '新橋', 35.6658, 139.7584);
    `);

    const result = extractStopsV2(db, 'test');
    expect(result[0].pc).toBeUndefined();
  });

  it('includes location_type=2 (entrance/exit) without filtering', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type, parent_station)
      VALUES ('P001', '新橋駅', 35.6658, 139.7584, 1, NULL),
             ('S001', '新橋1番', 35.6659, 139.7585, 0, 'P001'),
             ('E001', '新橋A出口', 35.6660, 139.7586, 2, 'P001');
    `);

    const result = extractStopsV2(db, 'test');
    expect(result).toHaveLength(3);
    const entrance = result.find((s) => s.i === 'test:E001')!;
    expect(entrance.l).toBe(2);
    expect(entrance.ps).toBe('test:P001');
  });

  it('orders stops by stop_id', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon)
      VALUES ('C', '駅C', 35.68, 139.78),
             ('A', '駅A', 35.66, 139.76),
             ('B', '駅B', 35.67, 139.77);
    `);

    const result = extractStopsV2(db, 'test');
    expect(result.map((s) => s.i)).toEqual(['test:A', 'test:B', 'test:C']);
  });
});
