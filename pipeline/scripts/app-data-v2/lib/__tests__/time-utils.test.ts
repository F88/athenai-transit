/**
 * Tests for time-utils.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import { adjustOdptOvernightTimes, timeToMinutes } from '../time-utils';

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

describe('adjustOdptOvernightTimes', () => {
  it('converts 00:xx to 24:xx after 23:xx reversal', () => {
    const input = ['23:40', '23:50', '00:00', '00:10', '00:20'];
    const result = adjustOdptOvernightTimes(input);
    expect(result).toEqual(['23:40', '23:50', '24:00', '24:10', '24:20']);
  });

  it('does not modify times when no reversal occurs', () => {
    const input = ['05:45', '06:00', '07:00', '23:50'];
    const result = adjustOdptOvernightTimes(input);
    expect(result).toEqual(['05:45', '06:00', '07:00', '23:50']);
  });

  it('does not modify early morning times without preceding 23:xx', () => {
    // A timetable starting at 00:xx (hypothetical) should not be adjusted
    const input = ['00:30', '01:00', '05:00'];
    const result = adjustOdptOvernightTimes(input);
    expect(result).toEqual(['00:30', '01:00', '05:00']);
  });

  it('handles 01:xx through 04:xx as overnight after reversal', () => {
    const input = ['23:50', '00:15', '01:00', '01:30', '04:59'];
    const result = adjustOdptOvernightTimes(input);
    expect(result).toEqual(['23:50', '24:15', '25:00', '25:30', '28:59']);
  });

  it('does not adjust 05:xx and later after reversal', () => {
    // 05:xx is at the overnight threshold boundary — not adjusted
    const input = ['23:50', '00:10', '05:00'];
    const result = adjustOdptOvernightTimes(input);
    expect(result).toEqual(['23:50', '24:10', '05:00']);
  });

  it('returns empty array for empty input', () => {
    expect(adjustOdptOvernightTimes([])).toEqual([]);
  });

  it('handles single element', () => {
    expect(adjustOdptOvernightTimes(['12:00'])).toEqual(['12:00']);
  });

  it('does not modify the input array', () => {
    const input = ['23:50', '00:10'];
    const copy = [...input];
    adjustOdptOvernightTimes(input);
    expect(input).toEqual(copy);
  });

  it('skips empty entries between 23:xx and 00:xx without blocking reversal', () => {
    const input = ['23:40', '23:50', '', '00:00', '00:10'];
    const result = adjustOdptOvernightTimes(input);
    expect(result).toEqual(['23:40', '23:50', '', '24:00', '24:10']);
  });

  it('skips multiple empty entries without blocking reversal', () => {
    const input = ['23:50', '', '', '00:10'];
    const result = adjustOdptOvernightTimes(input);
    expect(result).toEqual(['23:50', '', '', '24:10']);
  });

  it('handles NaN hour gracefully', () => {
    const input = ['23:50', 'abc:00', '00:10'];
    const result = adjustOdptOvernightTimes(input);
    expect(result).toEqual(['23:50', 'abc:00', '24:10']);
  });

  it('handles real yurikamome data pattern', () => {
    const input = [
      '05:45',
      '05:55',
      '06:03',
      '06:11',
      '23:04',
      '23:13',
      '23:20',
      '23:27',
      '23:32',
      '23:40',
      '23:50',
      '00:00',
      '00:10',
      '00:20',
    ];
    const result = adjustOdptOvernightTimes(input);
    // Only the last 3 should be adjusted
    expect(result.slice(-3)).toEqual(['24:00', '24:10', '24:20']);
    // Earlier times should be unchanged
    expect(result.slice(0, 3)).toEqual(['05:45', '05:55', '06:03']);
  });
});
