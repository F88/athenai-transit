import { describe, expect, it } from 'vitest';
import type { Route } from '../../../types/app/transit';
import type { TimetableEntry } from '../../../types/app/transit-composed';
import { groupTimetableEntriesByHour } from '../group-timetable-entries-by-hour';

function makeRoute(routeId: string): Route {
  return {
    route_id: routeId,
    route_short_name: routeId,
    route_short_names: {},
    route_long_name: routeId,
    route_long_names: {},
    route_type: 3,
    route_color: '000000',
    route_text_color: 'FFFFFF',
    agency_id: 'test:agency',
  };
}

function makeEntry(overrides: {
  departureMinutes: number;
  arrivalMinutes?: number;
  isTerminal?: boolean;
}): TimetableEntry {
  const route = makeRoute('test:R1');
  return {
    schedule: {
      departureMinutes: overrides.departureMinutes,
      arrivalMinutes: overrides.arrivalMinutes ?? overrides.departureMinutes,
    },
    routeDirection: {
      route,
      tripHeadsign: { name: 'Test', names: {} },
    },
    boarding: { pickupType: 0, dropOffType: 0 },
    patternPosition: {
      stopIndex: 0,
      totalStops: 10,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: false,
    },
    tripLocator: { patternId: `${route.route_id}__test`, serviceId: 'test', tripIndex: 0 },
  };
}

describe('groupTimetableEntriesByHour', () => {
  it('keys buckets by hour of displayed minute', () => {
    const entries = [
      makeEntry({ departureMinutes: 9 * 60 + 10 }),
      makeEntry({ departureMinutes: 10 * 60 + 5 }),
      makeEntry({ departureMinutes: 10 * 60 + 50 }),
    ];
    const groups = groupTimetableEntriesByHour(entries);
    expect([...groups.keys()]).toEqual([9, 10]);
    expect(groups.get(10)?.length).toBe(2);
  });

  it('uses arrivalMinutes as the bucket key for terminal entries', () => {
    // A terminal entry with arrival 10:57 / departure 11:00 must bucket into
    // hour 10 (arrival), not hour 11 (departure).
    const terminalCrossingHour = makeEntry({
      departureMinutes: 11 * 60,
      arrivalMinutes: 10 * 60 + 57,
      isTerminal: true,
    });
    const groups = groupTimetableEntriesByHour([terminalCrossingHour]);
    expect([...groups.keys()]).toEqual([10]);
    expect(groups.get(10)?.[0]).toBe(terminalCrossingHour);
  });

  it('preserves input order within each bucket', () => {
    // The helper does not sort; callers that want a display-ordered grid
    // pre-sort with sortTimetableEntriesByDisplayTime.
    const first = makeEntry({ departureMinutes: 9 * 60 + 30 });
    const second = makeEntry({ departureMinutes: 9 * 60 + 10 });
    const groups = groupTimetableEntriesByHour([first, second]);
    const bucket = groups.get(9);
    expect(bucket?.[0]).toBe(first);
    expect(bucket?.[1]).toBe(second);
  });

  it('returns an empty map for an empty input', () => {
    const groups = groupTimetableEntriesByHour([]);
    expect(groups.size).toBe(0);
  });

  it('preserves first-encounter order of hour keys', () => {
    // Map iteration order mirrors the upstream input — required by the grid,
    // which renders hour groups via Array.from(groups.entries()). Callers
    // that need ascending hour-key order should pre-sort entries by
    // displayed time.
    const entries = [
      makeEntry({ departureMinutes: 14 * 60 + 0 }),
      makeEntry({ departureMinutes: 8 * 60 + 30 }),
      makeEntry({ departureMinutes: 14 * 60 + 30 }),
      makeEntry({ departureMinutes: 11 * 60 + 0 }),
    ];
    const groups = groupTimetableEntriesByHour(entries);
    expect([...groups.keys()]).toEqual([14, 8, 11]);
  });
});
