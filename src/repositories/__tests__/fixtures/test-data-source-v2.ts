/**
 * @module testDataSourceV2
 *
 * Test fixture for AthenaiRepositoryV2 unit tests.
 *
 * Provides v2 DataBundle equivalents of the v1 test-data-source fixtures,
 * covering the same stops, routes, and timetable data but using v2's
 * TripPattern FK structure.
 *
 * Key v2-specific test scenarios:
 * - TripPattern FK resolution (tp -> route + headsign)
 * - Re-aggregation of multiple patterns with same route+headsign
 * - location_type=1 stops in fixture data (filtered out by mergeSourcesV2)
 * - Stop.agency_id is empty (v2 GTFS compliance)
 */

import type {
  TransitDataSourceV2,
  SourceDataV2,
} from '../../../datasources/transit-data-source-v2';
import type {
  DataBundle,
  ShapesBundle,
  InsightsBundle,
  GlobalInsightsBundle,
  TimetableGroupV2Json,
} from '../../../types/data/transit-v2-json';

/**
 * In-memory v2 data source for testing.
 *
 * Resolves prefixes from a pre-built record. Throws for unknown prefixes.
 * Shapes and insights return per-prefix fixtures when provided, null otherwise.
 */
export class TestDataSourceV2 implements TransitDataSourceV2 {
  private fixtures: Record<string, SourceDataV2>;
  private shapesFixtures: Record<string, ShapesBundle>;
  private insightsFixtures: Record<string, InsightsBundle>;

  constructor(
    fixtures: Record<string, SourceDataV2>,
    shapesFixtures: Record<string, ShapesBundle> = {},
    insightsFixtures: Record<string, InsightsBundle> = {},
  ) {
    this.fixtures = fixtures;
    this.shapesFixtures = shapesFixtures;
    this.insightsFixtures = insightsFixtures;
  }

  loadData(prefix: string): Promise<SourceDataV2> {
    const data = this.fixtures[prefix];
    if (!data) {
      return Promise.reject(new Error(`Unknown prefix: ${prefix}`));
    }
    return Promise.resolve(data);
  }

  loadShapes(prefix: string): Promise<ShapesBundle | null> {
    return Promise.resolve(this.shapesFixtures[prefix] ?? null);
  }

  loadInsights(prefix: string): Promise<InsightsBundle | null> {
    return Promise.resolve(this.insightsFixtures[prefix] ?? null);
  }

  loadGlobalInsights(): Promise<GlobalInsightsBundle | null> {
    return Promise.resolve(null);
  }
}

/**
 * Generate 5 departure minutes at 60-minute intervals starting from `base`.
 *
 * @example deps(480) => [480, 540, 600, 660, 720] // 8:00, 9:00, 10:00, 11:00, 12:00
 */
function deps(base: number): number[] {
  return [base, base + 60, base + 120, base + 180, base + 240];
}

/**
 * Helper to create a v2 timetable group.
 * Arrival times default to equal departure times.
 */
function ttGroup(tp: string, departures: Record<string, number[]>): TimetableGroupV2Json {
  const a: Record<string, number[]> = {};
  for (const [svcId, times] of Object.entries(departures)) {
    a[svcId] = [...times];
  }
  return { v: 2, tp, d: departures, a };
}

/**
 * Creates a v2 fixture SourceDataV2 equivalent to v1's createFixture().
 *
 * Same stops, routes, and departures, but using v2 bundle structure
 * with TripPattern FK references.
 *
 * Trip patterns:
 * | ID       | Route          | Headsign                 |
 * |----------|----------------|--------------------------|
 * | tp_sub_n | route_subway   | Nishi-takashimadaira     |
 * | tp_sub_m | route_subway   | Meguro                   |
 * | tp_tdn_w | route_toden    | Waseda                   |
 * | tp_tdn_m | route_toden    | Minowabashi              |
 * | tp_lnr_s | route_liner    | Minumadai-shinsuikoen    |
 * | tp_lnr_n | route_liner    | Nippori                  |
 * | tp_bus_i | route_bus      | Ikebukuro-eki            |
 * | tp_bus_o | route_bus      | Oji-eki                  |
 * | tp_ptr_e | route_partner  | (empty headsign)         |
 *
 * Multi-pattern test: tp_bus_i2 has the same route+headsign as tp_bus_i
 * but a different stop sequence. This tests cross-pattern entry merging.
 */
export function createFixtureV2(): SourceDataV2 {
  const data: DataBundle = {
    bundle_version: 2,
    kind: 'data',

    stops: {
      v: 2,
      data: [
        // Subway stations
        { v: 2, i: 'sub_01', n: 'Nishi-sugamo', a: 35.745, o: 139.73, l: 1 },
        { v: 2, i: 'sub_02', n: 'Sugamo-shinden', a: 35.748, o: 139.733, l: 1 },
        { v: 2, i: 'sub_03', n: 'Itabashi-honcho', a: 35.752, o: 139.728, l: 1 },
        // Toden / tram stops
        { v: 2, i: 'tdn_01', n: 'Shin-koshinzuka', a: 35.744, o: 139.732, l: 0 },
        { v: 2, i: 'tdn_02', n: 'Nishigahara-4chome', a: 35.747, o: 139.738, l: 0 },
        { v: 2, i: 'tdn_03', n: 'Oji-ekimae', a: 35.75, o: 139.745, l: 0 },
        { v: 2, i: 'tdn_04', n: 'Kumano-mae', a: 35.748, o: 139.75, l: 0 },
        // Liner stations
        { v: 2, i: 'lnr_01', n: 'Adachi-odai', a: 35.753, o: 139.748, l: 1 },
        { v: 2, i: 'lnr_02', n: 'Ogi-ohashi', a: 35.757, o: 139.752, l: 1 },
        // Bus stops
        {
          v: 2,
          i: 'bus_01',
          n: 'Nishi-sugamo-eki',
          a: 35.746,
          o: 139.731,
          l: 0,
          wb: 1,
          ps: 'sta_parent',
          pc: '1',
        },
        { v: 2, i: 'bus_02', n: 'Takinogawa-7chome', a: 35.749, o: 139.736, l: 0 },
        { v: 2, i: 'bus_03', n: 'Oji-5chome', a: 35.753, o: 139.741, l: 0, wb: 2 },
        // No-timetable stop
        { v: 2, i: 'stop_closed', n: 'Closed Stop', a: 35.751, o: 139.735, l: 0 },
        // Station parent (location_type=1, v2-specific)
        { v: 2, i: 'sta_parent', n: 'Test Station', a: 35.746, o: 139.731, l: 1, wb: 1 },
      ],
    },

    routes: {
      v: 2,
      data: [
        {
          v: 2,
          i: 'route_toden',
          s: 'SA',
          l: 'Toden Arakawa',
          t: 0,
          c: 'E60012',
          tc: 'FFFFFF',
          ai: 'test:agency',
        },
        {
          v: 2,
          i: 'route_subway',
          s: 'I',
          l: 'Toei Mita Line',
          t: 1,
          c: '0079C2',
          tc: 'FFFFFF',
          ai: 'test:agency',
        },
        {
          v: 2,
          i: 'route_liner',
          s: 'NT',
          l: 'Nippori-Toneri',
          t: 2,
          c: 'FF6319',
          tc: 'FFFFFF',
          ai: 'test:agency',
        },
        {
          v: 2,
          i: 'route_bus',
          s: '王40',
          l: 'Toei Bus Ou-40',
          t: 3,
          c: '2E7D32',
          tc: 'FFFFFF',
          ai: 'test:agency',
        },
        {
          v: 2,
          i: 'route_partner',
          s: '共01',
          l: '',
          t: 3,
          c: 'D32F2F',
          tc: 'FFFFFF',
          ai: 'test:partner',
        },
      ],
    },

    agency: {
      v: 1,
      data: [
        {
          i: 'test:agency',
          n: 'Test Agency',
          sn: 'Test',
          u: 'https://example.com',
          l: 'ja',
          tz: 'Asia/Tokyo',
          fu: '',
          cs: [{ b: '0079C2', t: 'FFFFFF' }],
        },
        {
          i: 'test:partner',
          n: 'Partner Bus Co.',
          sn: 'Partner',
          u: 'https://partner.example.com',
          l: 'ja',
          tz: 'Asia/Tokyo',
          fu: '',
          cs: [{ b: 'D32F2F', t: 'FFFFFF' }],
        },
      ],
    },

    calendar: {
      v: 1,
      data: {
        services: [
          { i: 'svc_weekday', d: [1, 1, 1, 1, 1, 0, 0], s: '20260101', e: '20261231' },
          { i: 'svc_holiday', d: [0, 0, 0, 0, 0, 1, 1], s: '20260101', e: '20261231' },
        ],
        exceptions: [
          { i: 'svc_holiday', d: '20260304', t: 1 },
          { i: 'svc_weekday', d: '20260304', t: 2 },
        ],
      },
    },

    feedInfo: {
      v: 1,
      data: {
        pn: 'Test Agency',
        pu: 'https://example.com',
        l: 'ja',
        s: '20260101',
        e: '20261231',
        v: '20260101_001',
      },
    },

    tripPatterns: {
      v: 2,
      data: {
        tp_sub_n: {
          v: 2,
          r: 'route_subway',
          h: 'Nishi-takashimadaira',
          stops: ['sub_01', 'sub_02', 'sub_03'],
        },
        tp_sub_m: { v: 2, r: 'route_subway', h: 'Meguro', stops: ['sub_03', 'sub_02', 'sub_01'] },
        tp_tdn_w: {
          v: 2,
          r: 'route_toden',
          h: 'Waseda',
          stops: ['tdn_01', 'tdn_02', 'tdn_03', 'tdn_04'],
        },
        tp_tdn_m: {
          v: 2,
          r: 'route_toden',
          h: 'Minowabashi',
          stops: ['tdn_04', 'tdn_03', 'tdn_02', 'tdn_01'],
        },
        tp_lnr_s: {
          v: 2,
          r: 'route_liner',
          h: 'Minumadai-shinsuikoen',
          stops: ['tdn_04', 'lnr_01', 'lnr_02'],
        },
        tp_lnr_n: { v: 2, r: 'route_liner', h: 'Nippori', stops: ['lnr_02', 'lnr_01', 'tdn_04'] },
        tp_bus_i: {
          v: 2,
          r: 'route_bus',
          h: 'Ikebukuro-eki',
          stops: ['bus_03', 'bus_02', 'bus_01', 'sub_02'],
        },
        tp_bus_o: { v: 2, r: 'route_bus', h: 'Oji-eki', stops: ['bus_01', 'bus_02', 'bus_03'] },
        tp_ptr_e: { v: 2, r: 'route_partner', h: '', stops: ['bus_01'] },
        // Re-aggregation test: same route+headsign, different pattern
        tp_bus_i2: { v: 2, r: 'route_bus', h: 'Ikebukuro-eki', stops: ['bus_03', 'bus_01'] },
      },
    },

    timetable: {
      v: 2,
      data: {
        // Subway stations
        sub_01: [
          ttGroup('tp_sub_n', {
            svc_weekday: [...deps(480), 1442, 1470, 1625],
            svc_holiday: [540, 600, 660],
          }),
          ttGroup('tp_sub_m', { svc_weekday: deps(485), svc_holiday: [545, 605] }),
        ],
        sub_02: [
          ttGroup('tp_sub_n', { svc_weekday: deps(483) }),
          ttGroup('tp_sub_m', { svc_weekday: deps(488) }),
          ttGroup('tp_bus_i', { svc_weekday: deps(495) }),
        ],
        sub_03: [
          ttGroup('tp_sub_n', { svc_weekday: deps(486) }),
          ttGroup('tp_sub_m', { svc_weekday: deps(491) }),
        ],
        // Toden stops
        tdn_01: [
          ttGroup('tp_tdn_w', { svc_weekday: deps(490) }),
          ttGroup('tp_tdn_m', { svc_weekday: deps(500) }),
        ],
        tdn_02: [
          ttGroup('tp_tdn_w', { svc_weekday: deps(493) }),
          ttGroup('tp_tdn_m', { svc_weekday: deps(503) }),
        ],
        tdn_03: [
          ttGroup('tp_tdn_w', { svc_weekday: deps(496) }),
          ttGroup('tp_tdn_m', { svc_weekday: deps(506) }),
        ],
        tdn_04: [
          ttGroup('tp_tdn_w', { svc_weekday: deps(499) }),
          ttGroup('tp_tdn_m', { svc_weekday: deps(509) }),
          ttGroup('tp_lnr_s', { svc_weekday: deps(510) }),
          ttGroup('tp_lnr_n', { svc_weekday: deps(515) }),
        ],
        // Liner stations
        lnr_01: [
          ttGroup('tp_lnr_s', { svc_weekday: deps(513) }),
          ttGroup('tp_lnr_n', { svc_weekday: deps(518) }),
        ],
        lnr_02: [
          ttGroup('tp_lnr_s', { svc_weekday: deps(516) }),
          ttGroup('tp_lnr_n', { svc_weekday: deps(521) }),
        ],
        // Bus stops
        bus_01: [
          ttGroup('tp_bus_i', { svc_weekday: deps(492) }),
          ttGroup('tp_bus_o', { svc_weekday: deps(502) }),
          ttGroup('tp_ptr_e', { svc_weekday: deps(497) }),
          // Re-aggregation: same route+headsign as tp_bus_i, different pattern
          ttGroup('tp_bus_i2', { svc_weekday: [494, 554] }),
        ],
        bus_02: [
          ttGroup('tp_bus_i', { svc_weekday: deps(498) }),
          ttGroup('tp_bus_o', { svc_weekday: deps(508) }),
        ],
        bus_03: [
          ttGroup('tp_bus_i', { svc_weekday: deps(504) }),
          ttGroup('tp_bus_o', { svc_weekday: deps(514) }),
        ],
        // stop_closed: intentionally no timetable
      },
    },

    translations: {
      v: 1,
      data: {
        headsigns: {},
        stop_headsigns: {},
        stop_names: {
          sub_01: { ja: '西巣鴨', en: 'Nishi-sugamo' },
          sub_02: { ja: '巣鴨新田', en: 'Sugamo-shinden' },
          sub_03: { ja: '板橋本町', en: 'Itabashi-honcho' },
          tdn_01: { ja: '新庚申塚', en: 'Shin-koshinzuka' },
          tdn_02: { ja: '西ケ原四丁目', en: 'Nishigahara-4chome' },
          tdn_03: { ja: '王子駅前', en: 'Oji-ekimae' },
          tdn_04: { ja: '熊野前', en: 'Kumano-mae' },
          lnr_01: { ja: '足立小台', en: 'Adachi-odai' },
          lnr_02: { ja: '扇大橋', en: 'Ogi-ohashi' },
          bus_01: { ja: '西巣鴨駅前', en: 'Nishi-sugamo Sta.' },
          bus_02: { ja: '滝野川七丁目', en: 'Takinogawa-7chome' },
          bus_03: { ja: '王子五丁目', en: 'Oji-5chome' },
          stop_closed: { ja: '休止停留所', en: 'Closed Stop' },
          sta_parent: { ja: 'テスト駅', en: 'Test Station' },
        },
        route_names: {},
        agency_names: {
          'test:agency': { ja: 'テスト事業者', en: 'Test Agency' },
          'test:partner': { ja: '共同バス', en: 'Partner Bus' },
        },
        agency_short_names: {
          'test:agency': { ja: 'テスト', en: 'Test' },
          'test:partner': { ja: '共同', en: 'Partner' },
        },
      },
    },

    lookup: { v: 2, data: {} },
  };

  return { prefix: 'test', data };
}

/**
 * Creates a shapes bundle for the test fixture.
 */
export function createShapesFixtureV2(): ShapesBundle {
  return {
    bundle_version: 2,
    kind: 'shapes',
    shapes: {
      v: 2,
      data: {
        route_subway: [
          [
            [35.745, 139.73],
            [35.748, 139.733],
            [35.752, 139.728],
          ],
        ],
        route_toden: [
          [
            [35.744, 139.732],
            [35.747, 139.738],
            [35.75, 139.745],
            [35.748, 139.75],
          ],
        ],
        route_liner: [
          [
            [35.748, 139.75],
            [35.753, 139.748],
            [35.757, 139.752],
          ],
        ],
        route_bus: [
          [
            [35.746, 139.731],
            [35.748, 139.733],
            [35.749, 139.736],
            [35.753, 139.741],
          ],
        ],
      },
    },
  };
}

/** A Wednesday in 2026 at 10:00 (no calendar exceptions on this date). */
export const WEEKDAY = new Date('2026-03-11T10:00:00');
/** A Saturday in 2026 at 10:00. */
export const SATURDAY = new Date('2026-03-07T10:00:00');
/** Thursday 01:30 — before service day boundary, service day = Wednesday (Mar 11). */
export const WEEKDAY_OVERNIGHT = new Date('2026-03-12T01:30:00');
/**
 * Thursday 03:03 — just after service day boundary, service day = Thursday (Mar 12).
 * Wednesday's overnight entry at 1625 (27:05 = Thu 03:05) is still upcoming (2 min away).
 */
export const AFTER_BOUNDARY = new Date('2026-03-12T03:03:00');
/**
 * Thursday 03:06 — after service day boundary, service day = Thursday (Mar 12).
 * Wednesday's overnight entry at 1625 (27:05 = Thu 03:05) has already passed.
 */
export const AFTER_BOUNDARY_PAST = new Date('2026-03-12T03:06:00');
/**
 * Wednesday Mar 4 at 10:00 — has calendar_dates exceptions:
 * svc_weekday removed, svc_holiday added.
 */
export const EXCEPTION_HOLIDAY = new Date('2026-03-04T10:00:00');

/**
 * Creates an InsightsBundle fixture for testing service group resolution.
 *
 * Service groups match the calendar fixture:
 * - "wd" group: svc_weekday (Mon-Fri)
 * - "ho" group: svc_holiday (Sat-Sun)
 *
 * stopStats: different freq values per group for tdn_01 and bus_01.
 * tripPatternStats: different freq values per group for tp_bus_i and tp_tdn_w.
 */
export function createInsightsFixtureV2(): InsightsBundle {
  return {
    bundle_version: 2,
    kind: 'insights',
    serviceGroups: {
      v: 1,
      data: [
        { key: 'wd', serviceIds: ['svc_weekday'] },
        { key: 'ho', serviceIds: ['svc_holiday'] },
      ],
    },
    stopStats: {
      v: 1,
      data: {
        wd: {
          tdn_01: { freq: 100, rc: 2, rtc: 1, ed: 490, ld: 730 },
          bus_01: { freq: 200, rc: 3, rtc: 1, ed: 492, ld: 740 },
        },
        ho: {
          // tdn_01 intentionally omitted from "ho" group to test
          // resolveStopStats returning undefined when the matched group
          // has no stats for a stop that exists in other groups.
          bus_01: { freq: 80, rc: 2, rtc: 1, ed: 540, ld: 700 },
        },
      },
    },
    tripPatternStats: {
      v: 1,
      data: {
        wd: {
          tp_bus_i: { freq: 50, rd: [30, 20, 10, 0] },
          tp_bus_o: { freq: 30, rd: [20, 10, 0] },
          tp_tdn_w: { freq: 30, rd: [20, 15, 10, 0] },
        },
        ho: {
          tp_bus_i: { freq: 15, rd: [30, 20, 10, 0] },
          tp_bus_o: { freq: 10, rd: [20, 10, 0] },
          // tp_tdn_w intentionally omitted from "ho" group to test
          // resolveRouteFreq returning undefined when the matched group
          // has no freq for a route that exists in other groups.
        },
      },
    },
  };
}
