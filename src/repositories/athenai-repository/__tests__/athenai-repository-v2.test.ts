import { describe, it, expect } from 'vitest';
import { AthenaiRepositoryV2 } from '..';
import { getEffectiveHeadsign } from '../../../domain/transit/get-effective-headsign';
import {
  TestDataSourceV2,
  createFixtureV2,
  createShapesFixtureV2,
  createInsightsFixtureV2,
  WEEKDAY,
  SATURDAY,
  WEEKDAY_OVERNIGHT,
  AFTER_BOUNDARY,
  AFTER_BOUNDARY_PAST,
  EXCEPTION_HOLIDAY,
} from './fixtures/test-data-source-v2';
import { minutesToDate } from '../../../domain/transit/calendar-utils';

/** Assert result is successful and preserve the successful result shape. */
function assertSuccess<T extends { success: boolean }>(
  result: T,
): asserts result is Extract<T, { success: true }> {
  if (!result.success) {
    throw new Error(`Expected success but got failure: ${JSON.stringify(result)}`);
  }
}

// ---------------------------------------------------------------------------
// AthenaiRepositoryV2.create
// ---------------------------------------------------------------------------

describe('AthenaiRepositoryV2.create', () => {
  it('returns repository and loadResult', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository, loadResult } = await AthenaiRepositoryV2.create(['test'], ds);
    expect(repository).toBeDefined();
    expect(loadResult.loaded).toEqual(['test']);
    expect(loadResult.failed).toHaveLength(0);
  });

  it('reports failed sources in loadResult', async () => {
    const ds = new TestDataSourceV2({});
    const { repository, loadResult } = await AthenaiRepositoryV2.create(['missing'], ds);
    expect(repository).toBeDefined();
    expect(loadResult.loaded).toHaveLength(0);
    expect(loadResult.failed).toHaveLength(1);
    expect(loadResult.failed[0].prefix).toBe('missing');
  });

  it('creates working repository even with partial failures', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository, loadResult } = await AthenaiRepositoryV2.create(['test', 'bad'], ds);
    expect(loadResult.loaded).toEqual(['test']);
    expect(loadResult.failed).toHaveLength(1);

    const stops = await repository.getAllStops();
    assertSuccess(stops);
    expect(stops.data.length).toBeGreaterThan(0);
  });
});

// ---------------------------------------------------------------------------
// getStopMetaById
// ---------------------------------------------------------------------------

describe('getStopMetaById', () => {
  it('returns the stop with metadata when it exists', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getStopMetaById('tdn_01');
    assertSuccess(result);
    expect(result.data.stop.stop_id).toBe('tdn_01');
    expect(result.data.stop.stop_name).toBe('Shin-koshinzuka');
    expect(result.data.agencies).toBeDefined();
    expect(result.data.routes).toBeDefined();
  });

  it('returns failure for unknown stop ID', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getStopMetaById('nonexistent_stop');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getStopsForRoutes
// ---------------------------------------------------------------------------

describe('getStopsForRoutes', () => {
  it('returns stop IDs for a single route', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const stopIds = repository.getStopsForRoutes(new Set(['route_subway']));
    expect(stopIds).toEqual(new Set(['sub_01', 'sub_02', 'sub_03']));
  });

  it('returns union of stops for multiple routes', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const stopIds = repository.getStopsForRoutes(new Set(['route_subway', 'route_liner']));
    expect(stopIds).toEqual(new Set(['sub_01', 'sub_02', 'sub_03', 'tdn_04', 'lnr_01', 'lnr_02']));
  });

  it('returns empty set for unknown route', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const stopIds = repository.getStopsForRoutes(new Set(['nonexistent_route']));
    expect(stopIds.size).toBe(0);
  });

  it('returns empty set for empty input', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const stopIds = repository.getStopsForRoutes(new Set());
    expect(stopIds.size).toBe(0);
  });

  it('deduplicates stops shared across patterns of the same route', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // route_bus has multiple patterns (tp_bus_i, tp_bus_o, tp_bus_i2) with overlapping stops
    const stopIds = repository.getStopsForRoutes(new Set(['route_bus']));
    expect(stopIds).toEqual(new Set(['bus_01', 'bus_02', 'bus_03', 'sub_02']));
  });
});

// ---------------------------------------------------------------------------
// getStopsInBounds
// ---------------------------------------------------------------------------

describe('getStopsInBounds', () => {
  it('returns stops within bounds', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getStopsInBounds(
      { north: 35.76, south: 35.74, east: 139.76, west: 139.72 },
      100,
    );
    assertSuccess(result);
    expect(result.data.length).toBeGreaterThan(0);
    expect(result.truncated).toBe(false);
  });

  it('excludes location_type=1 stops', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getStopsInBounds(
      { north: 35.76, south: 35.74, east: 139.76, west: 139.72 },
      100,
    );
    assertSuccess(result);
    const ids = result.data.map((s) => s.stop.stop_id);
    expect(ids).not.toContain('sta_parent');
  });
});

// ---------------------------------------------------------------------------
// getUpcomingTimetableEntries
// ---------------------------------------------------------------------------

describe('getUpcomingTimetableEntries', () => {
  it('returns stop times on weekday', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getUpcomingTimetableEntries('sub_01', WEEKDAY);
    assertSuccess(result);
    // tp_sub_n: 6 entries (600,660,720,1442,1470,1625) + tp_sub_m: 3 entries (605,665,725) = 9
    expect(result.data.length).toBe(9);
  });

  it('returns no stop times on Saturday for weekday-only route', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getUpcomingTimetableEntries('tdn_01', SATURDAY);
    assertSuccess(result);
    expect(result.data).toHaveLength(0);
  });

  it('returns flat TimetableEntry[] from multiple patterns with same route+headsign', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // bus_01 has tp_bus_i (deps=[492,552,612,672,732]) and tp_bus_i2 ([494,554])
    // At WEEKDAY 10:00 (nowMinutes=600), upcoming stop times are:
    //   tp_bus_i: 612, 672, 732 (3 entries >= 600)
    //   tp_bus_i2: none (494, 554 are before 600)
    const result = await repository.getUpcomingTimetableEntries('bus_01', WEEKDAY);
    assertSuccess(result);

    const ikebukuroEntries = result.data.filter(
      (e) =>
        e.routeDirection.route.route_id === 'route_bus' &&
        getEffectiveHeadsign(e.routeDirection) === 'Ikebukuro-eki',
    );
    expect(ikebukuroEntries).toHaveLength(3);
  });

  it('returns error for unknown stop', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getUpcomingTimetableEntries('nonexistent', WEEKDAY);
    expect(result.success).toBe(false);
  });

  it('handles calendar exceptions', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getUpcomingTimetableEntries('sub_01', EXCEPTION_HOLIDAY);
    assertSuccess(result);
    // With flat TimetableEntry[], each stop time is a separate entry.
    // Previously 2 groups (route+headsign aggregated), now 3 individual entries.
    expect(result.data.length).toBe(3);
  });

  // --- previous service day's overnight entries ---

  describe('previous service day overnight entries', () => {
    it('includes overnight entries in data with correct serviceDate', async () => {
      const fixture = createFixtureV2();
      const ds = new TestDataSourceV2({ test: fixture });
      const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

      // WEEKDAY_OVERNIGHT = Thu 01:30 → service day = Wed (Mar 11)
      // sub_01 has overnight entries 1442, 1470, 1625 on svc_weekday
      const result = await repository.getUpcomingTimetableEntries('sub_01', WEEKDAY_OVERNIGHT);
      assertSuccess(result);
      expect(result.data.length).toBeGreaterThan(0);

      // All entries should have a serviceDate
      for (const entry of result.data) {
        expect(entry.serviceDate).toBeInstanceOf(Date);
      }
    });

    it('meta.totalEntries includes overnight entries from previous service day', async () => {
      const fixture = createFixtureV2();
      const ds = new TestDataSourceV2({ test: fixture });
      const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

      // At WEEKDAY_OVERNIGHT (Thu 01:30, service day = Wed),
      // today (Wed) entries + yesterday (Tue) overnight entries should both be in totalEntries
      const result = await repository.getUpcomingTimetableEntries('sub_01', WEEKDAY_OVERNIGHT);
      assertSuccess(result);
      // totalEntries should be >= data.length (meta counts full day including overnight)
      expect(result.meta.totalEntries).toBeGreaterThanOrEqual(result.data.length);
    });

    it('meta.isBoardableOnServiceDay reflects overnight boardable entries', async () => {
      const fixture = createFixtureV2();
      const ds = new TestDataSourceV2({ test: fixture });
      const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

      // sub_01 has boardable entries (non-terminal, pickupType=0) in both today and overnight
      const result = await repository.getUpcomingTimetableEntries('sub_01', WEEKDAY_OVERNIGHT);
      assertSuccess(result);
      expect(result.meta.isBoardableOnServiceDay).toBe(true);
    });
  });

  // --- after service day boundary (03:00+) overnight edge cases ---

  describe('after service day boundary (03:00+)', () => {
    it('includes yesterday overnight entry that has not yet passed', async () => {
      const fixture = createFixtureV2();
      const ds = new TestDataSourceV2({ test: fixture });
      const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

      // AFTER_BOUNDARY = Thu 03:03, service day = Thu
      // Wednesday's svc_weekday has 1625 (27:05 = Thu 03:05), still 2 min away.
      // Thursday also has 1625 from today's service.
      // So we expect 2 entries at 1625 (yesterday overnight + today).
      const result = await repository.getUpcomingTimetableEntries('sub_01', AFTER_BOUNDARY);
      assertSuccess(result);
      const entries1625 = result.data.filter((e) => e.schedule.departureMinutes === 1625);
      expect(entries1625).toHaveLength(2); // yesterday overnight + today
    });

    it('excludes yesterday overnight entry that has already passed', async () => {
      const fixture = createFixtureV2();
      const ds = new TestDataSourceV2({ test: fixture });
      const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

      // AFTER_BOUNDARY_PAST = Thu 03:06, service day = Thu
      // Wednesday's 1625 (27:05 = Thu 03:05) has passed 1 min ago.
      // However, Thursday also has 1625 in svc_weekday (today loop),
      // so departureMinutes=1625 still appears from today's service.
      // We can only verify that the count of 1625 entries is 1 (today only),
      // not 2 (today + yesterday overnight).
      const result = await repository.getUpcomingTimetableEntries('sub_01', AFTER_BOUNDARY_PAST);
      assertSuccess(result);
      const overnightEntries = result.data.filter((e) => e.schedule.departureMinutes === 1625);
      // Only 1 (from today/Thursday), not 2 (today + yesterday/Wednesday)
      expect(overnightEntries).toHaveLength(1);
    });

    it('overnight entry from yesterday has correct serviceDate for display', async () => {
      const fixture = createFixtureV2();
      const ds = new TestDataSourceV2({ test: fixture });
      const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

      // AFTER_BOUNDARY = Thu 03:03 (Mar 12), service day = Thu
      // Wednesday's 1625 (27:05 = Thu 03:05) is returned as upcoming.
      const result = await repository.getUpcomingTimetableEntries('sub_01', AFTER_BOUNDARY);
      assertSuccess(result);

      // Find the overnight entries (1625 appears twice: today + yesterday)
      const entries1625 = result.data.filter((e) => e.schedule.departureMinutes === 1625);
      expect(entries1625.length).toBeGreaterThanOrEqual(2);

      // Yesterday's overnight entry should have serviceDate = Wednesday (Mar 11)
      // Today's entry should have serviceDate = Thursday (Mar 12)
      const yesterdayEntry = entries1625.find((e) => e.serviceDate.getDate() === 11);
      const todayEntry = entries1625.find((e) => e.serviceDate.getDate() === 12);
      expect(yesterdayEntry).toBeDefined();
      expect(todayEntry).toBeDefined();

      // Using entry.serviceDate produces correct display date.
      // Yesterday's overnight: minutesToDate(Wed Mar 11, 1625) = Thu 03:05 (Mar 12)
      const displayDate = minutesToDate(yesterdayEntry!.serviceDate, 1625);
      expect(displayDate.getDate()).toBe(12); // March 12 (Thursday)
      expect(displayDate.getHours()).toBe(3);
      expect(displayDate.getMinutes()).toBe(5);

      // Today's entry: minutesToDate(Thu Mar 12, 1625) = Fri 03:05 (Mar 13)
      // This is a different trip — it will depart tomorrow at 03:05.
      const todayDisplayDate = minutesToDate(todayEntry!.serviceDate, 1625);
      expect(todayDisplayDate.getDate()).toBe(13); // March 13 (Friday)
    });
  });

  it('respects limit on total entries', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getUpcomingTimetableEntries('sub_01', WEEKDAY, 2);
    assertSuccess(result);
    expect(result.data.length).toBeLessThanOrEqual(2);
  });

  it('returns earliest entries across patterns when limit is applied', async () => {
    const fixture = createFixtureV2();
    // Modify tp_bus_i2 to have a stop time at 610 (earlier than tp_bus_i's 612)
    const tt = fixture.data.timetable.data['bus_01'];
    const bus_i2_group = tt.find((g) => g.tp === 'tp_bus_i2');
    if (bus_i2_group) {
      bus_i2_group.d['svc_weekday'] = [494, 554, 610];
      bus_i2_group.a['svc_weekday'] = [494, 554, 610];
    }

    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // With limit=2, should get the 2 earliest overall
    const result = await repository.getUpcomingTimetableEntries('bus_01', WEEKDAY, 2);
    assertSuccess(result);
    expect(result.data).toHaveLength(2);

    // First entry should be 610 (10:10), from tp_bus_i2
    expect(result.data[0].schedule.departureMinutes).toBe(610);
  });

  it('sets correct patternPosition for circular route (origin vs terminal at same stop)', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // bus_01 is both origin (index 0) and terminal (index 3) in tp_bus_c.
    // The fixture has two stop times: 620 (pickupType=0, origin) and 650 (pickupType=1, terminal).
    const result = await repository.getUpcomingTimetableEntries('bus_01', WEEKDAY);
    assertSuccess(result);

    const circularEntries = result.data.filter(
      (e) => getEffectiveHeadsign(e.routeDirection) === 'Circular',
    );
    expect(circularEntries).toHaveLength(2);

    // Origin departure (pickupType=0, stopIndex=0)
    const origin = circularEntries.find((e) => e.schedule.departureMinutes === 620)!;
    expect(origin).toBeDefined();
    expect(origin.patternPosition.stopIndex).toBe(0);
    expect(origin.patternPosition.isOrigin).toBe(true);
    expect(origin.patternPosition.isTerminal).toBe(false);

    // Terminal arrival (pickupType=1, stopIndex=3)
    const terminal = circularEntries.find((e) => e.schedule.departureMinutes === 650)!;
    expect(terminal).toBeDefined();
    expect(terminal.patternPosition.stopIndex).toBe(3);
    expect(terminal.patternPosition.isTerminal).toBe(true);
    expect(terminal.patternPosition.isOrigin).toBe(false);
  });

  it('resolves stop_headsign into RouteDirection (keio-bus: h="" + sh)', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getUpcomingTimetableEntries('bus_01', WEEKDAY);
    assertSuccess(result);

    // tp_ptr_sh: empty trip_headsign, stop_headsign = 'Oji-eki via Park' at bus_01
    const shEntries = result.data.filter(
      (e) => getEffectiveHeadsign(e.routeDirection) === 'Oji-eki via Park',
    );
    expect(shEntries.length).toBeGreaterThan(0);

    const entry = shEntries[0];
    expect(entry.routeDirection.tripHeadsign.name).toBe('');
    expect(entry.routeDirection.stopHeadsign).toBeDefined();
    expect(entry.routeDirection.stopHeadsign!.name).toBe('Oji-eki via Park');
    // stop_headsigns translation should be resolved
    // feed_lang="ja" → base value "Oji-eki via Park" is injected as ja candidate
    expect(entry.routeDirection.stopHeadsign!.names).toEqual({
      ja: 'Oji-eki via Park',
      en: 'Oji Station via Park',
    });
  });

  it('resolves mid-trip stop_headsign change (kyoto-city-bus pattern)', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // bus_01: tp_bus_sh has sh='Oji-eki via All Stops'
    const result1 = await repository.getUpcomingTimetableEntries('bus_01', WEEKDAY);
    assertSuccess(result1);
    const bus01Entries = result1.data.filter(
      (e) => getEffectiveHeadsign(e.routeDirection) === 'Oji-eki via All Stops',
    );
    expect(bus01Entries.length).toBeGreaterThan(0);
    expect(bus01Entries[0].routeDirection.stopHeadsign!.name).toBe('Oji-eki via All Stops');
    expect(bus01Entries[0].routeDirection.tripHeadsign.name).toBe('Oji-eki via All Stops');

    // bus_02: tp_bus_sh has sh='Oji-eki' (different from trip_headsign 'Oji-eki via All Stops')
    const result2 = await repository.getUpcomingTimetableEntries('bus_02', WEEKDAY);
    assertSuccess(result2);
    // Find entries from tp_bus_sh: stopHeadsign present AND tripHeadsign = 'Oji-eki via All Stops'
    const shEntry = result2.data.find(
      (e) =>
        e.routeDirection.stopHeadsign != null &&
        e.routeDirection.tripHeadsign.name === 'Oji-eki via All Stops',
    );
    expect(shEntry).toBeDefined();
    expect(shEntry!.routeDirection.stopHeadsign!.name).toBe('Oji-eki');
    expect(getEffectiveHeadsign(shEntry!.routeDirection)).toBe('Oji-eki');
  });
});

// ---------------------------------------------------------------------------
// getRouteTypesForStop
// ---------------------------------------------------------------------------

describe('getRouteTypesForStop', () => {
  it('returns route types for multi-type stop', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getRouteTypesForStop('sub_02');
    assertSuccess(result);
    expect(result.data).toEqual([1, 3]);
  });

  it('returns error for stop with no routes', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getRouteTypesForStop('stop_closed');
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// getFullDayTimetableEntries
// ---------------------------------------------------------------------------

describe('getFullDayTimetableEntries', () => {
  it('returns all stop times for a stop', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getFullDayTimetableEntries('bus_01', WEEKDAY);
    assertSuccess(result);
    // tp_bus_i(5) + tp_bus_o(5) + tp_ptr_e(5) + tp_ptr_sh(5) + tp_bus_sh(5) + tp_bus_i2(2) + tp_bus_c(2) = 29
    expect(result.data).toHaveLength(29);
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].schedule.departureMinutes).toBeGreaterThanOrEqual(
        result.data[i - 1].schedule.departureMinutes,
      );
    }
    // meta: all entries are boardable (non-terminal, pickupType=0)
    expect(result.meta.isBoardableOnServiceDay).toBe(true);
    expect(result.meta.totalEntries).toBe(29);
  });

  it('sets correct patternPosition for circular route in full-day timetable', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getFullDayTimetableEntries('bus_01', WEEKDAY);
    assertSuccess(result);

    const circularEntries = result.data.filter(
      (e) => getEffectiveHeadsign(e.routeDirection) === 'Circular',
    );
    expect(circularEntries).toHaveLength(2);

    const origin = circularEntries.find((e) => e.schedule.departureMinutes === 620)!;
    expect(origin).toBeDefined();
    expect(origin.patternPosition.stopIndex).toBe(0);
    expect(origin.patternPosition.isOrigin).toBe(true);
    expect(origin.patternPosition.isTerminal).toBe(false);

    const terminal = circularEntries.find((e) => e.schedule.departureMinutes === 650)!;
    expect(terminal).toBeDefined();
    expect(terminal.patternPosition.stopIndex).toBe(3);
    expect(terminal.patternPosition.isOrigin).toBe(false);
    expect(terminal.patternPosition.isTerminal).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// getTripSnapshot
// ---------------------------------------------------------------------------

describe('getTripSnapshot', () => {
  it('reconstructs a trip snapshot with ordered stopTimes', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = repository.getTripSnapshot(
      { patternId: 'tp_bus_c', serviceId: 'svc_weekday', tripIndex: 0 },
      WEEKDAY,
    );
    assertSuccess(result);

    expect(result.data.route.route_id).toBe('route_bus');
    expect(result.data.tripHeadsign.name).toBe('Circular');
    expect(result.data.stopTimes).toHaveLength(4);
    expect(
      result.data.stopTimes.map((stopTime) => stopTime.timetableEntry.patternPosition.stopIndex),
    ).toEqual([0, 1, 2, 3]);
    expect(result.data.stopTimes[0]?.stopMeta?.stop.stop_id).toBe('bus_01');
    expect(result.data.stopTimes[3]?.stopMeta?.stop.stop_id).toBe('bus_01');
  });

  it('returns failure for unknown trip pattern', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = repository.getTripSnapshot(
      { patternId: 'missing_pattern', serviceId: 'svc_weekday', tripIndex: 0 },
      WEEKDAY,
    );

    expect(result.success).toBe(false);
  });

  it('returns failure when no rows match the requested service or trip index', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const missingService = repository.getTripSnapshot(
      { patternId: 'tp_sub_n', serviceId: 'svc_missing', tripIndex: 0 },
      WEEKDAY,
    );
    const missingTripIndex = repository.getTripSnapshot(
      { patternId: 'tp_sub_n', serviceId: 'svc_weekday', tripIndex: 999 },
      WEEKDAY,
    );

    expect(missingService.success).toBe(false);
    expect(missingTripIndex.success).toBe(false);
  });

  it('falls back to departure time when arrivals are unavailable', async () => {
    const fixture = createFixtureV2();
    const timetableGroup = fixture.data.timetable.data['sub_01']?.[0] as
      | { a?: Record<string, number[]> }
      | undefined;
    if (!timetableGroup) {
      throw new Error('Expected sub_01 timetable fixture');
    }
    delete timetableGroup.a;

    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = repository.getTripSnapshot(
      { patternId: 'tp_sub_n', serviceId: 'svc_weekday', tripIndex: 0 },
      WEEKDAY,
    );
    assertSuccess(result);

    const firstStop = result.data.stopTimes.find(
      (stopTime) => stopTime.timetableEntry.patternPosition.stopIndex === 0,
    );
    expect(firstStop).toBeDefined();
    expect(firstStop?.timetableEntry.schedule.arrivalMinutes).toBe(
      firstStop?.timetableEntry.schedule.departureMinutes,
    );
  });
});

// ---------------------------------------------------------------------------
// getTripInspectionTargets
// ---------------------------------------------------------------------------

describe('getTripInspectionTargets', () => {
  it('returns trip-inspection targets at the queried stop in timetable order', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getTripInspectionTargets({
      tripLocator: { patternId: 'tp_bus_o', serviceId: 'svc_weekday', tripIndex: 0 },
      serviceDate: WEEKDAY,
      stopId: 'bus_01',
    });
    const timetable = await repository.getFullDayTimetableEntries('bus_01', WEEKDAY);

    assertSuccess(result);
    assertSuccess(timetable);
    expect(result.data).toEqual(
      timetable.data.map((entry) => ({
        tripLocator: entry.tripLocator,
        serviceDate: WEEKDAY,
        stopIndex: entry.patternPosition.stopIndex,
        departureMinutes: entry.schedule.departureMinutes,
      })),
    );
  });

  it('does not require the current trip pattern to exist', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getTripInspectionTargets({
      tripLocator: { patternId: 'missing_pattern', serviceId: 'svc_weekday', tripIndex: 0 },
      serviceDate: WEEKDAY,
      stopId: 'bus_01',
    });
    const timetable = await repository.getFullDayTimetableEntries('bus_01', WEEKDAY);

    assertSuccess(result);
    assertSuccess(timetable);
    expect(result.data).toEqual(
      timetable.data.map((entry) => ({
        tripLocator: entry.tripLocator,
        serviceDate: WEEKDAY,
        stopIndex: entry.patternPosition.stopIndex,
        departureMinutes: entry.schedule.departureMinutes,
      })),
    );
  });
});

// ---------------------------------------------------------------------------
// getRouteShapes (background loading)
// ---------------------------------------------------------------------------

describe('getRouteShapes', () => {
  it('returns shapes from background-loaded bundle', async () => {
    const fixture = createFixtureV2();
    const shapesBundle = createShapesFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, { test: shapesBundle });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getRouteShapes();
    assertSuccess(result);
    expect(result.data.length).toBe(4);
  });

  it('returns empty shapes when no shapes bundle available', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getRouteShapes();
    assertSuccess(result);
    expect(result.data).toHaveLength(0);
  });

  it('enriches shapes with default freq from first service group', async () => {
    const fixture = createFixtureV2();
    const shapesBundle = createShapesFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, { test: shapesBundle }, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getRouteShapes();
    assertSuccess(result);

    // route_bus shape should have freq from the first service group ("wd").
    // wd: tp_bus_i (freq=50) + tp_bus_o (freq=30) = 80
    const busShape = result.data.find((s) => s.routeId === 'route_bus');
    expect(busShape).toBeDefined();
    expect(busShape!.freq).toBe(80);

    // route_toden shape: wd has tp_tdn_w (freq=30)
    const todenShape = result.data.find((s) => s.routeId === 'route_toden');
    expect(todenShape).toBeDefined();
    expect(todenShape!.freq).toBe(30);

    // route_subway has no tripPatternStats → freq undefined
    const subwayShape = result.data.find((s) => s.routeId === 'route_subway');
    expect(subwayShape).toBeDefined();
    expect(subwayShape!.freq).toBeUndefined();
  });

  it('does not bake stats into RouteShape.freq for non-first groups', async () => {
    const fixture = createFixtureV2();
    const shapesBundle = createShapesFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, { test: shapesBundle }, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getRouteShapes();
    assertSuccess(result);

    // RouteShape.freq uses the first service group as default.
    // Verify it does NOT contain holiday values (which would indicate
    // the wrong group or overwrite behavior).
    const busShape = result.data.find((s) => s.routeId === 'route_bus');
    expect(busShape!.freq).toBe(80); // wd (first group), not 25 (ho)
  });
});

// ---------------------------------------------------------------------------
// StopWithMeta.stats after enrichment
// ---------------------------------------------------------------------------

describe('StopWithMeta.stats after enrichment', () => {
  it('stats is not baked into StopWithMeta (use resolveStopStats instead)', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, {}, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // After enrichStopInsights, StopWithMeta.stats is NOT set.
    // Stats are stored in the internal stopInsightsMap and accessed
    // via resolveStopStats(stopId, serviceDate) for date-aware resolution.
    const result = await repository.getStopMetaById('tdn_01');
    assertSuccess(result);
    expect(result.data.stats).toBeUndefined();

    // But resolveStopStats returns the correct stats for the date.
    const stats = repository.resolveStopStats('tdn_01', WEEKDAY);
    expect(stats).toBeDefined();
    expect(stats!.freq).toBe(100);
  });
});

// ---------------------------------------------------------------------------
// getAllSourceMeta
// ---------------------------------------------------------------------------

describe('getAllSourceMeta', () => {
  it('returns source metadata', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getAllSourceMeta();
    assertSuccess(result);
    expect(result.data).toHaveLength(1);
    expect(result.data[0].id).toBe('test');
    // agency-attributes.ts has no entry for test:agency, so name
    // falls back to prefix
    expect(result.data[0].name).toBe('test');
  });
});

// ---------------------------------------------------------------------------
// resolveStopStats / resolveRouteFreq (Issue #87)
// ---------------------------------------------------------------------------

describe('resolveStopStats', () => {
  it('returns weekday stats on a weekday', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, {}, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const stats = repository.resolveStopStats('tdn_01', WEEKDAY);
    expect(stats).toBeDefined();
    expect(stats!.freq).toBe(100);
    expect(stats!.routeCount).toBe(2);
    expect(stats!.routeTypeCount).toBe(1);
    expect(stats!.earliestDeparture).toBe(490);
    expect(stats!.latestDeparture).toBe(730);
  });

  it('returns holiday stats on a Saturday', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, {}, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const stats = repository.resolveStopStats('bus_01', SATURDAY);
    expect(stats).toBeDefined();
    expect(stats!.freq).toBe(80);
    expect(stats!.routeCount).toBe(2);
    expect(stats!.routeTypeCount).toBe(1);
    expect(stats!.earliestDeparture).toBe(540);
    expect(stats!.latestDeparture).toBe(700);
  });

  it('returns holiday stats on exception holiday (weekday overridden)', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, {}, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // EXCEPTION_HOLIDAY: Wed Mar 4 with svc_weekday removed, svc_holiday added
    const stats = repository.resolveStopStats('bus_01', EXCEPTION_HOLIDAY);
    expect(stats).toBeDefined();
    expect(stats!.freq).toBe(80); // holiday freq
  });

  it('returns undefined for unknown stop', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, {}, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    expect(repository.resolveStopStats('nonexistent', WEEKDAY)).toBeUndefined();
  });

  it('returns undefined when insights are not loaded', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    expect(repository.resolveStopStats('tdn_01', WEEKDAY)).toBeUndefined();
  });

  it('returns undefined when no service group matches active services', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, {}, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // Date outside the calendar validity period (20260101-20261231).
    // No service IDs are active, so no group can match.
    const outOfRange = new Date('2028-06-15T10:00:00');
    expect(repository.resolveStopStats('tdn_01', outOfRange)).toBeUndefined();
  });

  it('returns undefined when stop exists in insights but not in the matched group', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, {}, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // bus_03 exists in the timetable but is NOT in stopStats for any group.
    // Service group matches (weekday), but no stats entry for this stop.
    expect(repository.resolveStopStats('bus_03', WEEKDAY)).toBeUndefined();
  });

  it('returns undefined when stop has stats in one group but not the matched group', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, {}, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // tdn_01 has stats in "wd" group (freq=100) but NOT in "ho" group.
    // On Saturday (holiday), the "ho" group is matched but has no stats for tdn_01.
    expect(repository.resolveStopStats('tdn_01', WEEKDAY)).toBeDefined();
    expect(repository.resolveStopStats('tdn_01', WEEKDAY)!.freq).toBe(100);
    expect(repository.resolveStopStats('tdn_01', SATURDAY)).toBeUndefined();
  });
});

describe('resolveRouteFreq', () => {
  it('returns weekday freq on a weekday (accumulated across patterns)', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const shapes = createShapesFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, { test: shapes }, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);
    // Wait for shapes background load to complete
    await repository.getRouteShapes();

    // route_bus has tp_bus_i (freq=50) + tp_bus_o (freq=30) = 80
    const freq = repository.resolveRouteFreq('route_bus', WEEKDAY);
    expect(freq).toBe(80);
  });

  it('returns holiday freq on a Saturday (accumulated across patterns)', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const shapes = createShapesFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, { test: shapes }, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);
    await repository.getRouteShapes();

    // route_bus has tp_bus_i (freq=15) + tp_bus_o (freq=10) = 25
    const freq = repository.resolveRouteFreq('route_bus', SATURDAY);
    expect(freq).toBe(25);
  });

  it('returns undefined for unknown route', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const shapes = createShapesFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, { test: shapes }, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);
    await repository.getRouteShapes();

    expect(repository.resolveRouteFreq('nonexistent', WEEKDAY)).toBeUndefined();
  });

  it('returns undefined for route that exists in shapes but has no tripPatternStats', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const shapes = createShapesFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, { test: shapes }, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);
    await repository.getRouteShapes();

    // route_liner exists in shapes but has no entry in insights tripPatternStats
    expect(repository.resolveRouteFreq('route_liner', WEEKDAY)).toBeUndefined();
  });

  it('returns undefined when insights are not loaded', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    expect(repository.resolveRouteFreq('route_bus', WEEKDAY)).toBeUndefined();
  });

  it('returns undefined when no service group matches active services', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const shapes = createShapesFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, { test: shapes }, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);
    await repository.getRouteShapes();

    const outOfRange = new Date('2028-06-15T10:00:00');
    expect(repository.resolveRouteFreq('route_bus', outOfRange)).toBeUndefined();
  });

  it('returns undefined when route exists in routeFreqMap but matched group has no freq', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const shapes = createShapesFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, { test: shapes }, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);
    await repository.getRouteShapes();

    // route_toden has tp_tdn_w in "wd" group (freq=30) but NOT in "ho" group.
    // On Saturday (holiday), the "ho" group is matched but has no freq for route_toden.
    expect(repository.resolveRouteFreq('route_toden', WEEKDAY)).toBe(30);
    expect(repository.resolveRouteFreq('route_toden', SATURDAY)).toBeUndefined();
  });

  // Note: resolveRouteFreq depends on routeFreqMap which is populated by
  // loadAllShapesWithInsights (background load). Before that completes,
  // resolveRouteFreq returns undefined because the map is empty. This is
  // by design — routeFreqMap is NOT populated by enrichStopInsights.
  // A deterministic test for this race is not feasible due to microtask
  // ordering, so the invariant is documented here rather than asserted.
});

// ---------------------------------------------------------------------------
// Service group selection via repository (Issue #87 integration)
// ---------------------------------------------------------------------------

describe('resolveStopStats service group selection', () => {
  it('selects correct group when only one group has overlap', async () => {
    const fixture = createFixtureV2();
    const insights = createInsightsFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture }, {}, { test: insights });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    // EXCEPTION_HOLIDAY: Mar 4 (Wed) with svc_weekday REMOVED, svc_holiday ADDED.
    // Active serviceIds = { svc_holiday }.
    // "wd" group has { svc_weekday } → 0 overlap
    // "ho" group has { svc_holiday } → 1 overlap
    // Must pick "ho" (not "wd" which is data[0]).
    const stats = repository.resolveStopStats('bus_01', EXCEPTION_HOLIDAY);
    expect(stats).toBeDefined();
    expect(stats!.freq).toBe(80); // ho group freq, not wd (200)
  });
});
