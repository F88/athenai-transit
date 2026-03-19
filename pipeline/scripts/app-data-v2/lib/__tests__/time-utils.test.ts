/**
 * Tests for time-utils.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { timeToMinutes } from '../time-utils';

describe('timeToMinutes', () => {
  it('converts GTFS format "HH:MM:SS" to minutes', () => {
    expect(timeToMinutes('08:30:00')).toBe(510);
  });

  it('converts ODPT format "HH:MM" to minutes', () => {
    expect(timeToMinutes('06:30')).toBe(390);
  });

  it('returns 0 for midnight', () => {
    expect(timeToMinutes('00:00:00')).toBe(0);
    expect(timeToMinutes('00:00')).toBe(0);
  });

  it('converts 23:59 to 1439 minutes', () => {
    expect(timeToMinutes('23:59:00')).toBe(1439);
    expect(timeToMinutes('23:59')).toBe(1439);
  });

  it('supports overnight hours >= 24 (GTFS)', () => {
    expect(timeToMinutes('25:01:00')).toBe(1501);
  });

  it('supports overnight hours >= 24 (ODPT)', () => {
    expect(timeToMinutes('25:30')).toBe(1530);
  });

  it('handles exact hour boundaries', () => {
    expect(timeToMinutes('01:00:00')).toBe(60);
    expect(timeToMinutes('12:00')).toBe(720);
    expect(timeToMinutes('24:00:00')).toBe(1440);
  });
});
