/**
 * Tests for gtfs-date-utils.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { parseGtfsDate } from '../gtfs-date-utils';

describe('parseGtfsDate', () => {
  it('parses a valid date string', () => {
    const date = parseGtfsDate('20260322');
    expect(date).not.toBeNull();
    expect(date!.getUTCFullYear()).toBe(2026);
    expect(date!.getUTCMonth()).toBe(2); // 0-based: March = 2
    expect(date!.getUTCDate()).toBe(22);
  });

  it('returns UTC midnight', () => {
    const date = parseGtfsDate('20260101');
    expect(date!.getUTCHours()).toBe(0);
    expect(date!.getUTCMinutes()).toBe(0);
    expect(date!.getUTCSeconds()).toBe(0);
  });

  it('returns null for non-8-digit strings', () => {
    expect(parseGtfsDate('')).toBeNull();
    expect(parseGtfsDate('2026032')).toBeNull();
    expect(parseGtfsDate('202603221')).toBeNull();
    expect(parseGtfsDate('abcdefgh')).toBeNull();
  });

  it('returns null for invalid month', () => {
    expect(parseGtfsDate('20261301')).toBeNull(); // month 13
    expect(parseGtfsDate('20260001')).toBeNull(); // month 0
  });

  it('returns null for invalid day', () => {
    expect(parseGtfsDate('20260132')).toBeNull(); // Jan 32
    expect(parseGtfsDate('20260100')).toBeNull(); // day 0
  });

  it('handles leap year correctly', () => {
    expect(parseGtfsDate('20240229')).not.toBeNull(); // 2024 is leap
    expect(parseGtfsDate('20250229')).toBeNull(); // 2025 is not leap
  });

  it('handles end of months correctly', () => {
    expect(parseGtfsDate('20260228')).not.toBeNull(); // Feb 28 OK
    expect(parseGtfsDate('20260430')).not.toBeNull(); // Apr 30 OK
    expect(parseGtfsDate('20260431')).toBeNull(); // Apr 31 invalid
  });
});
