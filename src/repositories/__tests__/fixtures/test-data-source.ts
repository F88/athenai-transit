/**
 * @module testDataSource
 *
 * Test fixture data source and factory for GtfsRepository unit tests.
 *
 * Provides:
 * - {@link TestDataSource}: A simple DataSource backed by a Record of prefix -> SourceData.
 * - {@link createFixture}: Factory for a SourceData modeled after Toei transit services,
 *   covering all 4 GTFS route types with multiple stops per route.
 */

import type { TransitDataSource, SourceData } from '../../../datasources/transit-data-source';

/**
 * In-memory data source for testing.
 *
 * Resolves prefixes from a pre-built record. Throws for unknown prefixes.
 */
export class TestDataSource implements TransitDataSource {
  private fixtures: Record<string, SourceData>;

  constructor(fixtures: Record<string, SourceData>) {
    this.fixtures = fixtures;
  }

  load(prefix: string): Promise<SourceData> {
    const data = this.fixtures[prefix];
    if (!data) {
      return Promise.reject(new Error(`Unknown prefix: ${prefix}`));
    }
    return Promise.resolve(data);
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
 * Creates a fixture SourceData modeled after Toei transit services.
 *
 * Covers all 4 GTFS route types with multiple stops per route:
 *
 * | Route            | Type | Stops                           |
 * |------------------|------|---------------------------------|
 * | route_toden      | 0    | tdn_01, tdn_02, tdn_03, tdn_04 |
 * | route_subway     | 1    | sub_01, sub_02, sub_03          |
 * | route_liner      | 2    | tdn_04, lnr_01, lnr_02         |
 * | route_bus        | 3    | sub_02, bus_01, bus_02, bus_03   |
 *
 * Multi-route stops (for getRouteTypesForStop):
 * - sub_02: subway(1) + bus(3) → returns [1, 3]
 * - tdn_04: toden(0) + liner(2) → returns [0, 2]
 *
 * Special stops:
 * - stop_closed: exists in stops but has no timetable entries (for error tests)
 *
 * Calendar: svc_weekday (Mon-Fri, 2026-01-01 to 2026-12-31).
 * Coordinates are fictional, clustered within ~2 km for nearby/bounds tests.
 *
 * @returns A fresh SourceData object (13 stops, 4 routes).
 */
export function createFixture(): SourceData {
  return {
    prefix: 'test',
    stops: [
      // --- Subway stations (3) ---
      { i: 'sub_01', n: 'Nishi-sugamo', a: 35.745, o: 139.73, l: 1, ai: 'test:agency' },
      { i: 'sub_02', n: 'Sugamo-shinden', a: 35.748, o: 139.733, l: 1, ai: 'test:agency' },
      { i: 'sub_03', n: 'Itabashi-honcho', a: 35.752, o: 139.728, l: 1, ai: 'test:agency' },
      // --- Toden / tram stops (4) ---
      { i: 'tdn_01', n: 'Shin-koshinzuka', a: 35.744, o: 139.732, l: 0, ai: 'test:agency' },
      { i: 'tdn_02', n: 'Nishigahara-4chome', a: 35.747, o: 139.738, l: 0, ai: 'test:agency' },
      { i: 'tdn_03', n: 'Oji-ekimae', a: 35.75, o: 139.745, l: 0, ai: 'test:agency' },
      { i: 'tdn_04', n: 'Kumano-mae', a: 35.748, o: 139.75, l: 0, ai: 'test:agency' },
      // --- Liner stations (2) ---
      { i: 'lnr_01', n: 'Adachi-odai', a: 35.753, o: 139.748, l: 1, ai: 'test:agency' },
      { i: 'lnr_02', n: 'Ogi-ohashi', a: 35.757, o: 139.752, l: 1, ai: 'test:agency' },
      // --- Bus stops (3) ---
      { i: 'bus_01', n: 'Nishi-sugamo-eki', a: 35.746, o: 139.731, l: 0, ai: 'test:agency' },
      { i: 'bus_02', n: 'Takinogawa-7chome', a: 35.749, o: 139.736, l: 0, ai: 'test:agency' },
      { i: 'bus_03', n: 'Oji-5chome', a: 35.753, o: 139.741, l: 0, ai: 'test:agency' },
      // --- No-timetable stop (for error tests) ---
      { i: 'stop_closed', n: 'Closed Stop', a: 35.751, o: 139.735, l: 0, ai: 'test:agency' },
    ],
    routes: [
      // Toden Arakawa Line (tram, route_type 0)
      {
        i: 'route_toden',
        s: 'SA',
        l: 'Toden Arakawa',
        t: 0,
        c: 'E60012',
        tc: 'FFFFFF',
        ai: 'test:agency',
      },
      // Toei Mita Line (subway, route_type 1)
      {
        i: 'route_subway',
        s: 'I',
        l: 'Toei Mita Line',
        t: 1,
        c: '0079C2',
        tc: 'FFFFFF',
        ai: 'test:agency',
      },
      // Nippori-Toneri Liner (rail, route_type 2)
      {
        i: 'route_liner',
        s: 'NT',
        l: 'Nippori-Toneri',
        t: 2,
        c: 'FF6319',
        tc: 'FFFFFF',
        ai: 'test:agency',
      },
      // Toei Bus (bus, route_type 3)
      {
        i: 'route_bus',
        s: '王40',
        l: 'Toei Bus Ou-40',
        t: 3,
        c: '2E7D32',
        tc: 'FFFFFF',
        ai: 'test:agency',
      },
    ],
    calendar: {
      services: [
        {
          i: 'svc_weekday',
          d: [1, 1, 1, 1, 1, 0, 0], // Mon-Fri
          s: '20260101',
          e: '20261231',
        },
        {
          i: 'svc_holiday',
          d: [0, 0, 0, 0, 0, 1, 1], // Sat-Sun
          s: '20260101',
          e: '20261231',
        },
      ],
      exceptions: [
        // Wed Mar 4 treated as holiday (exception_type=1: add holiday service)
        { i: 'svc_holiday', d: '20260304', t: 1 },
        // Wed Mar 4 weekday service removed (exception_type=2)
        { i: 'svc_weekday', d: '20260304', t: 2 },
      ],
    },
    timetable: {
      // --- Subway stations ---
      sub_01: [
        {
          r: 'route_subway',
          h: 'Nishi-takashimadaira',
          // 8:00-12:00 regular + 24:02, 24:30, 27:05 overnight (weekday)
          // 9:00-11:00 holiday (reduced service)
          d: { svc_weekday: [...deps(480), 1442, 1470, 1625], svc_holiday: [540, 600, 660] },
          ai: 'test:agency',
        },
        {
          r: 'route_subway',
          h: 'Meguro',
          d: { svc_weekday: deps(485), svc_holiday: [545, 605] },
          ai: 'test:agency',
        },
      ],
      sub_02: [
        {
          r: 'route_subway',
          h: 'Nishi-takashimadaira',
          d: { svc_weekday: deps(483) },
          ai: 'test:agency',
        },
        { r: 'route_subway', h: 'Meguro', d: { svc_weekday: deps(488) }, ai: 'test:agency' },
        { r: 'route_bus', h: 'Ikebukuro-eki', d: { svc_weekday: deps(495) }, ai: 'test:agency' },
      ],
      sub_03: [
        {
          r: 'route_subway',
          h: 'Nishi-takashimadaira',
          d: { svc_weekday: deps(486) },
          ai: 'test:agency',
        },
        { r: 'route_subway', h: 'Meguro', d: { svc_weekday: deps(491) }, ai: 'test:agency' },
      ],
      // --- Toden stops ---
      tdn_01: [
        { r: 'route_toden', h: 'Waseda', d: { svc_weekday: deps(490) }, ai: 'test:agency' },
        { r: 'route_toden', h: 'Minowabashi', d: { svc_weekday: deps(500) }, ai: 'test:agency' },
      ],
      tdn_02: [
        { r: 'route_toden', h: 'Waseda', d: { svc_weekday: deps(493) }, ai: 'test:agency' },
        { r: 'route_toden', h: 'Minowabashi', d: { svc_weekday: deps(503) }, ai: 'test:agency' },
      ],
      tdn_03: [
        { r: 'route_toden', h: 'Waseda', d: { svc_weekday: deps(496) }, ai: 'test:agency' },
        { r: 'route_toden', h: 'Minowabashi', d: { svc_weekday: deps(506) }, ai: 'test:agency' },
      ],
      tdn_04: [
        { r: 'route_toden', h: 'Waseda', d: { svc_weekday: deps(499) }, ai: 'test:agency' },
        { r: 'route_toden', h: 'Minowabashi', d: { svc_weekday: deps(509) }, ai: 'test:agency' },
        {
          r: 'route_liner',
          h: 'Minumadai-shinsuikoen',
          d: { svc_weekday: deps(510) },
          ai: 'test:agency',
        },
        { r: 'route_liner', h: 'Nippori', d: { svc_weekday: deps(515) }, ai: 'test:agency' },
      ],
      // --- Liner stations ---
      lnr_01: [
        {
          r: 'route_liner',
          h: 'Minumadai-shinsuikoen',
          d: { svc_weekday: deps(513) },
          ai: 'test:agency',
        },
        { r: 'route_liner', h: 'Nippori', d: { svc_weekday: deps(518) }, ai: 'test:agency' },
      ],
      lnr_02: [
        {
          r: 'route_liner',
          h: 'Minumadai-shinsuikoen',
          d: { svc_weekday: deps(516) },
          ai: 'test:agency',
        },
        { r: 'route_liner', h: 'Nippori', d: { svc_weekday: deps(521) }, ai: 'test:agency' },
      ],
      // --- Bus stops ---
      bus_01: [
        { r: 'route_bus', h: 'Ikebukuro-eki', d: { svc_weekday: deps(492) }, ai: 'test:agency' },
        { r: 'route_bus', h: 'Oji-eki', d: { svc_weekday: deps(502) }, ai: 'test:agency' },
      ],
      bus_02: [
        { r: 'route_bus', h: 'Ikebukuro-eki', d: { svc_weekday: deps(498) }, ai: 'test:agency' },
        { r: 'route_bus', h: 'Oji-eki', d: { svc_weekday: deps(508) }, ai: 'test:agency' },
      ],
      bus_03: [
        { r: 'route_bus', h: 'Ikebukuro-eki', d: { svc_weekday: deps(504) }, ai: 'test:agency' },
        { r: 'route_bus', h: 'Oji-eki', d: { svc_weekday: deps(514) }, ai: 'test:agency' },
      ],
      // stop_closed: intentionally no timetable
    },
    agencies: [
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
    ],
    translations: {
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
      },
      route_names: {},
      agency_names: { 'test:agency': { ja: 'テスト事業者', en: 'Test Agency' } },
      agency_short_names: { 'test:agency': { ja: 'テスト', en: 'Test' } },
    },
    shapes: {
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
  };
}

/** A Wednesday in 2026 at 10:00 (no calendar exceptions on this date). */
export const WEEKDAY = new Date('2026-03-11T10:00:00');
/** A Saturday in 2026 at 10:00. */
export const SATURDAY = new Date('2026-03-07T10:00:00');
/** Thursday 01:30 — before service day boundary, service day = Wednesday (Mar 11). */
export const WEEKDAY_OVERNIGHT = new Date('2026-03-12T01:30:00');
/** Thursday 04:00 — after boundary, service day = Thursday (Mar 12). */
export const WEEKDAY_AFTER_BOUNDARY = new Date('2026-03-12T04:00:00');
/** Wednesday 03:00 — exactly at service day boundary, service day = Wed (Mar 11). */
export const BOUNDARY_EXACT = new Date('2026-03-11T03:00:00');
/** Wednesday 03:02 — just after boundary, service day = Wed (Mar 11). */
export const BOUNDARY_JUST_AFTER = new Date('2026-03-11T03:02:00');
/**
 * Wednesday Mar 4 at 10:00 — has calendar_dates exceptions:
 * svc_weekday removed, svc_holiday added. Runs holiday service despite
 * being a Wednesday.
 */
export const EXCEPTION_HOLIDAY = new Date('2026-03-04T10:00:00');
