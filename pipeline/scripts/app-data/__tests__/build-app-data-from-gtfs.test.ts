/**
 * Tests for build-app-data-from-gtfs.ts extract functions.
 *
 * Uses an in-memory SQLite database populated with minimal GTFS test data
 * to verify each extract function produces correct JSON output.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import {
  extractAgencies,
  extractFeedInfo,
  extractRoutes,
  extractTranslations,
} from '../build-app-data-from-gtfs';

// ---------------------------------------------------------------------------
// Test DB setup
// ---------------------------------------------------------------------------

let db: Database.Database;

/** Create minimal GTFS schema tables needed for testing. */
function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE agency (
      agency_id TEXT PRIMARY KEY,
      agency_name TEXT NOT NULL,
      agency_url TEXT,
      agency_timezone TEXT,
      agency_lang TEXT
    );
    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY,
      agency_id TEXT,
      route_short_name TEXT,
      route_long_name TEXT,
      route_type INTEGER NOT NULL,
      route_color TEXT,
      route_text_color TEXT
    );
    CREATE TABLE feed_info (
      feed_publisher_name TEXT NOT NULL,
      feed_publisher_url TEXT NOT NULL,
      feed_lang TEXT NOT NULL,
      feed_start_date TEXT,
      feed_end_date TEXT,
      feed_version TEXT
    );
    CREATE TABLE translations (
      table_name TEXT NOT NULL,
      field_name TEXT NOT NULL,
      language TEXT NOT NULL,
      translation TEXT NOT NULL,
      record_id TEXT,
      record_sub_id TEXT,
      record_sequence TEXT,
      field_value TEXT
    );
    CREATE TABLE trips (
      trip_id TEXT PRIMARY KEY,
      route_id TEXT,
      service_id TEXT,
      trip_headsign TEXT
    );
    CREATE TABLE stop_times (
      trip_id TEXT NOT NULL,
      stop_id TEXT NOT NULL,
      stop_sequence INTEGER NOT NULL,
      stop_headsign TEXT,
      departure_time TEXT,
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

// ---------------------------------------------------------------------------
// extractAgencies
// ---------------------------------------------------------------------------

describe('extractAgencies', () => {
  it('returns empty array when no agencies exist', () => {
    const result = extractAgencies(db, 'test');
    expect(result).toEqual([]);
  });

  it('returns agencies with prefixed IDs', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name, agency_url, agency_lang)
      VALUES ('A001', 'Tokyo Bus', 'https://example.com', 'ja');
    `);

    const result = extractAgencies(db, 'tobus');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      i: 'tobus:A001',
      n: 'Tokyo Bus',
      m: {},
      u: 'https://example.com',
      l: 'ja',
    });
  });

  it('includes translations for agency_name', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name, agency_url, agency_lang)
      VALUES ('A001', '東京バス', 'https://example.com', 'ja');
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('agency', 'agency_name', 'en', 'Tokyo Bus', 'A001');
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('agency', 'agency_name', 'ja-Hrkt', 'とうきょうばす', 'A001');
    `);

    const result = extractAgencies(db, 'test');
    expect(result[0].m).toEqual({
      en: 'Tokyo Bus',
      'ja-Hrkt': 'とうきょうばす',
    });
  });

  it('handles NULL agency_url and agency_lang as empty strings', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name)
      VALUES ('A001', 'Test Agency');
    `);

    const result = extractAgencies(db, 'test');
    expect(result[0].u).toBe('');
    expect(result[0].l).toBe('');
  });

  it('matches translations by field_value when record_id is NULL', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', '東京バス');
      INSERT INTO translations (table_name, field_name, language, translation, field_value)
      VALUES ('agency', 'agency_name', 'en', 'Tokyo Bus', '東京バス');
    `);

    const result = extractAgencies(db, 'test');
    expect(result[0].m).toEqual({ en: 'Tokyo Bus' });
  });
});

// ---------------------------------------------------------------------------
// extractFeedInfo
// ---------------------------------------------------------------------------

describe('extractFeedInfo', () => {
  it('returns null when feed_info table is empty', () => {
    const result = extractFeedInfo(db, 'test');
    expect(result).toBeNull();
  });

  it('returns feed info with all fields', () => {
    db.exec(`
      INSERT INTO feed_info (feed_publisher_name, feed_publisher_url, feed_lang, feed_start_date, feed_end_date, feed_version)
      VALUES ('Tokyo Metro', 'https://example.com', 'ja', '20260101', '20260331', '2.0');
    `);

    const result = extractFeedInfo(db, 'test');
    expect(result).toEqual({
      pn: 'Tokyo Metro',
      pu: 'https://example.com',
      l: 'ja',
      s: '20260101',
      e: '20260331',
      v: '2.0',
    });
  });

  it('handles NULL optional fields as empty strings', () => {
    db.exec(`
      INSERT INTO feed_info (feed_publisher_name, feed_publisher_url, feed_lang)
      VALUES ('Test', 'https://example.com', 'ja');
    `);

    const result = extractFeedInfo(db, 'test');
    expect(result).not.toBeNull();
    expect(result!.s).toBe('');
    expect(result!.e).toBe('');
    expect(result!.v).toBe('');
  });
});

// ---------------------------------------------------------------------------
// extractTranslations
// ---------------------------------------------------------------------------

describe('extractTranslations', () => {
  it('returns empty headsigns when no translations exist', () => {
    const result = extractTranslations(db, 'test');
    expect(result).toEqual({ headsigns: {}, stop_headsigns: {} });
  });

  it('extracts trip_headsign translations via record_id (GTFS-JP)', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, trip_headsign)
      VALUES ('T001', 'R001', 'S001', '新橋駅前');
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('trips', 'trip_headsign', 'en', 'Shimbashi Sta.', 'T001');
    `);

    const result = extractTranslations(db, 'test');
    expect(result.headsigns['新橋駅前']).toEqual({ en: 'Shimbashi Sta.' });
  });

  it('extracts trip_headsign translations via field_value (standard GTFS)', () => {
    db.exec(`
      INSERT INTO translations (table_name, field_name, language, translation, field_value)
      VALUES ('trips', 'trip_headsign', 'en', 'Shimbashi Sta.', '新橋駅前');
    `);

    const result = extractTranslations(db, 'test');
    expect(result.headsigns['新橋駅前']).toEqual({ en: 'Shimbashi Sta.' });
  });

  it('extracts stop_headsign translations via record_id + record_sub_id', () => {
    db.exec(`
      INSERT INTO stop_times (trip_id, stop_id, stop_sequence, stop_headsign, departure_time)
      VALUES ('T001', 'S001', 1, '渋谷方面', '08:00:00');
      INSERT INTO translations (table_name, field_name, language, translation, record_id, record_sub_id)
      VALUES ('stop_times', 'stop_headsign', 'en', 'For Shibuya', 'T001', '1');
    `);

    const result = extractTranslations(db, 'test');
    expect(result.stop_headsigns['渋谷方面']).toEqual({ en: 'For Shibuya' });
  });

  it('extracts stop_headsign translations via field_value', () => {
    db.exec(`
      INSERT INTO translations (table_name, field_name, language, translation, field_value)
      VALUES ('stop_times', 'stop_headsign', 'en', 'For Shibuya', '渋谷方面');
    `);

    const result = extractTranslations(db, 'test');
    expect(result.stop_headsigns['渋谷方面']).toEqual({ en: 'For Shibuya' });
  });

  it('deduplicates headsign translations from multiple trips', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, trip_headsign)
      VALUES ('T001', 'R001', 'S001', '新橋'),
             ('T002', 'R001', 'S001', '新橋');
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('trips', 'trip_headsign', 'en', 'Shimbashi', 'T001'),
             ('trips', 'trip_headsign', 'en', 'Shimbashi', 'T002');
    `);

    const result = extractTranslations(db, 'test');
    // Should have exactly one entry despite two trips with same headsign
    expect(Object.keys(result.headsigns)).toHaveLength(1);
    expect(result.headsigns['新橋']).toEqual({ en: 'Shimbashi' });
  });
});

// ---------------------------------------------------------------------------
// extractRoutes (extended fields: m, ai)
// ---------------------------------------------------------------------------

describe('extractRoutes (extended fields)', () => {
  it('includes route_names translations and prefixed agency_id', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', 'Test Agency');
      INSERT INTO routes (route_id, agency_id, route_short_name, route_long_name, route_type, route_color, route_text_color)
      VALUES ('R001', 'A001', '都01', '渋谷-新橋', 3, 'F1B34E', 'FFFFFF');
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('routes', 'route_long_name', 'en', 'Shibuya-Shimbashi', 'R001');
    `);

    const result = extractRoutes(db, 'test', {});
    expect(result).toHaveLength(1);
    expect(result[0].m).toEqual({ en: 'Shibuya-Shimbashi' });
    expect(result[0].ai).toBe('test:A001');
  });

  it('returns empty string for agency_id when NULL', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutes(db, 'test', {});
    expect(result[0].ai).toBe('');
  });

  it('returns empty names map when no translations exist', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutes(db, 'test', {});
    expect(result[0].m).toEqual({});
  });

  it('matches route translations by field_value when record_id is NULL', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', '都01', '大江戸線', 1);
      INSERT INTO translations (table_name, field_name, language, translation, field_value)
      VALUES ('routes', 'route_long_name', 'en', 'Oedo Line', '大江戸線');
    `);

    const result = extractRoutes(db, 'test', {});
    expect(result[0].m).toEqual({ en: 'Oedo Line' });
  });
});

// ---------------------------------------------------------------------------
// extractRoutes (color fallback)
// ---------------------------------------------------------------------------

describe('extractRoutes (color fallback)', () => {
  it('uses route_color from DB when present', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color)
      VALUES ('R001', 'R1', 'Route 1', 3, 'F1B34E', 'FFFFFF');
    `);

    const result = extractRoutes(db, 'test', {});
    expect(result[0].c).toBe('F1B34E');
    expect(result[0].tc).toBe('FFFFFF');
  });

  it('applies wildcard fallback when route_color is empty', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutes(db, 'test', { '*': '2E7D32' });
    expect(result[0].c).toBe('2E7D32');
    expect(result[0].tc).toBe('FFFFFF');
  });

  it('applies route-specific fallback over wildcard', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutes(db, 'test', { R001: 'FF0000', '*': '2E7D32' });
    expect(result[0].c).toBe('FF0000');
    expect(result[0].tc).toBe('FFFFFF');
  });

  it('treats identical color/textColor as unset (e.g. 000000/000000)', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color)
      VALUES ('R001', 'R1', 'Route 1', 3, '000000', '000000');
    `);

    const result = extractRoutes(db, 'test', { '*': '1565C0' });
    expect(result[0].c).toBe('1565C0');
    expect(result[0].tc).toBe('FFFFFF');
  });

  it('does NOT treat FFFFFF/FFFFFF as unset', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color)
      VALUES ('R001', 'R1', 'Route 1', 3, 'FFFFFF', 'FFFFFF');
    `);

    const result = extractRoutes(db, 'test', { '*': '1565C0' });
    expect(result[0].c).toBe('FFFFFF');
    expect(result[0].tc).toBe('FFFFFF');
  });

  it('returns empty color when no fallback is configured', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutes(db, 'test', {});
    expect(result[0].c).toBe('');
    expect(result[0].tc).toBe('');
  });
});
