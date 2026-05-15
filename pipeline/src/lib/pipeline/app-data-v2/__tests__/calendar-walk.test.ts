/**
 * Tests for calendar-walk.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { CalendarExceptionJson, CalendarServiceJson } from '@contracts/data/transit-json';

import {
  addUtcDays,
  buildExceptionMap,
  computeActiveServiceIds,
  formatGtfsDateKey,
  getCalendarDateRange,
  getMondayFirstDayIndex,
  walkCalendarDates,
} from '../calendar-walk';

function svc(
  id: string,
  start: string,
  end: string,
  d: number[],
): CalendarServiceJson {
  return { i: id, s: start, e: end, d };
}

function exc(serviceId: string, date: string, type: number): CalendarExceptionJson {
  return { i: serviceId, d: date, t: type };
}

describe('formatGtfsDateKey', () => {
  it('formats a UTC date as YYYYMMDD with zero padding', () => {
    expect(formatGtfsDateKey(new Date(Date.UTC(2026, 0, 3)))).toBe('20260103');
    expect(formatGtfsDateKey(new Date(Date.UTC(2026, 11, 31)))).toBe('20261231');
  });

  it('uses UTC components, not local time', () => {
    // Construct via UTC explicitly so the test is timezone-independent
    expect(formatGtfsDateKey(new Date(Date.UTC(2026, 4, 15)))).toBe('20260515');
  });
});

describe('getMondayFirstDayIndex', () => {
  it('maps Monday..Sunday to 0..6', () => {
    expect(getMondayFirstDayIndex(new Date(Date.UTC(2026, 4, 11)))).toBe(0); // Mon
    expect(getMondayFirstDayIndex(new Date(Date.UTC(2026, 4, 12)))).toBe(1); // Tue
    expect(getMondayFirstDayIndex(new Date(Date.UTC(2026, 4, 13)))).toBe(2); // Wed
    expect(getMondayFirstDayIndex(new Date(Date.UTC(2026, 4, 14)))).toBe(3); // Thu
    expect(getMondayFirstDayIndex(new Date(Date.UTC(2026, 4, 15)))).toBe(4); // Fri
    expect(getMondayFirstDayIndex(new Date(Date.UTC(2026, 4, 16)))).toBe(5); // Sat
    expect(getMondayFirstDayIndex(new Date(Date.UTC(2026, 4, 17)))).toBe(6); // Sun
  });
});

describe('addUtcDays', () => {
  it('adds positive days without mutating the input', () => {
    const orig = new Date(Date.UTC(2026, 4, 15));
    const next = addUtcDays(orig, 1);
    expect(formatGtfsDateKey(next)).toBe('20260516');
    expect(formatGtfsDateKey(orig)).toBe('20260515');
  });

  it('handles month and year boundaries', () => {
    expect(formatGtfsDateKey(addUtcDays(new Date(Date.UTC(2026, 4, 31)), 1))).toBe('20260601');
    expect(formatGtfsDateKey(addUtcDays(new Date(Date.UTC(2026, 11, 31)), 1))).toBe('20270101');
  });

  it('accepts negative deltas', () => {
    expect(formatGtfsDateKey(addUtcDays(new Date(Date.UTC(2026, 0, 1)), -1))).toBe('20251231');
  });
});

describe('buildExceptionMap', () => {
  it('groups exceptions by service_id preserving insertion order', () => {
    const map = buildExceptionMap([
      exc('svc:1', '20260501', 1),
      exc('svc:2', '20260502', 2),
      exc('svc:1', '20260503', 1),
    ]);
    expect(map.size).toBe(2);
    expect(map.get('svc:1')).toEqual([
      exc('svc:1', '20260501', 1),
      exc('svc:1', '20260503', 1),
    ]);
    expect(map.get('svc:2')).toEqual([exc('svc:2', '20260502', 2)]);
  });

  it('returns an empty map for an empty input', () => {
    expect(buildExceptionMap([]).size).toBe(0);
  });
});

describe('getCalendarDateRange', () => {
  it('returns the min and max across services and exceptions', () => {
    const range = getCalendarDateRange(
      [svc('svc:1', '20260401', '20260630', [1, 1, 1, 1, 1, 0, 0])],
      [exc('svc:1', '20260315', 1), exc('svc:1', '20260801', 1)],
    );
    expect(range).not.toBeNull();
    expect(formatGtfsDateKey(range!.min)).toBe('20260315');
    expect(formatGtfsDateKey(range!.max)).toBe('20260801');
  });

  it('returns null when both services and exceptions are empty', () => {
    expect(getCalendarDateRange([], [])).toBeNull();
  });

  it('returns null when no entry has a parseable date', () => {
    expect(
      getCalendarDateRange(
        [svc('svc:1', '', '', [1, 0, 0, 0, 0, 0, 0])],
        [exc('svc:1', '', 1)],
      ),
    ).toBeNull();
  });

  it('skips entries with unparseable dates but uses the rest', () => {
    const range = getCalendarDateRange(
      [
        svc('svc:1', 'not-a-date', '20260601', [1, 1, 1, 1, 1, 0, 0]),
        svc('svc:2', '20260301', 'not-a-date', [1, 1, 1, 1, 1, 0, 0]),
      ],
      [],
    );
    expect(range).not.toBeNull();
    expect(formatGtfsDateKey(range!.min)).toBe('20260301');
    expect(formatGtfsDateKey(range!.max)).toBe('20260601');
  });
});

describe('computeActiveServiceIds', () => {
  const services: CalendarServiceJson[] = [
    svc('wd', '20260501', '20260531', [1, 1, 1, 1, 1, 0, 0]),
    svc('sa', '20260501', '20260531', [0, 0, 0, 0, 0, 1, 0]),
  ];
  const exceptions: CalendarExceptionJson[] = [
    exc('wd', '20260504', 2), // remove wd on Mon 2026-05-04
    exc('sa', '20260507', 1), // add sa on Thu 2026-05-07
    exc('hol', '20260505', 1), // calendar_dates-only service on Tue 2026-05-05
  ];

  it('returns weekly-pattern services active on a regular weekday', () => {
    const active = computeActiveServiceIds(
      new Date(Date.UTC(2026, 4, 12)), // Tue
      services,
      buildExceptionMap(exceptions),
    );
    expect([...active].sort()).toEqual(['wd']);
  });

  it('honors calendar_dates removals (type=2)', () => {
    const active = computeActiveServiceIds(
      new Date(Date.UTC(2026, 4, 4)), // Mon, normally wd-active
      services,
      buildExceptionMap(exceptions),
    );
    expect([...active]).not.toContain('wd');
  });

  it('honors calendar_dates additions (type=1) on top of weekly pattern', () => {
    const active = computeActiveServiceIds(
      new Date(Date.UTC(2026, 4, 7)), // Thu, sa not normally active
      services,
      buildExceptionMap(exceptions),
    );
    expect([...active].sort()).toEqual(['sa', 'wd']);
  });

  it('returns calendar_dates-only services on their exception dates', () => {
    const active = computeActiveServiceIds(
      new Date(Date.UTC(2026, 4, 5)),
      services,
      buildExceptionMap(exceptions),
    );
    expect(active.has('hol')).toBe(true);
  });

  it('excludes services outside their start/end window', () => {
    const active = computeActiveServiceIds(
      new Date(Date.UTC(2026, 5, 1)), // 2026-06-01, beyond end
      services,
      buildExceptionMap(exceptions),
    );
    expect(active.has('wd')).toBe(false);
    expect(active.has('sa')).toBe(false);
  });
});

describe('walkCalendarDates', () => {
  it('invokes the callback once per date in the calendar range', () => {
    const calls: { date: string; size: number }[] = [];
    walkCalendarDates(
      {
        v: 1,
        data: {
          services: [svc('svc:1', '20260501', '20260503', [1, 1, 1, 1, 1, 1, 1])],
          exceptions: [],
        },
      }.data,
      (date, active) => {
        calls.push({ date: formatGtfsDateKey(date), size: active.size });
      },
    );
    expect(calls.map((c) => c.date)).toEqual(['20260501', '20260502', '20260503']);
    expect(calls.every((c) => c.size === 1)).toBe(true);
  });

  it('does not invoke the callback when the calendar has no parseable dates', () => {
    const calls: unknown[] = [];
    walkCalendarDates(
      { services: [], exceptions: [] },
      () => calls.push(null),
    );
    expect(calls).toHaveLength(0);
  });
});
