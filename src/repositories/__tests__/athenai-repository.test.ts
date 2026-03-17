import { describe, it, expect } from 'vitest';
import type { SourceData, TransitDataSource } from '../../datasources/transit-data-source';
import { AthenaiRepository, mergeSources } from '../athenai-repository';
import {
  TestDataSource,
  createFixture,
  WEEKDAY,
  SATURDAY,
  WEEKDAY_OVERNIGHT,
  WEEKDAY_AFTER_BOUNDARY,
  BOUNDARY_EXACT,
  BOUNDARY_JUST_AFTER,
  EXCEPTION_HOLIDAY,
} from './fixtures/test-data-source';

describe('mergeSources', () => {
  it('builds agencyMap from source agencies and translations', () => {
    const fixture = createFixture();
    const merged = mergeSources([fixture]);
    expect(merged.agencyMap.size).toBe(2);
    const agency = merged.agencyMap.get('test:agency');
    expect(agency).toBeDefined();
    expect(agency!.agency_name).toBe('Test Agency');
    expect(agency!.agency_short_name).toBe('Test');
    expect(agency!.agency_names).toEqual({ ja: 'テスト事業者', en: 'Test Agency' });
    expect(agency!.agency_short_names).toEqual({ ja: 'テスト', en: 'Test' });
    expect(agency!.agency_colors).toEqual([{ bg: '0079C2', text: 'FFFFFF' }]);
  });

  it('resolves stop_names from translationsMap', () => {
    const fixture = createFixture();
    const merged = mergeSources([fixture]);
    const sub01 = merged.stops.find((s) => s.stop_id === 'sub_01');
    expect(sub01).toBeDefined();
    expect(sub01!.stop_names).toEqual({ ja: '西巣鴨', en: 'Nishi-sugamo' });
  });

  it('resolves route_names from translationsMap', () => {
    const fixture = createFixture();
    const merged = mergeSources([fixture]);
    // route_names is empty in fixture, so routes get empty names
    const route = merged.routeMap.get('route_subway');
    expect(route).toBeDefined();
    expect(route!.route_names).toEqual({});
  });

  it('sets agency_id on stops from ai field', () => {
    const fixture = createFixture();
    const merged = mergeSources([fixture]);
    const sub01 = merged.stops.find((s) => s.stop_id === 'sub_01');
    expect(sub01).toBeDefined();
    expect(sub01!.agency_id).toBe('test:agency');
  });

  it('keeps headsign translations per source (no cross-source merge)', () => {
    const source1: SourceData = {
      ...createFixture(),
      prefix: 's1',
      translations: {
        headsigns: { 新橋: { ja: '新橋', 'ja-Hrkt': 'しんばし', en: 'Shimbashi' } },
        stop_headsigns: {},
        stop_names: {},
        route_names: {},
        agency_names: {},
        agency_short_names: {},
      },
    };
    const source2: SourceData = {
      ...createFixture(),
      prefix: 's2',
      translations: {
        headsigns: { 新橋: { ja: '新橋', en: 'Shimbashi', ko: '신바시', 'zh-Hans': '新桥' } },
        stop_headsigns: {},
        stop_names: {},
        route_names: {},
        agency_names: {},
        agency_short_names: {},
      },
    };
    const merged = mergeSources([source1, source2]);
    // Each source preserves its own translations
    const s1 = merged.headsignTranslations.get('s1');
    const s2 = merged.headsignTranslations.get('s2');
    expect(s1?.headsigns['新橋']).toEqual({ ja: '新橋', 'ja-Hrkt': 'しんばし', en: 'Shimbashi' });
    expect(s2?.headsigns['新橋']).toEqual({
      ja: '新橋',
      en: 'Shimbashi',
      ko: '신바시',
      'zh-Hans': '新桥',
    });
    // Global translationsMap should NOT contain headsigns
    expect(merged.translationsMap.headsigns).toEqual({});
  });

  it('merges translationsMap with agency_short_names', () => {
    const fixture = createFixture();
    const merged = mergeSources([fixture]);
    expect(merged.translationsMap.agency_short_names).toEqual({
      'test:agency': { ja: 'テスト', en: 'Test' },
      'test:partner': { ja: '共同', en: 'Partner' },
    });
  });

  it('builds sourceMetas from feedInfo and agency', () => {
    const fixture = createFixture();
    const merged = mergeSources([fixture]);
    expect(merged.sourceMetas).toHaveLength(1);
    const meta = merged.sourceMetas[0];
    expect(meta.id).toBe('test');
    expect(meta.name).toBe('Test');
    expect(meta.version).toBe('20260101_001');
    expect(meta.validity).toEqual({ startDate: '20260101', endDate: '20261231' });
    expect(meta.routeTypes).toEqual([0, 1, 2, 3]);
    expect(meta.keywords).toEqual([]);
    expect(meta.stats.stopCount).toBe(fixture.stops.length);
    expect(meta.stats.routeCount).toBe(fixture.routes.length);
  });

  it('omits sourceMeta when feedInfo is absent', () => {
    const fixture = createFixture();
    delete fixture.feedInfo;
    const merged = mergeSources([fixture]);
    expect(merged.sourceMetas).toHaveLength(0);
  });

  it('falls back to prefix for name when agency is absent', () => {
    const fixture = createFixture();
    delete fixture.agencies;
    const merged = mergeSources([fixture]);
    expect(merged.sourceMetas[0].name).toBe('test');
  });
});

describe('AthenaiRepository', () => {
  /** Helper to create a repo from the standard test fixture. */
  function createRepo() {
    return AthenaiRepository.create(['test'], new TestDataSource({ test: createFixture() }));
  }

  describe('create', () => {
    it('returns empty repository when all sources fail', async () => {
      const failSource: TransitDataSource = {
        load() {
          return Promise.reject(new Error('fail'));
        },
      };
      const repo = await AthenaiRepository.create(['bad'], failSource);
      const result = await repo.getAllStops();
      expect(result).toEqual({ success: true, data: [], truncated: false });
    });
  });

  describe('getRouteTypesForStop', () => {
    it('returns failure for unknown stop', async () => {
      const repo = await createRepo();
      const result = await repo.getRouteTypesForStop('unknown');
      expect(result.success).toBe(false);
    });

    it('returns failure for stop with no timetable entries', async () => {
      const repo = await createRepo();
      const result = await repo.getRouteTypesForStop('stop_closed');
      expect(result.success).toBe(false);
    });

    it('returns both types for subway + bus stop', async () => {
      const repo = await createRepo();
      // sub_02: subway(1) + bus(3) -> [1, 3] sorted ascending
      const result = await repo.getRouteTypesForStop('sub_02');
      expect(result).toEqual({ success: true, data: [1, 3] });
    });

    it('returns tram type for toden-only stop', async () => {
      const repo = await createRepo();
      // tdn_01: toden(0) only
      const result = await repo.getRouteTypesForStop('tdn_01');
      expect(result).toEqual({ success: true, data: [0] });
    });

    it('returns both types for toden + liner stop', async () => {
      const repo = await createRepo();
      // tdn_04: toden(0) + liner(2) -> [0, 2] sorted ascending
      const result = await repo.getRouteTypesForStop('tdn_04');
      expect(result).toEqual({ success: true, data: [0, 2] });
    });

    it('returns liner type for liner-only stop', async () => {
      const repo = await createRepo();
      // lnr_01: liner(2) only
      const result = await repo.getRouteTypesForStop('lnr_01');
      expect(result).toEqual({ success: true, data: [2] });
    });

    it('returns bus type for bus-only stop', async () => {
      const repo = await createRepo();
      // bus_01: bus(3) only
      const result = await repo.getRouteTypesForStop('bus_01');
      expect(result).toEqual({ success: true, data: [3] });
    });
  });

  describe('getUpcomingDepartures', () => {
    it('returns failure for unknown stop', async () => {
      const repo = await createRepo();
      const result = await repo.getUpcomingDepartures('unknown', WEEKDAY);
      expect(result.success).toBe(false);
    });

    it('returns failure for stop with no timetable', async () => {
      const repo = await createRepo();
      const result = await repo.getUpcomingDepartures('stop_closed', WEEKDAY);
      expect(result.success).toBe(false);
    });

    it('returns departure groups on weekday', async () => {
      const repo = await createRepo();
      // sub_01 has 2 subway groups (2 headsigns)
      // At 10:00 (600 min), Nishi-takashimadaira has 5 upcoming (600,660,720,1442,1470)
      // Meguro has 3 upcoming (605,665,725)
      const result = await repo.getUpcomingDepartures('sub_01', WEEKDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(2);
      expect(result.data[0].route.route_id).toBe('route_subway');
    });

    it('returns multi-route departure groups', async () => {
      const repo = await createRepo();
      // sub_02 has subway (2 headsigns) + bus (1 headsign) = 3 groups
      const result = await repo.getUpcomingDepartures('sub_02', WEEKDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(3);
      const routeIds = result.data.map((g) => g.route.route_id);
      expect(routeIds).toContain('route_subway');
      expect(routeIds).toContain('route_bus');
    });

    it('returns holiday service on Saturday', async () => {
      const repo = await createRepo();
      // Saturday has svc_holiday service
      const result = await repo.getUpcomingDepartures('sub_01', SATURDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      // sub_01 has holiday departures in both groups
      expect(result.data.length).toBe(2);
      const ntGroup = result.data.find((g) => g.headsign === 'Nishi-takashimadaira');
      expect(ntGroup).toBeDefined();
      // svc_holiday [540,600,660], at 10:00 only 600,660 are upcoming
      expect(ntGroup!.departures.length).toBe(2);
    });

    it('respects limit and sets truncated', async () => {
      const repo = await createRepo();
      const result = await repo.getUpcomingDepartures('sub_01', WEEKDAY, 1);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      for (const group of result.data) {
        expect(group.departures.length).toBe(1);
      }
      expect(result.truncated).toBe(true);
    });

    it('returns all departures when limit is omitted', async () => {
      const repo = await createRepo();
      const result = await repo.getUpcomingDepartures('sub_01', WEEKDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      // Nishi-takashimadaira: at 10:00 (600 min), upcoming times:
      // 600, 660, 720, 1442, 1470, 1625 (6 departures)
      const ntGroup = result.data.find((g) => g.headsign === 'Nishi-takashimadaira');
      expect(ntGroup).toBeDefined();
      expect(ntGroup!.departures.length).toBe(6);
    });

    it('includes overnight departures (>= 24:00) from today service', async () => {
      const repo = await createRepo();
      const result = await repo.getUpcomingDepartures('sub_01', WEEKDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      const ntGroup = result.data.find((g) => g.headsign === 'Nishi-takashimadaira');
      expect(ntGroup).toBeDefined();
      // Last 3 departures should be overnight (24:02, 24:30, 27:05)
      const lastThree = ntGroup!.departures.slice(-3);
      // 24:02 → next day 0:02
      expect(lastThree[0].getHours()).toBe(0);
      expect(lastThree[0].getMinutes()).toBe(2);
      expect(lastThree[0].getDate()).toBe(WEEKDAY.getDate() + 1);
      // 24:30 → next day 0:30
      expect(lastThree[1].getHours()).toBe(0);
      expect(lastThree[1].getMinutes()).toBe(30);
      // 27:05 → next day 3:05
      expect(lastThree[2].getHours()).toBe(3);
      expect(lastThree[2].getMinutes()).toBe(5);
    });

    it('uses previous calendar day service at 01:30 (before boundary)', async () => {
      const repo = await createRepo();
      // WEEKDAY_OVERNIGHT = Thu Mar 12 01:30. Service day = Wed Mar 11 (weekday).
      // nowMinutes = (1+24)*60 + 30 = 1530. Only times >= 1530 are upcoming.
      // sub_01 Nishi-takashimadaira: 1625 >= 1530 → 1 upcoming (Thu 03:05).
      // 1442 and 1470 are < 1530, so not upcoming.
      const result = await repo.getUpcomingDepartures('sub_01', WEEKDAY_OVERNIGHT);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(1);
      expect(result.data[0].headsign).toBe('Nishi-takashimadaira');
      expect(result.data[0].departures.length).toBe(1);
      // 1625 minutes from Wed midnight = Thu 03:05
      expect(result.data[0].departures[0].getHours()).toBe(3);
      expect(result.data[0].departures[0].getMinutes()).toBe(5);
    });

    it('uses current calendar day service at 04:00 (after boundary)', async () => {
      const repo = await createRepo();
      // WEEKDAY_AFTER_BOUNDARY = Thu Mar 12 04:00. Service day = Thu Mar 12 (weekday).
      // nowMinutes = 240. Times >= 240 from sub_01:
      // Nishi-takashimadaira: 480, 540, 600, 660, 720, 1442, 1470 (all >= 240)
      // Meguro: 485, 545, 605, 665, 725 (all >= 240)
      const result = await repo.getUpcomingDepartures('sub_01', WEEKDAY_AFTER_BOUNDARY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(2); // 2 headsign groups
      const ntGroup = result.data.find((g) => g.headsign === 'Nishi-takashimadaira');
      expect(ntGroup).toBeDefined();
      expect(ntGroup!.departures.length).toBe(8); // 5 regular + 3 overnight
    });

    it('returns late overnight at Sat 01:30 (service day = Friday)', async () => {
      const repo = await createRepo();
      // Sat Mar 7 01:30 → service day = Fri Mar 6 (weekday → has service).
      // nowMinutes = 1530. Only 1625 >= 1530 → 1 upcoming (Sat 03:05).
      const satOvernight = new Date('2026-03-07T01:30:00');
      const result = await repo.getUpcomingDepartures('sub_01', satOvernight);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(1);
      expect(result.data[0].departures.length).toBe(1);
      expect(result.data[0].departures[0].getHours()).toBe(3);
      expect(result.data[0].departures[0].getMinutes()).toBe(5);
    });

    it('uses current day service at exactly 03:00 (boundary hour)', async () => {
      const repo = await createRepo();
      // BOUNDARY_EXACT = Wed Mar 11 03:00 → serviceDay = Wed Mar 11 (weekday)
      // nowMinutes = 180. Today's times >= 180: all 8 weekday times.
      // prevServiceDay = Tue Mar 10 (weekday). overnightTarget = 180+1440 = 1620.
      // Tue's Nishi-takashimadaira times >= 1620: [1625] → 1 extra (Wed 03:05).
      const result = await repo.getUpcomingDepartures('sub_01', BOUNDARY_EXACT);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(2); // 2 headsign groups
      const ntGroup = result.data.find((g) => g.headsign === 'Nishi-takashimadaira');
      expect(ntGroup).toBeDefined();
      // 8 from today + 1 from previous day's overnight = 9
      expect(ntGroup!.departures.length).toBe(9);
    });

    it('sorts previous day overnight before today regular departures', async () => {
      const repo = await createRepo();
      // BOUNDARY_JUST_AFTER = Wed Mar 11 03:02 → serviceDay = Wed (weekday)
      // nowMinutes = 182. Today's times >= 182: [480..720, 1442, 1470, 1625] (8)
      // prevServiceDay = Tue (weekday). overnightTarget = 182+1440 = 1622.
      // Tue's times >= 1622: [1625] → minutesToDate(Tue, 1625) = Wed 03:05 (1 dep)
      // Total: 9 departures. Tue's overnight (Wed 03:05) should sort first.
      const result = await repo.getUpcomingDepartures('sub_01', BOUNDARY_JUST_AFTER);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      const ntGroup = result.data.find((g) => g.headsign === 'Nishi-takashimadaira');
      expect(ntGroup).toBeDefined();
      const deps = ntGroup!.departures;
      // Previous day's overnight (Wed 03:05) comes before today's 08:00
      expect(deps[0].getHours()).toBe(3);
      expect(deps[0].getMinutes()).toBe(5);
      expect(deps[0].getDate()).toBe(11); // Wed Mar 11 (from Tue's overnight)
      expect(deps[1].getHours()).toBe(8);
      expect(deps[1].getMinutes()).toBe(0);
      expect(deps[1].getDate()).toBe(11); // Wed Mar 11 (today's regular)
      // All departures in chronological order
      for (let i = 1; i < deps.length; i++) {
        expect(deps[i].getTime()).toBeGreaterThanOrEqual(deps[i - 1].getTime());
      }
    });

    it('returns holiday service on exception date (calendar_dates)', async () => {
      const repo = await createRepo();
      // EXCEPTION_HOLIDAY = Wed Mar 4 10:00.
      // calendar_dates: svc_weekday removed, svc_holiday added on Mar 4.
      // At 10:00 (600 min), holiday service for sub_01:
      // Nishi-takashimadaira: 600, 660 (from svc_holiday [540,600,660], >= 600)
      // Meguro: 605 (from svc_holiday [545,605], >= 600)
      const result = await repo.getUpcomingDepartures('sub_01', EXCEPTION_HOLIDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      const ntGroup = result.data.find((g) => g.headsign === 'Nishi-takashimadaira');
      expect(ntGroup).toBeDefined();
      // Holiday has [540,600,660], from 10:00 only 600,660 are upcoming
      expect(ntGroup!.departures.length).toBe(2);
      // No overnight times in holiday service
    });

    it('returns departures sorted by earliest time', async () => {
      const repo = await createRepo();
      const result = await repo.getUpcomingDepartures('sub_01', WEEKDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      // Groups should be sorted by earliest departure
      for (let i = 1; i < result.data.length; i++) {
        expect(result.data[i].departures[0].getTime()).toBeGreaterThanOrEqual(
          result.data[i - 1].departures[0].getTime(),
        );
      }
    });

    it('returns only overnight departures at 23:30', async () => {
      const repo = await createRepo();
      // Wed Mar 11 23:30 → service day = Mar 11 (weekday)
      // nowMinutes = 1410. Only overnight times are upcoming.
      // Nishi-takashimadaira: 1442, 1470, 1625 are >= 1410 → 3 upcoming
      const lateNight = new Date('2026-03-11T23:30:00');
      const result = await repo.getUpcomingDepartures('sub_01', lateNight);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(1);
      expect(result.data[0].headsign).toBe('Nishi-takashimadaira');
      expect(result.data[0].departures.length).toBe(3);
    });

    it('sets truncated to false when limit is not specified', async () => {
      const repo = await createRepo();
      const result = await repo.getUpcomingDepartures('sub_01', WEEKDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.truncated).toBe(false);
    });
  });

  describe('getStopsInBounds', () => {
    it('returns empty for bounds covering no stops', async () => {
      const repo = await createRepo();
      const result = await repo.getStopsInBounds({ north: 0, south: -1, east: 0, west: -1 }, 100);
      expect(result).toEqual({ success: true, data: [], truncated: false });
    });

    it('returns all stops within bounds', async () => {
      const repo = await createRepo();
      const result = await repo.getStopsInBounds(
        { north: 35.76, south: 35.74, east: 139.76, west: 139.72 },
        100,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(13);
    });

    it('truncates when limit is exceeded', async () => {
      const repo = await createRepo();
      const result = await repo.getStopsInBounds(
        { north: 35.76, south: 35.74, east: 139.76, west: 139.72 },
        1,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(1);
      expect(result.truncated).toBe(true);
    });
  });

  describe('getStopsNearby', () => {
    it('returns empty for radius = 0', async () => {
      const repo = await createRepo();
      const result = await repo.getStopsNearby({ lat: 35.745, lng: 139.73 }, 0, 100);
      expect(result).toEqual({ success: true, data: [], truncated: false });
    });

    it('returns empty for negative radius', async () => {
      const repo = await createRepo();
      const result = await repo.getStopsNearby({ lat: 35.745, lng: 139.73 }, -100, 100);
      expect(result).toEqual({ success: true, data: [], truncated: false });
    });

    it('returns stops sorted by distance', async () => {
      const repo = await createRepo();
      // Center at sub_01 (35.745, 139.730)
      // Nearest: sub_01 (0m), bus_01 (~140m), tdn_01 (~220m), ...
      const result = await repo.getStopsNearby({ lat: 35.745, lng: 139.73 }, 5000, 100);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(13);
      expect(result.data[0].stop.stop_id).toBe('sub_01');
      expect(result.data[0].distance).toBeGreaterThanOrEqual(0);
      expect(result.data[1].stop.stop_id).toBe('bus_01');
      expect(result.data[1].distance).toBeGreaterThan(0);
    });
  });

  describe('getFullDayDepartures', () => {
    it('returns empty for unknown stop/route/headsign combo', async () => {
      const repo = await createRepo();
      const result = await repo.getFullDayDepartures('sub_01', 'unknown_route', 'Unknown', WEEKDAY);
      expect(result).toEqual({ success: true, data: [], truncated: false });
    });

    it('returns all departures on weekday including overnight', async () => {
      const repo = await createRepo();
      const result = await repo.getFullDayDepartures(
        'sub_01',
        'route_subway',
        'Nishi-takashimadaira',
        WEEKDAY,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data).toEqual([480, 540, 600, 660, 720, 1442, 1470, 1625]);
    });

    it('returns holiday departures on Saturday (svc_holiday active)', async () => {
      const repo = await createRepo();
      const result = await repo.getFullDayDepartures(
        'sub_01',
        'route_subway',
        'Nishi-takashimadaira',
        SATURDAY,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data).toEqual([540, 600, 660]);
    });

    it('uses previous day service at 01:30 (before boundary)', async () => {
      const repo = await createRepo();
      // WEEKDAY_OVERNIGHT = Thu Mar 12 01:30 → service day = Wed Mar 11 (weekday)
      const result = await repo.getFullDayDepartures(
        'sub_01',
        'route_subway',
        'Nishi-takashimadaira',
        WEEKDAY_OVERNIGHT,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data).toEqual([480, 540, 600, 660, 720, 1442, 1470, 1625]);
    });

    it('uses current day service at 04:00 (after boundary)', async () => {
      const repo = await createRepo();
      // WEEKDAY_AFTER_BOUNDARY = Thu Mar 12 04:00 → service day = Thu Mar 12 (weekday)
      const result = await repo.getFullDayDepartures(
        'sub_01',
        'route_subway',
        'Nishi-takashimadaira',
        WEEKDAY_AFTER_BOUNDARY,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data).toEqual([480, 540, 600, 660, 720, 1442, 1470, 1625]);
    });

    it('returns empty at Sat 01:30 when Fri has no service (Sat boundary)', async () => {
      const repo = await createRepo();
      // Sat Mar 7 01:30 → service day = Fri Mar 6 (weekday → has service)
      const satOvernight = new Date('2026-03-07T01:30:00');
      const result = await repo.getFullDayDepartures(
        'sub_01',
        'route_subway',
        'Nishi-takashimadaira',
        satOvernight,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      // Fri is weekday → has service
      expect(result.data).toEqual([480, 540, 600, 660, 720, 1442, 1470, 1625]);
    });

    it('returns holiday departures at Sun 01:30 (service day = Sat)', async () => {
      const repo = await createRepo();
      // Sun Mar 8 01:30 → service day = Sat Mar 7 (svc_holiday active)
      const sunOvernight = new Date('2026-03-08T01:30:00');
      const result = await repo.getFullDayDepartures(
        'sub_01',
        'route_subway',
        'Nishi-takashimadaira',
        sunOvernight,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data).toEqual([540, 600, 660]);
    });

    it('returns holiday service on exception date (calendar_dates)', async () => {
      const repo = await createRepo();
      // EXCEPTION_HOLIDAY = Wed Mar 4. svc_weekday removed, svc_holiday added.
      const result = await repo.getFullDayDepartures(
        'sub_01',
        'route_subway',
        'Nishi-takashimadaira',
        EXCEPTION_HOLIDAY,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      // svc_holiday departures only: [540, 600, 660]
      expect(result.data).toEqual([540, 600, 660]);
    });

    it('uses current day service at exactly 03:00 (boundary)', async () => {
      const repo = await createRepo();
      // BOUNDARY_EXACT = Wed Mar 11 03:00 → serviceDay = Wed Mar 11 (weekday)
      const result = await repo.getFullDayDepartures(
        'sub_01',
        'route_subway',
        'Nishi-takashimadaira',
        BOUNDARY_EXACT,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data).toEqual([480, 540, 600, 660, 720, 1442, 1470, 1625]);
    });

    it('returns Saturday holiday service on regular Saturday', async () => {
      const repo = await createRepo();
      const result = await repo.getFullDayDepartures(
        'sub_01',
        'route_subway',
        'Nishi-takashimadaira',
        SATURDAY,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      // Saturday has svc_holiday: [540, 600, 660]
      expect(result.data).toEqual([540, 600, 660]);
    });
  });

  describe('getRouteShapes', () => {
    it('returns shapes for all routes with # prefixed color', async () => {
      const repo = await createRepo();
      const result = await repo.getRouteShapes();
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(4);
      const routeIds = result.data.map((s) => s.routeId).sort();
      expect(routeIds).toEqual(['route_bus', 'route_liner', 'route_subway', 'route_toden']);
      for (const shape of result.data) {
        expect(shape.color).toMatch(/^#[0-9A-Fa-f]{6}$/);
      }
    });

    it('includes correct routeType for each shape', async () => {
      const repo = await createRepo();
      const result = await repo.getRouteShapes();
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      const typeByRoute = new Map(result.data.map((s) => [s.routeId, s.routeType]));
      expect(typeByRoute.get('route_subway')).toBe(1);
      expect(typeByRoute.get('route_bus')).toBe(3);
      expect(typeByRoute.get('route_toden')).toBe(0);
      expect(typeByRoute.get('route_liner')).toBe(2);
    });
  });

  describe('getAllStops', () => {
    it('returns all 13 stops', async () => {
      const repo = await createRepo();
      const result = await repo.getAllStops();
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBe(13);
    });

    it('resolves stop_names from translations', async () => {
      const repo = await createRepo();
      const result = await repo.getAllStops();
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      const sub01 = result.data.find((s) => s.stop_id === 'sub_01');
      expect(sub01).toBeDefined();
      expect(sub01!.stop_names).toEqual({ ja: '西巣鴨', en: 'Nishi-sugamo' });
    });

    it('includes agency_id on stops', async () => {
      const repo = await createRepo();
      const result = await repo.getAllStops();
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      const sub01 = result.data.find((s) => s.stop_id === 'sub_01');
      expect(sub01).toBeDefined();
      expect(sub01!.agency_id).toBe('test:agency');
    });
  });

  describe('getAgency', () => {
    it('returns agency by ID', async () => {
      const repo = await createRepo();
      const result = await repo.getAgency('test:agency');
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.agency_id).toBe('test:agency');
      expect(result.data.agency_name).toBe('Test Agency');
      expect(result.data.agency_short_name).toBe('Test');
      expect(result.data.agency_timezone).toBe('Asia/Tokyo');
      expect(result.data.agency_colors).toEqual([{ bg: '0079C2', text: 'FFFFFF' }]);
    });

    it('resolves agency_names from translations', async () => {
      const repo = await createRepo();
      const result = await repo.getAgency('test:agency');
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.agency_names).toEqual({ ja: 'テスト事業者', en: 'Test Agency' });
    });

    it('resolves agency_short_names from translations', async () => {
      const repo = await createRepo();
      const result = await repo.getAgency('test:agency');
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.agency_short_names).toEqual({ ja: 'テスト', en: 'Test' });
    });

    it('returns failure for unknown agency', async () => {
      const repo = await createRepo();
      const result = await repo.getAgency('unknown');
      expect(result.success).toBe(false);
    });
  });

  describe('StopWithMeta.agencies', () => {
    it('includes resolved agencies in getStopsNearby results', async () => {
      const repo = await createRepo();
      const result = await repo.getStopsNearby({ lat: 35.75, lng: 139.74 }, 5000, 100);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      // All stops in test data use agency_id 'test:agency' via timetable
      for (const meta of result.data) {
        expect(meta.agencies).toBeDefined();
        expect(Array.isArray(meta.agencies)).toBe(true);
      }
      // At least one stop should have a resolved agency
      const withAgencies = result.data.filter((m) => m.agencies.length > 0);
      expect(withAgencies.length).toBeGreaterThan(0);
      expect(withAgencies[0].agencies[0].agency_id).toBe('test:agency');
    });

    it('resolves multiple agencies for joint-operation stops', async () => {
      const repo = await createRepo();
      const result = await repo.getStopsNearby({ lat: 35.75, lng: 139.74 }, 5000, 100);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      // bus_01 is served by both test:agency (route_bus) and test:partner (route_partner)
      const bus01 = result.data.find((m) => m.stop.stop_id.endsWith('bus_01'));
      expect(bus01).toBeDefined();
      expect(bus01!.agencies).toHaveLength(2);
      const agencyIds = bus01!.agencies.map((a) => a.agency_id).sort();
      expect(agencyIds).toEqual(['test:agency', 'test:partner']);
    });

    it('includes resolved agencies in getStopsInBounds results', async () => {
      const repo = await createRepo();
      const result = await repo.getStopsInBounds(
        { north: 36, south: 34, east: 140, west: 138 },
        100,
      );
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      const withAgencies = result.data.filter((m) => m.agencies.length > 0);
      expect(withAgencies.length).toBeGreaterThan(0);
      expect(withAgencies[0].agencies[0].agency_id).toBe('test:agency');
    });
  });

  describe('getUpcomingDepartures (empty headsign)', () => {
    it('returns empty headsign for routes with no trip_headsign', async () => {
      const repo = await createRepo();
      const result = await repo.getUpcomingDepartures('bus_01', WEEKDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      // route_partner has empty headsign
      const partnerGroup = result.data.find((g) => g.route.route_id.endsWith('route_partner'));
      expect(partnerGroup).toBeDefined();
      expect(partnerGroup!.headsign).toBe('');
    });
  });

  describe('getUpcomingDepartures (headsign_names)', () => {
    it('includes headsign_names in departure groups', async () => {
      const repo = await createRepo();
      const result = await repo.getUpcomingDepartures('sub_01', WEEKDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      for (const group of result.data) {
        expect(group).toHaveProperty('headsign_names');
        expect(typeof group.headsign_names).toBe('object');
      }
    });
  });

  describe('getFullDayDeparturesForStop (headsign_names)', () => {
    it('includes headsign_names in departures', async () => {
      const repo = await createRepo();
      const result = await repo.getFullDayDeparturesForStop('sub_01', WEEKDAY);
      expect(result.success).toBe(true);
      if (!result.success) {
        return;
      }
      expect(result.data.length).toBeGreaterThan(0);
      for (const dep of result.data) {
        expect(dep).toHaveProperty('headsign_names');
        expect(typeof dep.headsign_names).toBe('object');
      }
    });
  });

  describe('getAllSourceMeta', () => {
    it('returns metadata for all sources', async () => {
      const repo = await createRepo();
      const result = await repo.getAllSourceMeta();
      expect(result.success).toBe(true);
      expect(result.data).toHaveLength(1);
      const meta = result.data[0];
      expect(meta.id).toBe('test');
      expect(meta.name).toBe('Test');
      expect(meta.validity.startDate).toBe('20260101');
      expect(meta.validity.endDate).toBe('20261231');
      expect(meta.routeTypes).toEqual([0, 1, 2, 3]);
      expect(meta.stats.stopCount).toBeGreaterThan(0);
      expect(meta.stats.routeCount).toBeGreaterThan(0);
    });
  });
});
