/**
 * Tests for v2-extract-translations.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Provider } from '../../../../../types/resource-common';
import { extractTranslationsV2 } from '../extract-translations';

const TEST_PROVIDER: Provider = {
  name: {
    ja: { long: 'テスト交通', short: 'テスト' },
    en: { long: 'Test Transit', short: 'Test' },
  },
  url: 'https://example.com',
};

let db: Database.Database;

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE agency (
      agency_id TEXT PRIMARY KEY,
      agency_name TEXT NOT NULL,
      agency_url TEXT, agency_timezone TEXT, agency_lang TEXT, agency_fare_url TEXT
    );
    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY, agency_id TEXT, route_short_name TEXT,
      route_long_name TEXT, route_type INTEGER NOT NULL, route_color TEXT,
      route_text_color TEXT
    );
    CREATE TABLE stops (
      stop_id TEXT PRIMARY KEY, stop_name TEXT NOT NULL,
      stop_lat REAL NOT NULL, stop_lon REAL NOT NULL, location_type INTEGER DEFAULT 0
    );
    CREATE TABLE translations (
      table_name TEXT NOT NULL, field_name TEXT NOT NULL, language TEXT NOT NULL,
      translation TEXT NOT NULL, record_id TEXT, record_sub_id TEXT,
      record_sequence TEXT, field_value TEXT
    );
    CREATE TABLE trips (
      trip_id TEXT PRIMARY KEY, route_id TEXT, service_id TEXT, trip_headsign TEXT
    );
    CREATE TABLE stop_times (
      trip_id TEXT NOT NULL, stop_id TEXT NOT NULL, stop_sequence INTEGER NOT NULL,
      stop_headsign TEXT, departure_time TEXT, PRIMARY KEY (trip_id, stop_sequence)
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

describe('extractTranslationsV2', () => {
  it('returns empty maps when no translations exist', () => {
    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    expect(result).toEqual({
      headsigns: {},
      stop_headsigns: {},
      stop_names: {},
      route_names: {},
      agency_names: {},
      agency_short_names: {},
    });
  });

  it('extracts trip_headsign translations via record_id (GTFS-JP)', () => {
    db.exec(`
      INSERT INTO trips (trip_id, route_id, service_id, trip_headsign)
      VALUES ('T001', 'R001', 'S001', '新橋駅前');
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('trips', 'trip_headsign', 'en', 'Shimbashi Sta.', 'T001');
    `);

    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    expect(result.headsigns['新橋駅前']).toEqual({ en: 'Shimbashi Sta.' });
  });

  it('extracts stop_name translations for all location_types (v2)', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type)
      VALUES ('P001', '新橋駅', 35.6658, 139.7584, 1),
             ('S001', '新橋', 35.6659, 139.7585, 0);
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('stops', 'stop_name', 'en', 'Shimbashi Sta.', 'P001'),
             ('stops', 'stop_name', 'en', 'Shimbashi', 'S001');
    `);

    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    // v2 includes parent stations (location_type=1) unlike v1
    expect(result.stop_names['test:P001']).toEqual({ en: 'Shimbashi Sta.' });
    expect(result.stop_names['test:S001']).toEqual({ en: 'Shimbashi' });
  });

  it('extracts agency_name with provider defaults', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', '東京バス');
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('agency', 'agency_name', 'en', 'Tokyo Bus', 'A001');
    `);

    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    expect(result.agency_names['test:A001']).toEqual({
      ja: 'テスト交通',
      en: 'Tokyo Bus',
    });
    expect(result.agency_short_names['test:A001']).toEqual({
      ja: 'テスト',
      en: 'Test',
    });
  });

  it('extracts trip_headsign translations via field_value (standard GTFS)', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', 'Test Agency');
      INSERT INTO translations (table_name, field_name, language, translation, field_value)
      VALUES ('trips', 'trip_headsign', 'en', 'Tokyo Station', '東京駅');
    `);

    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    expect(result.headsigns['東京駅']).toEqual({ en: 'Tokyo Station' });
  });

  it('extracts stop_headsign translations', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', 'Test Agency');
      INSERT INTO stop_times (trip_id, stop_id, stop_sequence, stop_headsign, departure_time)
      VALUES ('T001', 'S001', 1, '渋谷行', '08:00');
      INSERT INTO translations (table_name, field_name, language, translation, record_id, record_sub_id)
      VALUES ('stop_times', 'stop_headsign', 'en', 'For Shibuya', 'T001', '1');
    `);

    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    expect(result.stop_headsigns['渋谷行']).toEqual({ en: 'For Shibuya' });
  });

  it('extracts route_long_name translations', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', 'Test Agency');
      INSERT INTO routes (route_id, agency_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'A001', 'R1', '山手線', 2);
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('routes', 'route_long_name', 'en', 'Yamanote Line', 'R001');
    `);

    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    expect(result.route_names['test:R001']).toEqual({ en: 'Yamanote Line' });
  });

  it('deduplicates headsign translations when multiple trips share the same headsign', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', 'Test Agency');
      INSERT INTO trips (trip_id, route_id, service_id, trip_headsign)
      VALUES ('T001', 'R001', 'S001', '新宿駅'),
             ('T002', 'R001', 'S001', '新宿駅');
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('trips', 'trip_headsign', 'en', 'Shinjuku Sta.', 'T001'),
             ('trips', 'trip_headsign', 'en', 'Shinjuku Sta.', 'T002');
    `);

    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    // Should produce only one headsign entry despite two trips
    expect(result.headsigns['新宿駅']).toEqual({ en: 'Shinjuku Sta.' });
    expect(Object.keys(result.headsigns)).toHaveLength(1);
  });

  it('extracts multiple languages for the same stop', () => {
    db.exec(`
      INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, location_type)
      VALUES ('S001', '新橋', 35.6658, 139.7584, 0);
      INSERT INTO translations (table_name, field_name, language, translation, record_id)
      VALUES ('stops', 'stop_name', 'en', 'Shimbashi', 'S001'),
             ('stops', 'stop_name', 'ko', '신바시', 'S001'),
             ('stops', 'stop_name', 'zh-Hans', '新桥', 'S001');
    `);

    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    expect(result.stop_names['test:S001']).toEqual({
      en: 'Shimbashi',
      ko: '신바시',
      'zh-Hans': '新桥',
    });
  });

  it('provides agency names/short_names even without translation rows', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', '都バス');
    `);

    const result = extractTranslationsV2(db, 'test', TEST_PROVIDER);
    // Provider defaults are used
    expect(result.agency_names['test:A001']).toEqual({
      ja: 'テスト交通',
      en: 'Test Transit',
    });
    expect(result.agency_short_names['test:A001']).toEqual({
      ja: 'テスト',
      en: 'Test',
    });
  });
});
