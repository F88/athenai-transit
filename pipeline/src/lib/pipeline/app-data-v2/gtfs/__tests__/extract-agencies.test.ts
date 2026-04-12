/**
 * Tests for extract-agencies.ts (v2).
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractAgenciesV2 } from '../extract-agencies';

let db: Database.Database;

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE agency (
      agency_id TEXT PRIMARY KEY,
      agency_name TEXT NOT NULL,
      agency_url TEXT NOT NULL,
      agency_timezone TEXT NOT NULL,
      agency_lang TEXT,
      agency_phone TEXT,
      agency_fare_url TEXT,
      agency_email TEXT,
      cemv_support TEXT
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

describe('extractAgenciesV2', () => {
  it('returns empty array when no agencies exist', () => {
    const result = extractAgenciesV2(db, 'test');
    expect(result).toEqual([]);
  });

  it('returns agencies with all GTFS fields', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone,
                          agency_lang, agency_phone, agency_fare_url, agency_email, cemv_support)
      VALUES ('A001', 'Tokyo Bus', 'https://example.com', 'Asia/Tokyo',
              'ja', '03-1234-5678', 'https://example.com/fare', 'info@example.com', '1');
    `);

    const result = extractAgenciesV2(db, 'tobus');
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      v: 2,
      i: 'tobus:A001',
      n: 'Tokyo Bus',
      u: 'https://example.com',
      tz: 'Asia/Tokyo',
      l: 'ja',
      ph: '03-1234-5678',
      fu: 'https://example.com/fare',
      em: 'info@example.com',
      cemv: 1,
    });
  });

  it('omits optional fields when not provided', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone)
      VALUES ('A001', 'Test Agency', 'https://example.com', 'Asia/Tokyo');
    `);

    const result = extractAgenciesV2(db, 'test');
    expect(result[0]).toEqual({
      v: 2,
      i: 'test:A001',
      n: 'Test Agency',
      u: 'https://example.com',
      tz: 'Asia/Tokyo',
    });
    expect(result[0]).not.toHaveProperty('l');
    expect(result[0]).not.toHaveProperty('ph');
    expect(result[0]).not.toHaveProperty('fu');
    expect(result[0]).not.toHaveProperty('em');
    expect(result[0]).not.toHaveProperty('cemv');
  });

  it('returns multiple agencies sorted by agency_id', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone)
      VALUES ('B001', 'Agency B', 'https://b.example.com', 'Asia/Tokyo');
      INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone)
      VALUES ('A001', 'Agency A', 'https://a.example.com', 'Asia/Tokyo');
    `);

    const result = extractAgenciesV2(db, 'test');
    expect(result).toHaveLength(2);
    expect(result[0].i).toBe('test:A001');
    expect(result[1].i).toBe('test:B001');
  });

  it('handles multi-agency feeds with per-agency data', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone, agency_lang)
      VALUES ('6013301006270', '西武バス', 'https://www.seibubus.co.jp', 'Asia/Tokyo', 'ja');
      INSERT INTO agency (agency_id, agency_name, agency_url, agency_timezone, agency_lang)
      VALUES ('3013301006265', '西武観光バス', 'https://www.seibubus.co.jp', 'Asia/Tokyo', 'ja');
    `);

    const result = extractAgenciesV2(db, 'sbbus');
    expect(result).toHaveLength(2);
    expect(result[0].n).toBe('西武観光バス');
    expect(result[1].n).toBe('西武バス');
  });
});
