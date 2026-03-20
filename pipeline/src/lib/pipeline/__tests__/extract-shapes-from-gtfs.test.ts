/**
 * Tests for extractShapes function.
 *
 * Uses an in-memory SQLite database populated with minimal GTFS test data
 * to verify shape extraction produces correct JSON output.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractShapes } from '../extract-shapes-from-gtfs';

// ---------------------------------------------------------------------------
// Test DB setup
// ---------------------------------------------------------------------------

let db: Database.Database;

/** Create minimal schema tables needed for testing. */
function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE trips (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT NOT NULL,
      service_id TEXT NOT NULL,
      shape_id TEXT
    );
    CREATE TABLE shapes (
      shape_id TEXT NOT NULL,
      shape_pt_lat REAL NOT NULL,
      shape_pt_lon REAL NOT NULL,
      shape_pt_sequence INTEGER NOT NULL,
      shape_dist_traveled REAL
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

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('extractShapes', () => {
  it('returns empty object when no shapes exist', () => {
    const result = extractShapes(db, 'test');
    expect(result).toEqual({});
  });

  it('returns shapes grouped by prefixed route_id', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, shape_id)
      VALUES ('t1', 'R1', 'weekday', 'S1');

      INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence)
      VALUES ('S1', 35.68, 139.76, 1),
             ('S1', 35.69, 139.77, 2);
    `);

    const result = extractShapes(db, 'pfx');
    expect(result).toHaveProperty('pfx:R1');
    expect(result['pfx:R1']).toHaveLength(1);
    expect(result['pfx:R1'][0]).toEqual([
      [35.68, 139.76],
      [35.69, 139.77],
    ]);
  });

  it('rounds coordinates to 5 decimal places', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, shape_id)
      VALUES ('t1', 'R1', 'weekday', 'S1');

      INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence)
      VALUES ('S1', 35.123456789, 139.987654321, 1);
    `);

    const result = extractShapes(db, 'pfx');
    const [[lat, lon]] = result['pfx:R1'][0];
    expect(lat).toBe(35.12346);
    expect(lon).toBe(139.98765);
  });

  it('handles multiple shape_ids per route (multiple polylines)', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, shape_id)
      VALUES ('t1', 'R1', 'weekday', 'S1'),
             ('t2', 'R1', 'weekday', 'S2');

      INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence)
      VALUES ('S1', 35.68, 139.76, 1),
             ('S1', 35.69, 139.77, 2),
             ('S2', 35.70, 139.78, 1),
             ('S2', 35.71, 139.79, 2);
    `);

    const result = extractShapes(db, 'pfx');
    expect(result['pfx:R1']).toHaveLength(2);
    expect(result['pfx:R1'][0]).toEqual([
      [35.68, 139.76],
      [35.69, 139.77],
    ]);
    expect(result['pfx:R1'][1]).toEqual([
      [35.7, 139.78],
      [35.71, 139.79],
    ]);
  });

  it('skips empty shape_id values', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, shape_id)
      VALUES ('t1', 'R1', 'weekday', ''),
             ('t2', 'R2', 'weekday', NULL);
    `);

    const result = extractShapes(db, 'pfx');
    expect(result).toEqual({});
  });

  it('includes shape_dist_traveled as third element when present', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, shape_id)
      VALUES ('t1', 'R1', 'weekday', 'S1');

      INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled)
      VALUES ('S1', 35.68, 139.76, 1, 0),
             ('S1', 35.69, 139.77, 2, 150.5),
             ('S1', 35.70, 139.78, 3, 320.8);
    `);

    const result = extractShapes(db, 'pfx');
    expect(result['pfx:R1'][0]).toEqual([
      [35.68, 139.76, 0],
      [35.69, 139.77, 150.5],
      [35.7, 139.78, 320.8],
    ]);
  });

  it('omits third element when shape_dist_traveled is NULL', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, shape_id)
      VALUES ('t1', 'R1', 'weekday', 'S1');

      INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled)
      VALUES ('S1', 35.68, 139.76, 1, NULL);
    `);

    const result = extractShapes(db, 'pfx');
    // [lat, lon] only — no third element
    expect(result['pfx:R1'][0][0]).toEqual([35.68, 139.76]);
    expect(result['pfx:R1'][0][0]).toHaveLength(2);
  });

  it('handles mix of rows with and without shape_dist_traveled', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, shape_id)
      VALUES ('t1', 'R1', 'weekday', 'S1');

      INSERT INTO shapes (shape_id, shape_pt_lat, shape_pt_lon, shape_pt_sequence, shape_dist_traveled)
      VALUES ('S1', 35.68, 139.76, 1, 0),
             ('S1', 35.69, 139.77, 2, NULL),
             ('S1', 35.70, 139.78, 3, 300.0);
    `);

    const result = extractShapes(db, 'pfx');
    expect(result['pfx:R1'][0]).toEqual([
      [35.68, 139.76, 0],
      [35.69, 139.77],
      [35.7, 139.78, 300.0],
    ]);
  });
});
