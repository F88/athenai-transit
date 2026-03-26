import { describe, it, expect } from 'vitest';
import { AthenaiRepositoryV2, mergeSourcesV2 } from '../athenai-repository-v2';
import {
  TestDataSourceV2,
  createFixtureV2,
  createShapesFixtureV2,
  WEEKDAY,
  SATURDAY,
  WEEKDAY_OVERNIGHT,
  AFTER_BOUNDARY,
  AFTER_BOUNDARY_PAST,
  EXCEPTION_HOLIDAY,
} from './fixtures/test-data-source-v2';
import { minutesToDate } from '../../domain/transit/calendar-utils';

/** Assert result is successful and return narrowed type for safe data access. */
function assertSuccess<T>(result: {
  success: boolean;
}): asserts result is { success: true; data: T } {
  if (!result.success) {
    throw new Error(`Expected success but got failure: ${JSON.stringify(result)}`);
  }
}

// ---------------------------------------------------------------------------
// mergeSourcesV2
// ---------------------------------------------------------------------------

describe('mergeSourcesV2', () => {
  it('converts stops with empty agency_id', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    // Use l=0 stop (l=1 stops are filtered out)
    const tdn01 = merged.stops.find((s) => s.stop_id === 'tdn_01');
    expect(tdn01).toBeDefined();
    expect(tdn01!.agency_id).toBe('');
  });

  it('resolves stop_names from translations', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    const tdn01 = merged.stops.find((s) => s.stop_id === 'tdn_01');
    expect(tdn01!.stop_names).toEqual({ ja: '新庚申塚', en: 'Shin-koshinzuka' });
  });

  it('excludes location_type=1 stops (parent stations filtered until UI supports grouping)', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    const station = merged.stops.find((s) => s.stop_id === 'sta_parent');
    expect(station).toBeUndefined();
    // All stops should be l=0
    for (const s of merged.stops) {
      expect(s.location_type).toBe(0);
    }
  });

  it('builds routeMap from v2 routes', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.routeMap.size).toBe(5);
    const subway = merged.routeMap.get('route_subway');
    expect(subway).toBeDefined();
    expect(subway!.route_type).toBe(1);
    expect(subway!.agency_id).toBe('test:agency');
  });

  it('builds agencyMap with translations', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.agencyMap.size).toBe(2);
    const agency = merged.agencyMap.get('test:agency');
    expect(agency!.agency_names).toEqual({ ja: 'テスト事業者', en: 'Test Agency' });
  });

  it('builds resolvedPatterns from tripPatterns', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.resolvedPatterns.size).toBe(10);
    const subN = merged.resolvedPatterns.get('tp_sub_n');
    expect(subN).toBeDefined();
    expect(subN!.route.route_id).toBe('route_subway');
    expect(subN!.headsign).toBe('Nishi-takashimadaira');
  });

  it('builds stopRouteTypeMap via tripPattern FK', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.stopRouteTypeMap.get('sub_02')).toEqual([1, 3]);
    expect(merged.stopRouteTypeMap.get('tdn_04')).toEqual([0, 2]);
  });

  it('builds stopAgenciesMap via tripPattern -> route -> agency', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    const agencies = merged.stopAgenciesMap.get('bus_01');
    expect(agencies).toBeDefined();
    const ids = agencies!.map((a) => a.agency_id).sort();
    expect(ids).toEqual(['test:agency', 'test:partner']);
  });

  it('builds sourceMeta from feedInfo', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.sourceMetas).toHaveLength(1);
    expect(merged.sourceMetas[0].id).toBe('test');
    expect(merged.sourceMetas[0].validity.startDate).toBe('20260101');
  });

  it('merges lookup data', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);
    expect(merged.lookup).toBeDefined();
  });

  it('converts v2 optional stop fields (wb, ps, pc)', () => {
    const fixture = createFixtureV2();
    const merged = mergeSourcesV2([fixture]);

    // bus_01 has wb=1, ps='sta_parent', pc='1'
    const bus01 = merged.stops.find((s) => s.stop_id === 'bus_01');
    expect(bus01).toBeDefined();
    expect(bus01!.wheelchair_boarding).toBe(1);
    expect(bus01!.parent_station).toBe('sta_parent');
    expect(bus01!.platform_code).toBe('1');

    // bus_03 has wb=2, no ps/pc
    const bus03 = merged.stops.find((s) => s.stop_id === 'bus_03');
    expect(bus03).toBeDefined();
    expect(bus03!.wheelchair_boarding).toBe(2);
    expect(bus03!.parent_station).toBeUndefined();
    expect(bus03!.platform_code).toBeUndefined();

    // tdn_01 has no v2 optional fields
    const tdn01 = merged.stops.find((s) => s.stop_id === 'tdn_01');
    expect(tdn01).toBeDefined();
    expect(tdn01!.wheelchair_boarding).toBeUndefined();
    expect(tdn01!.parent_station).toBeUndefined();
    expect(tdn01!.platform_code).toBeUndefined();
  });
});

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
  it('returns departures on weekday', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getUpcomingTimetableEntries('sub_01', WEEKDAY);
    assertSuccess(result);
    // tp_sub_n: 6 entries (600,660,720,1442,1470,1625) + tp_sub_m: 3 entries (605,665,725) = 9
    expect(result.data.length).toBe(9);
  });

  it('returns no departures on Saturday for weekday-only route', async () => {
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
    // At WEEKDAY 10:00 (nowMinutes=600), upcoming departures are:
    //   tp_bus_i: 612, 672, 732 (3 entries >= 600)
    //   tp_bus_i2: none (494, 554 are before 600)
    const result = await repository.getUpcomingTimetableEntries('bus_01', WEEKDAY);
    assertSuccess(result);

    const ikebukuroEntries = result.data.filter(
      (e) =>
        e.routeDirection.route.route_id === 'route_bus' &&
        e.routeDirection.headsign === 'Ikebukuro-eki',
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
    // With flat TimetableEntry[], each departure is a separate entry.
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
    // Modify tp_bus_i2 to have a departure at 610 (earlier than tp_bus_i's 612)
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
  it('returns all departures for a stop', async () => {
    const fixture = createFixtureV2();
    const ds = new TestDataSourceV2({ test: fixture });
    const { repository } = await AthenaiRepositoryV2.create(['test'], ds);

    const result = await repository.getFullDayTimetableEntries('bus_01', WEEKDAY);
    assertSuccess(result);
    // tp_bus_i(5) + tp_bus_o(5) + tp_ptr_e(5) + tp_bus_i2(2) = 17
    expect(result.data).toHaveLength(17);
    for (let i = 1; i < result.data.length; i++) {
      expect(result.data[i].schedule.departureMinutes).toBeGreaterThanOrEqual(
        result.data[i - 1].schedule.departureMinutes,
      );
    }
    // meta: all entries are boardable (non-terminal, pickupType=0)
    expect(result.meta.isBoardableOnServiceDay).toBe(true);
    expect(result.meta.totalEntries).toBe(17);
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
    expect(result.data[0].name).toBe('Test');
  });
});
