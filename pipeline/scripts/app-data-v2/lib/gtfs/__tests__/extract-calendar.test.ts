/**
 * Tests for v2-extract-calendar.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractCalendarV2 } from '../extract-calendar';

let db: Database.Database;

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE calendar (
      service_id TEXT PRIMARY KEY,
      monday INTEGER, tuesday INTEGER, wednesday INTEGER,
      thursday INTEGER, friday INTEGER, saturday INTEGER, sunday INTEGER,
      start_date TEXT, end_date TEXT
    );
    CREATE TABLE calendar_dates (
      service_id TEXT, date TEXT, exception_type INTEGER
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

describe('extractCalendarV2', () => {
  it('returns empty services and exceptions when tables are empty', () => {
    const result = extractCalendarV2(db, 'test');
    expect(result).toEqual({ services: [], exceptions: [] });
  });

  it('returns services with prefixed IDs and day flags', () => {
    db.exec(`
      INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
      VALUES ('WD', 1, 1, 1, 1, 1, 0, 0, '20260101', '20260331');
    `);

    const result = extractCalendarV2(db, 'test');
    expect(result.services).toHaveLength(1);
    expect(result.services[0]).toEqual({
      i: 'test:WD',
      d: [1, 1, 1, 1, 1, 0, 0],
      s: '20260101',
      e: '20260331',
    });
  });

  it('returns exceptions with prefixed IDs', () => {
    db.exec(`
      INSERT INTO calendar_dates (service_id, date, exception_type)
      VALUES ('HD', '20260101', 1), ('WD', '20260101', 2);
    `);

    const result = extractCalendarV2(db, 'test');
    expect(result.exceptions).toHaveLength(2);
    expect(result.exceptions[0]).toEqual({ i: 'test:HD', d: '20260101', t: 1 });
    expect(result.exceptions[1]).toEqual({ i: 'test:WD', d: '20260101', t: 2 });
  });

  it('returns multiple services sorted by service_id', () => {
    db.exec(`
      INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
      VALUES ('WD', 1, 1, 1, 1, 1, 0, 0, '20260101', '20260331'),
             ('HD', 0, 0, 0, 0, 0, 1, 1, '20260101', '20260331'),
             ('AL', 1, 1, 1, 1, 1, 1, 1, '20260101', '20260331');
    `);

    const result = extractCalendarV2(db, 'pfx');
    expect(result.services).toHaveLength(3);
    // ORDER BY service_id ensures alphabetical order
    expect(result.services[0].i).toBe('pfx:AL');
    expect(result.services[1].i).toBe('pfx:HD');
    expect(result.services[2].i).toBe('pfx:WD');
  });

  it('returns both services and exceptions together', () => {
    db.exec(`
      INSERT INTO calendar (service_id, monday, tuesday, wednesday, thursday, friday, saturday, sunday, start_date, end_date)
      VALUES ('WD', 1, 1, 1, 1, 1, 0, 0, '20260401', '20260630');
      INSERT INTO calendar_dates (service_id, date, exception_type)
      VALUES ('WD', '20260503', 2), ('WD', '20260504', 2);
    `);

    const result = extractCalendarV2(db, 'src');
    expect(result.services).toHaveLength(1);
    expect(result.services[0]).toEqual({
      i: 'src:WD',
      d: [1, 1, 1, 1, 1, 0, 0],
      s: '20260401',
      e: '20260630',
    });
    expect(result.exceptions).toHaveLength(2);
    expect(result.exceptions[0]).toEqual({ i: 'src:WD', d: '20260503', t: 2 });
    expect(result.exceptions[1]).toEqual({ i: 'src:WD', d: '20260504', t: 2 });
  });
});
