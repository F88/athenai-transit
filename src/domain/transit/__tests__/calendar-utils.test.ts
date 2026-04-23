import { describe, it, expect } from 'vitest';
import {
  binarySearchFirstGte,
  computeActiveServiceIds,
  formatDateKey,
  getDayIndex,
  minutesToDate,
} from '../calendar-utils';
import type { CalendarExceptionJson, CalendarServiceJson } from '../../../types/data/transit-json';

// ---------------------------------------------------------------------------
// binarySearchFirstGte
// ---------------------------------------------------------------------------

describe('binarySearchFirstGte', () => {
  it('returns 0 for empty array', () => {
    expect(binarySearchFirstGte([], 5)).toBe(0);
  });

  it('returns 0 when target is less than all elements', () => {
    expect(binarySearchFirstGte([10, 20, 30], 5)).toBe(0);
  });

  it('returns array.length when target exceeds all elements', () => {
    expect(binarySearchFirstGte([10, 20, 30], 35)).toBe(3);
  });

  it('returns exact match index', () => {
    expect(binarySearchFirstGte([10, 20, 30], 20)).toBe(1);
  });

  it('returns index of first element >= target when no exact match', () => {
    expect(binarySearchFirstGte([10, 20, 30], 15)).toBe(1);
  });

  it('returns first index for duplicate values', () => {
    expect(binarySearchFirstGte([10, 20, 20, 20, 30], 20)).toBe(1);
  });

  it('handles single element array', () => {
    expect(binarySearchFirstGte([10], 10)).toBe(0);
    expect(binarySearchFirstGte([10], 5)).toBe(0);
    expect(binarySearchFirstGte([10], 15)).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// formatDateKey
// ---------------------------------------------------------------------------

describe('formatDateKey', () => {
  it('formats date as YYYYMMDD', () => {
    expect(formatDateKey(new Date(2026, 2, 24))).toBe('20260324');
  });

  it('pads month and day with zeros', () => {
    expect(formatDateKey(new Date(2026, 0, 5))).toBe('20260105');
  });

  it('handles December correctly', () => {
    expect(formatDateKey(new Date(2026, 11, 31))).toBe('20261231');
  });
});

// ---------------------------------------------------------------------------
// getDayIndex
// ---------------------------------------------------------------------------

describe('getDayIndex', () => {
  it('returns 0 for Monday', () => {
    // 2026-03-23 is Monday
    expect(getDayIndex(new Date(2026, 2, 23))).toBe(0);
  });

  it('returns 6 for Sunday', () => {
    // 2026-03-29 is Sunday
    expect(getDayIndex(new Date(2026, 2, 29))).toBe(6);
  });

  it('returns 4 for Friday', () => {
    // 2026-03-27 is Friday
    expect(getDayIndex(new Date(2026, 2, 27))).toBe(4);
  });
});

// ---------------------------------------------------------------------------
// minutesToDate
// ---------------------------------------------------------------------------

describe('minutesToDate', () => {
  const baseDate = new Date(2026, 2, 24, 0, 0, 0, 0);

  it('converts minutes to correct time', () => {
    const result = minutesToDate(baseDate, 600); // 10:00
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(0);
  });

  it('handles midnight (0 minutes)', () => {
    const result = minutesToDate(baseDate, 0);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('handles overnight times >= 1440', () => {
    const result = minutesToDate(baseDate, 1500); // 25:00 = next day 1:00
    expect(result.getDate()).toBe(25);
    expect(result.getHours()).toBe(1);
    expect(result.getMinutes()).toBe(0);
  });

  it('preserves date from baseDate', () => {
    const result = minutesToDate(baseDate, 720); // 12:00
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(2);
    expect(result.getDate()).toBe(24);
  });

  it('does not mutate baseDate', () => {
    const original = new Date(baseDate);
    minutesToDate(baseDate, 600);
    expect(baseDate.getTime()).toBe(original.getTime());
  });

  it('handles exactly 1440 minutes (24:00 boundary)', () => {
    const result = minutesToDate(baseDate, 1440); // 24:00 = next day 0:00
    expect(result.getDate()).toBe(25);
    expect(result.getHours()).toBe(0);
    expect(result.getMinutes()).toBe(0);
  });

  it('handles 1625 minutes (27:05) — real overnight value from iyt2', () => {
    const result = minutesToDate(baseDate, 1625); // 27:05 = next day 3:05
    expect(result.getDate()).toBe(25);
    expect(result.getHours()).toBe(3);
    expect(result.getMinutes()).toBe(5);
  });

  it('handles 1900 minutes (31:40) — long-haul overnight arrival', () => {
    const result = minutesToDate(baseDate, 1900); // 31:40 = next day 7:40
    expect(result.getDate()).toBe(25);
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(40);
  });

  it('handles 1975 minutes (32:55) — latest known overnight value', () => {
    const result = minutesToDate(baseDate, 1975); // 32:55 = next day 8:55
    expect(result.getDate()).toBe(25);
    expect(result.getHours()).toBe(8);
    expect(result.getMinutes()).toBe(55);
  });

  it('previous service day + overnight produces correct date', () => {
    // Simulates Issue #66: serviceDate = Wed Mar 25, d=1900
    // Expected: Thu Mar 26 07:40 (not Fri Mar 27)
    const wednesday = new Date(2026, 2, 25, 0, 0, 0, 0);
    const result = minutesToDate(wednesday, 1900);
    expect(result.getDate()).toBe(26); // Thursday
    expect(result.getMonth()).toBe(2); // March
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(40);
  });

  it('today service day + overnight produces next calendar day', () => {
    // serviceDate = Thu Mar 26, d=1900
    // Expected: Fri Mar 27 07:40
    const thursday = new Date(2026, 2, 26, 0, 0, 0, 0);
    const result = minutesToDate(thursday, 1900);
    expect(result.getDate()).toBe(27); // Friday
    expect(result.getMonth()).toBe(2); // March
    expect(result.getHours()).toBe(7);
    expect(result.getMinutes()).toBe(40);
  });

  it('handles month boundary rollover', () => {
    // Mar 31 + 1500 min (25:00) = Apr 1 01:00
    const lastDay = new Date(2026, 2, 31, 0, 0, 0, 0);
    const result = minutesToDate(lastDay, 1500);
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(1);
    expect(result.getHours()).toBe(1);
    expect(result.getMinutes()).toBe(0);
  });

  it('handles non-midnight baseDate by resetting to midnight', () => {
    // baseDate at 15:30 — setHours should override, not add
    const afternoon = new Date(2026, 2, 24, 15, 30, 0, 0);
    const result = minutesToDate(afternoon, 600); // 10:00
    expect(result.getHours()).toBe(10);
    expect(result.getMinutes()).toBe(0);
    expect(result.getDate()).toBe(24);
  });
});

// ---------------------------------------------------------------------------
// computeActiveServiceIds
// ---------------------------------------------------------------------------

describe('computeActiveServiceIds', () => {
  // Monday 2026-03-23
  const monday = new Date(2026, 2, 23);
  // Sunday 2026-03-29
  const sunday = new Date(2026, 2, 29);

  const weekdayService: CalendarServiceJson = {
    i: 'wd',
    s: '20260101',
    e: '20261231',
    d: [1, 1, 1, 1, 1, 0, 0], // Mon-Fri
  };

  const weekendService: CalendarServiceJson = {
    i: 'we',
    s: '20260101',
    e: '20261231',
    d: [0, 0, 0, 0, 0, 1, 1], // Sat-Sun
  };

  const noExceptions = new Map<string, CalendarExceptionJson[]>();

  it('returns weekday service on Monday', () => {
    const ids = computeActiveServiceIds(monday, [weekdayService, weekendService], noExceptions);
    expect(ids.has('wd')).toBe(true);
    expect(ids.has('we')).toBe(false);
  });

  it('returns weekend service on Sunday', () => {
    const ids = computeActiveServiceIds(sunday, [weekdayService, weekendService], noExceptions);
    expect(ids.has('wd')).toBe(false);
    expect(ids.has('we')).toBe(true);
  });

  it('excludes services outside date range', () => {
    const expired: CalendarServiceJson = {
      i: 'old',
      s: '20250101',
      e: '20251231',
      d: [1, 1, 1, 1, 1, 1, 1],
    };
    const ids = computeActiveServiceIds(monday, [expired], noExceptions);
    expect(ids.size).toBe(0);
  });

  it('applies exception type 1 (add)', () => {
    const exceptions = new Map<string, CalendarExceptionJson[]>([
      ['holiday', [{ i: 'holiday', d: '20260323', t: 1 }]],
    ]);
    const ids = computeActiveServiceIds(monday, [], exceptions);
    expect(ids.has('holiday')).toBe(true);
  });

  it('applies exception type 2 (remove)', () => {
    const exceptions = new Map<string, CalendarExceptionJson[]>([
      ['wd', [{ i: 'wd', d: '20260323', t: 2 }]],
    ]);
    const ids = computeActiveServiceIds(monday, [weekdayService], exceptions);
    expect(ids.has('wd')).toBe(false);
  });

  it('exception on different date has no effect', () => {
    const exceptions = new Map<string, CalendarExceptionJson[]>([
      ['wd', [{ i: 'wd', d: '20260324', t: 2 }]],
    ]);
    const ids = computeActiveServiceIds(monday, [weekdayService], exceptions);
    expect(ids.has('wd')).toBe(true);
  });
});
