/**
 * Integration tests for build-from-gtfs.ts DataBundle assembly.
 *
 * Creates a minimal GTFS SQLite database in a temp file, runs all
 * extract functions, and verifies the assembled DataBundle structure.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { DataBundle } from '../../../../src/types/data/transit-v2-json';
import type { Provider } from '../../../types/resource-common';
import { writeDataBundle } from '../lib/bundle-writer';
import { extractAgenciesV2 } from '../lib/gtfs/extract-agencies';
import { extractCalendarV2 } from '../lib/gtfs/extract-calendar';
import { extractFeedInfoV2 } from '../lib/gtfs/extract-feed-info';
import { extractLookupV2 } from '../lib/gtfs/extract-lookup';
import { extractRoutesV2 } from '../lib/gtfs/extract-routes';
import { extractStopsV2 } from '../lib/gtfs/extract-stops';
import { extractTripPatternsAndTimetable } from '../lib/gtfs/extract-timetable';
import { extractTranslationsV2 } from '../lib/gtfs/extract-translations';

const TMP_DIR = join(import.meta.dirname, '.tmp-build-gtfs-test');
const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
};

function createMinimalGtfsDb(dbPath: string): void {
  const db = new Database(dbPath);
  db.exec(`
    CREATE TABLE agency (
      agency_id TEXT PRIMARY KEY, agency_name TEXT NOT NULL,
      agency_url TEXT, agency_timezone TEXT, agency_lang TEXT, agency_fare_url TEXT
    );
    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY, agency_id TEXT, route_short_name TEXT,
      route_long_name TEXT, route_type INTEGER NOT NULL,
      route_color TEXT, route_text_color TEXT, route_desc TEXT, route_url TEXT
    );
    CREATE TABLE stops (
      stop_id TEXT PRIMARY KEY, stop_name TEXT NOT NULL,
      stop_lat REAL NOT NULL, stop_lon REAL NOT NULL,
      location_type INTEGER DEFAULT 0, wheelchair_boarding INTEGER,
      parent_station TEXT, platform_code TEXT, stop_url TEXT, stop_desc TEXT
    );
    CREATE TABLE calendar (
      service_id TEXT PRIMARY KEY, monday INTEGER, tuesday INTEGER,
      wednesday INTEGER, thursday INTEGER, friday INTEGER,
      saturday INTEGER, sunday INTEGER, start_date TEXT, end_date TEXT
    );
    CREATE TABLE calendar_dates (
      service_id TEXT, date TEXT, exception_type INTEGER
    );
    CREATE TABLE trips (
      trip_id TEXT PRIMARY KEY, route_id TEXT, service_id TEXT,
      trip_headsign TEXT, direction_id INTEGER
    );
    CREATE TABLE stop_times (
      trip_id TEXT NOT NULL, stop_id TEXT NOT NULL,
      stop_sequence INTEGER NOT NULL, departure_time TEXT,
      arrival_time TEXT, pickup_type INTEGER, drop_off_type INTEGER,
      stop_headsign TEXT, PRIMARY KEY (trip_id, stop_sequence)
    );
    CREATE TABLE feed_info (
      feed_publisher_name TEXT NOT NULL, feed_publisher_url TEXT NOT NULL,
      feed_lang TEXT NOT NULL, feed_start_date TEXT,
      feed_end_date TEXT, feed_version TEXT
    );
    CREATE TABLE translations (
      table_name TEXT NOT NULL, field_name TEXT NOT NULL,
      language TEXT NOT NULL, translation TEXT NOT NULL,
      record_id TEXT, record_sub_id TEXT, record_sequence TEXT, field_value TEXT
    );

    INSERT INTO agency VALUES ('A1', 'Test Bus', 'https://example.com', 'Asia/Tokyo', 'ja', '');
    INSERT INTO routes VALUES ('R1', 'A1', '01', 'Route One', 3, 'FF0000', 'FFFFFF', NULL, NULL);
    INSERT INTO stops VALUES ('S1', 'Stop A', 35.66, 139.76, 0, NULL, NULL, NULL, NULL, NULL);
    INSERT INTO stops VALUES ('S2', 'Stop B', 35.67, 139.77, 0, NULL, NULL, NULL, NULL, NULL);
    INSERT INTO calendar VALUES ('WD', 1, 1, 1, 1, 1, 0, 0, '20260101', '20260331');
    INSERT INTO trips VALUES ('T1', 'R1', 'WD', 'Stop B', 0);
    INSERT INTO stop_times VALUES ('T1', 'S1', 1, '08:00:00', '08:00:00', 0, 0, NULL);
    INSERT INTO stop_times VALUES ('T1', 'S2', 2, '08:10:00', '08:10:00', 0, 0, NULL);
    INSERT INTO feed_info VALUES ('Test Publisher', 'https://example.com', 'ja', '20260101', '20260331', '1.0');
  `);
  db.close();
}

beforeEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

afterEach(() => {
  rmSync(TMP_DIR, { recursive: true, force: true });
});

describe('GTFS DataBundle assembly', () => {
  it('produces a valid DataBundle from a minimal GTFS database', () => {
    const dbDir = join(TMP_DIR, 'db');
    const outDir = join(TMP_DIR, 'out', 'test');
    const dbPath = join(dbDir, 'test.db');

    // Create DB
    rmSync(dbDir, { recursive: true, force: true });
    const { mkdirSync } = require('node:fs') as typeof import('node:fs');
    mkdirSync(dbDir, { recursive: true });
    createMinimalGtfsDb(dbPath);

    // Run extraction
    const db = new Database(dbPath, { readonly: true });
    const prefix = 'test';

    const stops = extractStopsV2(db, prefix);
    const routes = extractRoutesV2(db, prefix, {});
    const calendar = extractCalendarV2(db, prefix);
    const agencies = extractAgenciesV2(db, prefix, TEST_PROVIDER);
    const feedInfo = extractFeedInfoV2(db, prefix);
    const translations = extractTranslationsV2(db, prefix, TEST_PROVIDER);
    const lookup = extractLookupV2(db, prefix);
    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, prefix);
    db.close();

    // Assemble bundle
    const bundle: DataBundle = {
      bundle_version: 2,
      kind: 'data',
      stops: { v: 2, data: stops },
      routes: { v: 2, data: routes },
      agency: { v: 1, data: agencies },
      calendar: { v: 1, data: calendar },
      feedInfo: { v: 1, data: feedInfo },
      timetable: { v: 2, data: timetable },
      tripPatterns: { v: 2, data: tripPatterns },
      translations: { v: 1, data: translations },
      lookup: { v: 2, data: lookup },
    };

    // Verify bundle structure
    expect(bundle.bundle_version).toBe(2);
    expect(bundle.kind).toBe('data');

    // Sections present with correct version
    expect(bundle.stops.v).toBe(2);
    expect(bundle.routes.v).toBe(2);
    expect(bundle.agency.v).toBe(1);
    expect(bundle.calendar.v).toBe(1);
    expect(bundle.feedInfo.v).toBe(1);
    expect(bundle.timetable.v).toBe(2);
    expect(bundle.tripPatterns.v).toBe(2);
    expect(bundle.translations.v).toBe(1);
    expect(bundle.lookup.v).toBe(2);

    // Data populated
    expect(bundle.stops.data).toHaveLength(2);
    expect(bundle.routes.data).toHaveLength(1);
    expect(bundle.agency.data).toHaveLength(1);
    expect(bundle.calendar.data.services).toHaveLength(1);
    expect(Object.keys(bundle.tripPatterns.data)).toHaveLength(1);
    expect(Object.keys(bundle.timetable.data)).toHaveLength(2); // 2 stops

    // Write and read back
    writeDataBundle(outDir, bundle);
    expect(existsSync(join(outDir, 'data.json'))).toBe(true);
    const written = JSON.parse(readFileSync(join(outDir, 'data.json'), 'utf-8')) as DataBundle;
    expect(written.bundle_version).toBe(2);
    expect(written.kind).toBe('data');
    expect(written.stops.data).toHaveLength(2);
  });

  it('timetable references only existing tripPattern IDs', () => {
    const dbDir = join(TMP_DIR, 'db');
    const dbPath = join(dbDir, 'test.db');
    const { mkdirSync } = require('node:fs') as typeof import('node:fs');
    mkdirSync(dbDir, { recursive: true });
    createMinimalGtfsDb(dbPath);

    const db = new Database(dbPath, { readonly: true });
    const { tripPatterns, timetable } = extractTripPatternsAndTimetable(db, 'test');
    db.close();

    const patternIds = new Set(Object.keys(tripPatterns));
    for (const [, groups] of Object.entries(timetable)) {
      for (const g of groups) {
        expect(patternIds.has(g.tp)).toBe(true);
      }
    }
  });

  it('tripPattern stops reference only existing stop IDs', () => {
    const dbDir = join(TMP_DIR, 'db');
    const dbPath = join(dbDir, 'test.db');
    const { mkdirSync } = require('node:fs') as typeof import('node:fs');
    mkdirSync(dbDir, { recursive: true });
    createMinimalGtfsDb(dbPath);

    const db = new Database(dbPath, { readonly: true });
    const stops = extractStopsV2(db, 'test');
    const { tripPatterns } = extractTripPatternsAndTimetable(db, 'test');
    db.close();

    const stopIds = new Set(stops.map((s) => s.i));
    for (const p of Object.values(tripPatterns)) {
      for (const sid of p.stops) {
        expect(stopIds.has(sid)).toBe(true);
      }
    }
  });
});
