/**
 * Tests for v2-extract-routes.ts.
 *
 * @vitest-environment node
 */

import Database from 'better-sqlite3';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { extractRoutesV2 } from '../extract-routes';

let db: Database.Database;

function createSchema(database: Database.Database): void {
  database.exec(`
    CREATE TABLE routes (
      route_id TEXT PRIMARY KEY,
      agency_id TEXT,
      route_short_name TEXT,
      route_long_name TEXT,
      route_type INTEGER NOT NULL,
      route_color TEXT,
      route_text_color TEXT,
      route_desc TEXT,
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

describe('extractRoutesV2', () => {
  it('returns empty array when no routes exist', () => {
    const result = extractRoutesV2(db, 'test', {});
    expect(result).toEqual([]);
  });

  it('returns routes with v:2 and all fields', () => {
    db.exec(`
      INSERT INTO routes (route_id, agency_id, route_short_name, route_long_name, route_type, route_color, route_text_color)
      VALUES ('R001', 'A001', '都01', '渋谷-新橋', 3, 'F1B34E', 'FFFFFF');
    `);

    const result = extractRoutesV2(db, 'test', {});
    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({
      v: 2,
      i: 'test:R001',
      s: '都01',
      l: '渋谷-新橋',
      t: 3,
      c: 'F1B34E',
      tc: 'FFFFFF',
      ai: 'test:A001',
    });
  });

  it('includes desc when route_desc is present', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_desc)
      VALUES ('R001', 'R1', 'Route 1', 3, 'A scenic bus route through the city');
    `);

    const result = extractRoutesV2(db, 'test', {});
    expect(result[0].desc).toBe('A scenic bus route through the city');
  });

  it('omits desc when route_desc is NULL', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutesV2(db, 'test', {});
    expect(result[0].desc).toBeUndefined();
  });

  it('applies wildcard color fallback without synthesizing textColor', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutesV2(db, 'test', { '*': '2E7D32' });
    expect(result[0].c).toBe('2E7D32');
    expect(result[0].tc).toBe('');
  });

  it('applies route-specific color fallback over wildcard', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutesV2(db, 'test', { R001: 'FF0000', '*': '2E7D32' });
    expect(result[0].c).toBe('FF0000');
  });

  it('preserves identical explicit color/textColor pairs (e.g. 000000/000000)', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color)
      VALUES ('R001', 'R1', 'Route 1', 3, '000000', '000000');
    `);

    const result = extractRoutesV2(db, 'test', { '*': '1565C0' });
    expect(result[0].c).toBe('000000');
    expect(result[0].tc).toBe('000000');
  });

  it('returns empty string for color when no fallback is provided and color is unset', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutesV2(db, 'test', {});
    expect(result[0].c).toBe('');
    expect(result[0].tc).toBe('');
  });

  it('sets agency_id to empty string when agency_id is NULL', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R001', 'R1', 'Route 1', 3);
    `);

    const result = extractRoutesV2(db, 'test', {});
    expect(result[0].ai).toBe('');
  });

  it('does not include route_url in output (moved to lookup)', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_url)
      VALUES ('R001', 'R1', 'Route 1', 3, 'https://example.com/route/R001');
    `);

    const result = extractRoutesV2(db, 'test', {});
    expect(result[0]).not.toHaveProperty('u');
    // route_url should be in lookup, not in route
  });

  it('handles NULL route_short_name and route_long_name as empty strings', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_type) VALUES ('R001', 3);
    `);

    const result = extractRoutesV2(db, 'test', {});
    expect(result[0].s).toBe('');
    expect(result[0].l).toBe('');
  });

  it('returns multiple routes sorted by route_id', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type)
      VALUES ('R003', 'C', 'Route C', 3),
             ('R001', 'A', 'Route A', 3),
             ('R002', 'B', 'Route B', 3);
    `);

    const result = extractRoutesV2(db, 'test', {});
    expect(result.map((r) => r.i)).toEqual(['test:R001', 'test:R002', 'test:R003']);
  });

  it('omits desc when route_desc is empty string', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_desc)
      VALUES ('R001', 'R1', 'Route 1', 3, '');
    `);

    const result = extractRoutesV2(db, 'test', {});
    expect(result[0].desc).toBeUndefined();
  });

  it('preserves original textColor when color comes from DB (not fallback)', () => {
    db.exec(`
      INSERT INTO routes (route_id, route_short_name, route_long_name, route_type, route_color, route_text_color)
      VALUES ('R001', 'R1', 'Route 1', 3, 'FF0000', '000000');
    `);

    const result = extractRoutesV2(db, 'test', { '*': '2E7D32' });
    expect(result[0].c).toBe('FF0000');
    expect(result[0].tc).toBe('000000');
  });
});
