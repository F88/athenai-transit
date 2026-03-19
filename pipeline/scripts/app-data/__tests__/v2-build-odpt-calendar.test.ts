/**
 * Tests for v2-build-odpt-calendar.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { OdptStationTimetable } from '../../../types/odpt-train';
import {
  buildCalendarV2,
  calendarToServiceId,
  computeDateRange,
} from '../lib/v2-build-odpt-calendar';

describe('calendarToServiceId', () => {
  it('converts Weekday to lowercase', () => {
    expect(calendarToServiceId('odpt.Calendar:Weekday')).toBe('weekday');
  });

  it('converts SaturdayHoliday to kebab-case', () => {
    expect(calendarToServiceId('odpt.Calendar:SaturdayHoliday')).toBe('saturday-holiday');
  });
});

describe('computeDateRange', () => {
  it('computes a 1-year range', () => {
    expect(computeDateRange('2025-04-01')).toEqual({
      startDate: '20250401',
      endDate: '20260401',
    });
  });

  it('handles leap year', () => {
    expect(computeDateRange('2000-02-29')).toEqual({
      startDate: '20000229',
      endDate: '20010228',
    });
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
    expect(result.exceptions).toEqual([]);
  });
});
