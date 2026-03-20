/**
 * Tests for v2-extract-lookup.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractLookupV2 } from '../extract-lookup';

let db: Database.Database;

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE stops (
      stop_id TEXT PRIMARY KEY,
      stop_name TEXT NOT NULL,
      stop_lat REAL NOT NULL,
      stop_lon REAL NOT NULL,
      location_type INTEGER DEFAULT 0,
      stop_url TEXT,
      stop_desc TEXT
    );
    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY,
      route_short_name TEXT,
      route_long_name TEXT,
      route_type INTEGER NOT NULL,
      route_url TEXT
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

describe('extractLookupV2', () => {
  it('returns empty object when no URLs or descriptions exist', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon) VALUES ('S001', '新橋', 35.66, 139.75);
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type) VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractLookupV2(db, 'test');
    expect(result.stopUrls).toBeUndefined();
    expect(result.routeUrls).toBeUndefined();
    expect(result.stopDescs).toBeUndefined();
  });

  it('extracts stop_url keyed by prefixed stop_id', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, stop_url)
      VALUES ('S001', '新橋', 35.66, 139.75, 'https://example.com/stops/S001');
    `);

    const result = extractLookupV2(db, 'test');
    expect(result.stopUrls).toEqual({
      'test:S001': 'https://example.com/stops/S001',
    });
  });

  it('extracts route_url keyed by prefixed route_id', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_url)
      VALUES ('R001', 'R1', 'Route 1', 3, 'https://example.com/routes/R001');
    `);

    const result = extractLookupV2(db, 'test');
    expect(result.routeUrls).toEqual({
      'test:R001': 'https://example.com/routes/R001',
    });
  });

  it('extracts stop_desc keyed by prefixed stop_id', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, stop_desc)
      VALUES ('S001', '新橋', 35.66, 139.75, 'JR山手線乗り換え');
    `);

    const result = extractLookupV2(db, 'test');
    expect(result.stopDescs).toEqual({
      'test:S001': 'JR山手線乗り換え',
    });
  });

  it('skips empty strings for URLs and descriptions', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, stop_url, stop_desc)
      VALUES ('S001', '新橋', 35.66, 139.75, '', '');
    `);

    const result = extractLookupV2(db, 'test');
    expect(result.stopUrls).toBeUndefined();
    expect(result.stopDescs).toBeUndefined();
  });

  it('handles mixed: some stops with URLs, some without', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, stop_url)
      VALUES ('S001', '新橋', 35.66, 139.75, 'https://example.com/S001'),
             ('S002', '渋谷', 35.65, 139.70, NULL);
    `);

    const result = extractLookupV2(db, 'test');
    expect(result.stopUrls).toEqual({
      'test:S001': 'https://example.com/S001',
    });
  });

  it('extracts all three lookup types simultaneously', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, stop_url, stop_desc)
      VALUES ('S001', '新橋', 35.66, 139.75, 'https://example.com/S001', 'JR乗り換え'),
             ('S002', '渋谷', 35.65, 139.70, 'https://example.com/S002', NULL);
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_url)
      VALUES ('R001', 'R1', 'Route 1', 3, 'https://example.com/R001');
    `);

    const result = extractLookupV2(db, 'test');
    expect(result.stopUrls).toEqual({
      'test:S001': 'https://example.com/S001',
      'test:S002': 'https://example.com/S002',
    });
    expect(result.routeUrls).toEqual({
      'test:R001': 'https://example.com/R001',
    });
    expect(result.stopDescs).toEqual({
      'test:S001': 'JR乗り換え',
    });
  });

  it('skips NULL route_url', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_url)
      VALUES ('R001', 'R1', 'Route 1', 3, NULL),
             ('R002', 'R2', 'Route 2', 3, 'https://example.com/R002');
    `);

    const result = extractLookupV2(db, 'test');
    expect(result.routeUrls).toEqual({
      'test:R002': 'https://example.com/R002',
    });
  });

  it('skips empty string route_url', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_url)
      VALUES ('R001', 'R1', 'Route 1', 3, '');
    `);

    const result = extractLookupV2(db, 'test');
    expect(result.routeUrls).toBeUndefined();
  });

  it('extracts multiple stop_desc entries', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, stop_desc)
      VALUES ('S001', '新橋', 35.66, 139.75, 'JR山手線乗り換え'),
             ('S002', '渋谷', 35.65, 139.70, 'JR/京王/東急乗り換え');
    `);

    const result = extractLookupV2(db, 'test');
    expect(Object.keys(result.stopDescs!)).toHaveLength(2);
    expect(result.stopDescs!['test:S001']).toBe('JR山手線乗り換え');
    expect(result.stopDescs!['test:S002']).toBe('JR/京王/東急乗り換え');
  });
});
