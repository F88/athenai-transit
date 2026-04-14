/**
 * Integration tests for build-shapes-from-gtfs.ts ShapesBundle assembly.
 *
 * Creates a minimal GTFS SQLite database in memory, extracts shapes,
 * writes a ShapesBundle, and verifies the output structure.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { ShapesBundle } from '../../../../../src/types/data/transit-v2-json';
import { extractShapes } from '../../../../src/lib/pipeline/extract-shapes-from-gtfs';
import { extractRoutesV2 } from '../../../../src/lib/pipeline/app-data-v2/gtfs/extract-routes';
import { writeShapesBundle } from '../../../../src/lib/pipeline/app-data-v2/bundle-writer';

const TMP_DIR = join(import.meta.dirname, '.tmp-build-shapes-gtfs-test');

/** Minimal schema with routes, trips, and shapes tables. */
function createMinimalShapesDb(): Database.Database {
  const db = new Database(':memory:');
  db.exec(`
    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY, agency_id TEXT, route_short_name TEXT,
      route_long_name TEXT, route_type INTEGER NOT NULL,
      route_color TEXT, route_text_color TEXT, route_desc TEXT, route_url TEXT
    );
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

    INSERT INTO routes VALUES ('R1', 'A1', '01', 'Route One', 3, NULL, NULL, NULL, NULL);
    INSERT INTO routes VALUES ('R2', 'A1', '02', 'Route Two', 3, NULL, NULL, NULL, NULL);

    INSERT INTO trips VALUES ('T1', 'R1', 'WD', 'S1');
    INSERT INTO trips VALUES ('T2', 'R1', 'WD', 'S2');
    INSERT INTO trips VALUES ('T3', 'R2', 'WD', 'S3');

    INSERT INTO shapes VALUES ('S1', 35.68, 139.76, 1, NULL);
    INSERT INTO shapes VALUES ('S1', 35.69, 139.77, 2, NULL);
    INSERT INTO shapes VALUES ('S2', 35.70, 139.78, 1, NULL);
    INSERT INTO shapes VALUES ('S2', 35.71, 139.79, 2, NULL);
    INSERT INTO shapes VALUES ('S3', 35.66, 139.74, 1, NULL);
    INSERT INTO shapes VALUES ('S3', 35.67, 139.75, 2, NULL);
  `);
  return db;
}

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('GTFS ShapesBundle assembly', () => {
  it('produces a valid ShapesBundle from a minimal GTFS database', () => {
    const db = createMinimalShapesDb();
    const shapes = extractShapes(db, 'test');
    db.close();

    expect(Object.keys(shapes)).toHaveLength(2); // R1, R2
    expect(shapes['test:R1']).toHaveLength(2); // S1, S2
    expect(shapes['test:R2']).toHaveLength(1); // S3

    // Write and read back
    const outDir = join(TMP_DIR, 'out', 'test');
    writeShapesBundle(outDir, shapes);

    const filePath = join(outDir, 'shapes.json');
    expect(existsSync(filePath)).toBe(true);

    const bundle = JSON.parse(readFileSync(filePath, 'utf-8')) as ShapesBundle;
    expect(bundle.bundle_version).toBe(3);
    expect(bundle.kind).toBe('shapes');
    expect(bundle.shapes.v).toBe(2);
    expect(Object.keys(bundle.shapes.data)).toHaveLength(2);
    expect(bundle.shapes.data['test:R1']).toHaveLength(2);
    expect(bundle.shapes.data['test:R2']).toHaveLength(1);
  });

  it('includes shape_dist_traveled when present', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE trips (
        trip_id TEXT PRIMARY KEY, route_id TEXT NOT NULL,
        service_id TEXT NOT NULL, shape_id TEXT
      );
      CREATE TABLE shapes (
        shape_id TEXT NOT NULL, shape_pt_lat REAL NOT NULL,
        shape_pt_lon REAL NOT NULL, shape_pt_sequence INTEGER NOT NULL,
        shape_dist_traveled REAL
      );

      INSERT INTO trips VALUES ('T1', 'R1', 'WD', 'S1');
      INSERT INTO shapes VALUES ('S1', 35.68, 139.76, 1, 0);
      INSERT INTO shapes VALUES ('S1', 35.69, 139.77, 2, 150.5);
    `);

    const shapes = extractShapes(db, 'test');
    db.close();

    const outDir = join(TMP_DIR, 'out', 'test');
    writeShapesBundle(outDir, shapes);

    const bundle = JSON.parse(readFileSync(join(outDir, 'shapes.json'), 'utf-8')) as ShapesBundle;

    const polyline = bundle.shapes.data['test:R1'][0];
    expect(polyline[0]).toEqual([35.68, 139.76, 0]);
    expect(polyline[1]).toEqual([35.69, 139.77, 150.5]);
  });

  it('writes empty shapes when no shapes exist', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE trips (
        trip_id TEXT PRIMARY KEY, route_id TEXT NOT NULL,
        service_id TEXT NOT NULL, shape_id TEXT
      );
      CREATE TABLE shapes (
        shape_id TEXT NOT NULL, shape_pt_lat REAL NOT NULL,
        shape_pt_lon REAL NOT NULL, shape_pt_sequence INTEGER NOT NULL,
        shape_dist_traveled REAL
      );
    `);

    const shapes = extractShapes(db, 'test');
    db.close();

    expect(Object.keys(shapes)).toHaveLength(0);

    const outDir = join(TMP_DIR, 'out', 'test');
    writeShapesBundle(outDir, shapes);

    const bundle = JSON.parse(readFileSync(join(outDir, 'shapes.json'), 'utf-8')) as ShapesBundle;
    expect(bundle.shapes.data).toEqual({});
  });

  it('shapes route IDs reference existing routes in the same DB', () => {
    const db = createMinimalShapesDb();
    const prefix = 'test';

    const shapes = extractShapes(db, prefix);
    const routes = extractRoutesV2(db, prefix, {});
    db.close();

    const routeIds = new Set(routes.map((r) => r.i));
    for (const shapeRouteId of Object.keys(shapes)) {
      expect(routeIds.has(shapeRouteId)).toBe(true);
    }
  });

  it('all keys start with the given prefix', () => {
    const db = createMinimalShapesDb();
    const prefix = 'myprefix';

    const shapes = extractShapes(db, prefix);
    db.close();

    for (const key of Object.keys(shapes)) {
      expect(key.startsWith(`${prefix}:`)).toBe(true);
    }
  });

  it('shape_dist_traveled values are non-negative', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE trips (
        trip_id TEXT PRIMARY KEY, route_id TEXT NOT NULL,
        service_id TEXT NOT NULL, shape_id TEXT
      );
      CREATE TABLE shapes (
        shape_id TEXT NOT NULL, shape_pt_lat REAL NOT NULL,
        shape_pt_lon REAL NOT NULL, shape_pt_sequence INTEGER NOT NULL,
        shape_dist_traveled REAL
      );

      INSERT INTO trips VALUES ('T1', 'R1', 'WD', 'S1');
      INSERT INTO shapes VALUES ('S1', 35.68, 139.76, 1, 0);
      INSERT INTO shapes VALUES ('S1', 35.69, 139.77, 2, 100.5);
      INSERT INTO shapes VALUES ('S1', 35.70, 139.78, 3, 250.0);
    `);

    const shapes = extractShapes(db, 'test');
    db.close();

    for (const polylines of Object.values(shapes)) {
      for (const polyline of polylines) {
        for (const point of polyline) {
          if (point.length === 3) {
            expect(point[2]).toBeGreaterThanOrEqual(0);
          }
        }
      }
    }
  });

  it('shape_dist_traveled is monotonically non-decreasing within a shape', () => {
    const db = new Database(':memory:');
    db.exec(`
      CREATE TABLE trips (
        trip_id TEXT PRIMARY KEY, route_id TEXT NOT NULL,
        service_id TEXT NOT NULL, shape_id TEXT
      );
      CREATE TABLE shapes (
        shape_id TEXT NOT NULL, shape_pt_lat REAL NOT NULL,
        shape_pt_lon REAL NOT NULL, shape_pt_sequence INTEGER NOT NULL,
        shape_dist_traveled REAL
      );

      INSERT INTO trips VALUES ('T1', 'R1', 'WD', 'S1');
      INSERT INTO shapes VALUES ('S1', 35.68, 139.76, 1, 0);
      INSERT INTO shapes VALUES ('S1', 35.69, 139.77, 2, 100.0);
      INSERT INTO shapes VALUES ('S1', 35.70, 139.78, 3, 100.0);
      INSERT INTO shapes VALUES ('S1', 35.71, 139.79, 4, 250.0);
    `);

    const shapes = extractShapes(db, 'test');
    db.close();

    for (const polylines of Object.values(shapes)) {
      for (const polyline of polylines) {
        const distances = polyline
          .filter((p): p is [number, number, number] => p.length === 3)
          .map((p) => p[2]);

        for (let i = 1; i < distances.length; i++) {
          expect(distances[i]).toBeGreaterThanOrEqual(distances[i - 1]);
        }
      }
    }
  });
});
