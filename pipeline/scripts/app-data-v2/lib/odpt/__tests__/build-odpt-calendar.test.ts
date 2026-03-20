/**
 * Tests for v2-build-odpt-calendar.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { OdptStationTimetable } from '../../../../../types/odpt-train';
import {
  buildCalendarV2,
  buildHolidayExceptions,
  calendarToServiceId,
  computeDateRange,
  computeHolidayEndDate,
} from '../build-calendar';

describe('calendarToServiceId', () => {
  it('converts Weekday to lowercase', () => {
    expect(calendarToServiceId('odpt.Calendar:Weekday')).toBe('weekday');
  });

  it('converts SaturdayHoliday to kebab-case', () => {
    expect(calendarToServiceId('odpt.Calendar:SaturdayHoliday')).toBe('saturday-holiday');
  });
});

describe('computeDateRange', () => {
  it('computes a 2-year range from issued date', () => {
    expect(computeDateRange('2025-04-01')).toEqual({
      startDate: '20250401',
      endDate: '20270401',
    });
  });

  it('handles leap year (Feb 29 + 2 years clamps to Feb 28)', () => {
    expect(computeDateRange('2000-02-29')).toEqual({
      startDate: '20000229',
      endDate: '20020228',
    });
  });

  it('handles leap year landing on another leap year', () => {
    expect(computeDateRange('2024-02-29')).toEqual({
      startDate: '20240229',
      endDate: '20260228',
    });
  });
});

describe('computeHolidayEndDate', () => {
  it('adds 1 year to calendar end date', () => {
    expect(computeHolidayEndDate('20270401')).toBe('20280401');
  });

  it('handles leap year clamping', () => {
    expect(computeHolidayEndDate('20240229')).toBe('20250228');
  });
});

describe('buildCalendarV2', () => {
  it('discovers calendar types from timetable data', () => {
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [],
      },
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.SaturdayHoliday',
        'dct:issued': '2025-04-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:SaturdayHoliday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [],
      },
    ];

    const result = buildCalendarV2('test', timetables, '2025-04-01');
    expect(result.services).toHaveLength(2);
    expect(result.services.map((s) => s.i)).toEqual(['test:saturday-holiday', 'test:weekday']);
  });

  it('generates holiday exceptions for weekday holidays', () => {
    const timetables: OdptStationTimetable[] = [
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.Weekday',
        'dct:issued': '2026-03-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:Weekday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [],
      },
      {
        'owl:sameAs': 'odpt.StationTimetable:Test.A.SaturdayHoliday',
        'dct:issued': '2026-03-01',
        'odpt:station': 'odpt.Station:Test.A',
        'odpt:calendar': 'odpt.Calendar:SaturdayHoliday',
        'odpt:railDirection': 'odpt.RailDirection:Outbound',
        'odpt:stationTimetableObject': [],
      },
    ];

    // 2026-03-20 is 春分の日 (Friday)
    const result = buildCalendarV2('test', timetables, '2026-03-01');
    const mar20Remove = result.exceptions.find((e) => e.d === '20260320' && e.t === 2);
    const mar20Add = result.exceptions.find((e) => e.d === '20260320' && e.t === 1);
    expect(mar20Remove).toEqual({ i: 'test:weekday', d: '20260320', t: 2 });
    expect(mar20Add).toEqual({ i: 'test:saturday-holiday', d: '20260320', t: 1 });
  });
});

// ---------------------------------------------------------------------------
// buildHolidayExceptions
// ---------------------------------------------------------------------------

describe('buildHolidayExceptions', () => {
  it('generates remove + add pairs for weekday holidays', () => {
    // 2026-03-20 (Fri) = 春分の日
    const types = new Set(['weekday', 'saturday-holiday']);
    const result = buildHolidayExceptions('test', types, '20260301', '20260401');

    const removes = result.filter((e) => e.t === 2);
    const adds = result.filter((e) => e.t === 1);

    // 春分の日 should produce one remove + one add
    expect(removes.find((e) => e.d === '20260320')).toEqual({
      i: 'test:weekday',
      d: '20260320',
      t: 2,
    });
    expect(adds.find((e) => e.d === '20260320')).toEqual({
      i: 'test:saturday-holiday',
      d: '20260320',
      t: 1,
    });
  });

  it('skips weekend holidays (already on holiday schedule)', () => {
    // 2026-05-03 (Sun) = 憲法記念日
    const types = new Set(['weekday', 'saturday-holiday']);
    const result = buildHolidayExceptions('test', types, '20260501', '20260510');

    // Sunday holidays should not generate exceptions
    const may3 = result.filter((e) => e.d === '20260503');
    expect(may3).toEqual([]);
  });

  it('returns empty when no weekday service exists', () => {
    const types = new Set(['saturday-holiday']);
    const result = buildHolidayExceptions('test', types, '20260301', '20260401');
    expect(result).toEqual([]);
  });

  it('prefers "holiday" over "saturday-holiday" when both exist', () => {
    const types = new Set(['weekday', 'holiday', 'saturday-holiday']);
    const result = buildHolidayExceptions('test', types, '20260301', '20260401');
    const adds = result.filter((e) => e.t === 1);

    for (const add of adds) {
      expect(add.i).toBe('test:holiday');
    }
  });

  it('generates exceptions for振替休日 (substitute holidays)', () => {
    // 2026-05-06 (Wed) = 振替休日 for こどもの日
    const types = new Set(['weekday', 'saturday-holiday']);
    const result = buildHolidayExceptions('test', types, '20260501', '20260510');

    const may6 = result.filter((e) => e.d === '20260506');
    expect(may6).toHaveLength(2);
    expect(may6.find((e) => e.t === 2)!.i).toBe('test:weekday');
    expect(may6.find((e) => e.t === 1)!.i).toBe('test:saturday-holiday');
  });
});
