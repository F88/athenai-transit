/**
 * Tests for v2-extract-feed-info.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractFeedInfoV2 } from '../lib/gtfs/extract-feed-info';

let db: Database.Database;

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE feed_info (
      feed_publisher_name TEXT NOT NULL,
      feed_publisher_url TEXT NOT NULL,
      feed_lang TEXT NOT NULL,
      feed_start_date TEXT,
      feed_end_date TEXT,
      feed_version TEXT
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

describe('extractFeedInfoV2', () => {
  it('returns empty defaults when feed_info table is empty', () => {
    const result = extractFeedInfoV2(db, 'test');
    expect(result).toEqual({ pn: '', pu: '', l: '', s: '', e: '', v: '' });
  });

  it('returns feed info with all fields', () => {
    db.exec(`
      INSERT INTO feed_info (feed_publisher_name, feed_publisher_url, feed_lang, feed_start_date, feed_end_date, feed_version)
      VALUES ('Tokyo Metro', 'https://example.com', 'ja', '20260101', '20260331', '2.0');
    `);

    const result = extractFeedInfoV2(db, 'test');
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

    const result = extractFeedInfoV2(db, 'test');
    expect(result.s).toBe('');
    expect(result.e).toBe('');
    expect(result.v).toBe('');
  });
});
