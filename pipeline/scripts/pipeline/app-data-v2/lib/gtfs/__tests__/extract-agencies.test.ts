/**
 * Tests for v2-extract-agencies.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import type { Provider } from '../../../../../../src/types/resource-common';
import { extractAgenciesV2 } from '../extract-agencies';

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
      agency_url TEXT,
      agency_timezone TEXT,
      agency_lang TEXT,
      agency_fare_url TEXT
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
    const result = extractAgenciesV2(db, 'test', TEST_PROVIDER);
    expect(result).toEqual([]);
  });

  it('returns agencies with prefixed IDs', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name, agency_url, agency_lang)
      VALUES ('A001', 'Tokyo Bus', 'https://example.com', 'ja');
    `);

    const result = extractAgenciesV2(db, 'tobus', TEST_PROVIDER);
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      i: 'tobus:A001',
      n: 'Tokyo Bus',
      sn: 'テスト',
      u: 'https://example.com',
      l: 'ja',
      tz: '',
      fu: '',
      cs: [],
    });
  });

  it('uses provider colors', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', 'Test');
    `);

    const provider: Provider = {
      ...TEST_PROVIDER,
      colors: [{ bg: '00377E', text: 'FFFFFF' }],
    };
    const result = extractAgenciesV2(db, 'test', provider);
    expect(result[0].cs).toEqual([{ b: '00377E', t: 'FFFFFF' }]);
  });

  it('handles NULL optional fields as empty strings', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name)
      VALUES ('A001', 'Test Agency');
    `);

    const result = extractAgenciesV2(db, 'test', TEST_PROVIDER);
    expect(result[0].u).toBe('');
    expect(result[0].l).toBe('');
    expect(result[0].tz).toBe('');
    expect(result[0].fu).toBe('');
  });

  it('returns multiple agencies sorted by agency_id', () => {
    db.exec(`
      INSERT INTO agency (agency_id, agency_name) VALUES ('B001', 'Agency B');
      INSERT INTO agency (agency_id, agency_name) VALUES ('A001', 'Agency A');
    `);

    const result = extractAgenciesV2(db, 'test', TEST_PROVIDER);
    expect(result).toHaveLength(2);
    expect(result[0].i).toBe('test:A001');
    expect(result[1].i).toBe('test:B001');
  });
});
