/**
 * In-memory mock implementation of {@link TransitRepository}.
 *
 * Provides fictional stops and routes around Kumano-mae for UI development
 * and edge-marker validation without real GTFS data.
 * All stop/route names are fictional and do not represent real services.
 *
 * Includes stops with multiple route types for testing the
 * `routeTypes: RouteType[]` feature:
 * - `sta_central`: tram(0) + subway(1) + rail(2) + bus(3) — all 4 types
 * - `sta_central_s`: subway(1) + rail(2) + bus(3) — 3 types
 * - `sta_hill`: rail(2) + bus(3)
 * - `sta_east`: tram(0) + rail(2)
 * - `sta_south`: subway(1) + rail(2)
 */

import type { Bounds, LatLng, RouteShape } from '../types/app/map';
import type {
  Agency,
  DepartureGroup,
  FullDayStopDeparture,
  Route,
  RouteType,
  Stop,
  StopWithMeta,
} from '../types/app/transit';
import type { CollectionResult, Result } from '../types/app/repository';
import { MAX_STOPS_RESULT } from './transit-repository';
import type { TransitRepository } from './transit-repository';

// --- Mock agency ---
const AGENCY: Agency = {
  agency_id: 'mock:agency',
  agency_name: 'あおば交通株式会社',
  agency_short_name: 'あおば交通',
  agency_names: { ja: 'あおば交通株式会社', en: 'Aoba Transit Co.' },
  agency_short_names: { ja: 'あおば交通', en: 'Aoba Transit' },
  agency_url: 'https://example.com',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: '2E7D32', text: 'FFFFFF' }],
};

// --- Fictional stops clustered around Kumano-mae (~2 km spread) ---
// Center: 35.7485, 139.7699

const STOPS: Stop[] = [
  // Multi-type stations (location_type: 1)
  {
    stop_id: 'sta_central',
    stop_name: 'あおば中央駅',
    stop_names: { ja: 'あおば中央駅', 'ja-Hrkt': 'あおばちゅうおうえき', en: 'Aoba-Chuo Sta.' },
    stop_lat: 35.7485,
    stop_lon: 139.7699,
    location_type: 1,
    agency_id: 'mock:agency',
  },
  {
    stop_id: 'sta_central_s',
    stop_name: 'あおば中央駅南口',
    stop_names: {
      ja: 'あおば中央駅南口',
      'ja-Hrkt': 'あおばちゅうおうえきみなみぐち',
      en: 'Aoba-Chuo Sta. South',
    },
    stop_lat: 35.7471,
    stop_lon: 139.7703,
    location_type: 1,
    agency_id: 'mock:agency',
  },
  {
    stop_id: 'sta_hill',
    stop_name: 'みどり丘駅',
    stop_names: { ja: 'みどり丘駅', 'ja-Hrkt': 'みどりおかえき', en: 'Midori-oka Sta.' },
    stop_lat: 35.7534,
    stop_lon: 139.7579,
    location_type: 1,
    agency_id: 'mock:agency',
  },
  {
    stop_id: 'sta_east',
    stop_name: 'ひかり台駅',
    stop_names: { ja: 'ひかり台駅', 'ja-Hrkt': 'ひかりだいえき', en: 'Hikari-dai Sta.' },
    stop_lat: 35.7509,
    stop_lon: 139.7809,
    location_type: 1,
    agency_id: 'mock:agency',
  },
  // Single-type rail stations
  {
    stop_id: 'sta_north',
    stop_name: 'はなみ駅',
    stop_names: { ja: 'はなみ駅', 'ja-Hrkt': 'はなみえき', en: 'Hanami Sta.' },
    stop_lat: 35.7577,
    stop_lon: 139.7659,
    location_type: 1,
    agency_id: 'mock:agency',
  },
  {
    stop_id: 'sta_west',
    stop_name: 'つきみの駅',
    stop_names: { ja: 'つきみの駅', 'ja-Hrkt': 'つきみのえき', en: 'Tsukimino Sta.' },
    stop_lat: 35.7521,
    stop_lon: 139.7529,
    location_type: 1,
    agency_id: 'mock:agency',
  },
  {
    stop_id: 'sta_south',
    stop_name: 'かぜの駅',
    stop_names: { ja: 'かぜの駅', 'ja-Hrkt': 'かぜのえき', en: 'Kazeno Sta.' },
    stop_lat: 35.7427,
    stop_lon: 139.7646,
    location_type: 1,
    agency_id: 'mock:agency',
  },
  {
    stop_id: 'sta_northwest',
    stop_name: 'ゆめの丘駅',
    stop_names: { ja: 'ゆめの丘駅', 'ja-Hrkt': 'ゆめのおかえき', en: 'Yumeno-oka Sta.' },
    stop_lat: 35.7564,
    stop_lon: 139.7556,
    location_type: 1,
    agency_id: 'mock:agency',
  },
  // Bus stops (location_type: 0)
  {
    stop_id: 'bus_park',
    stop_name: 'もり公園前',
    stop_names: { ja: 'もり公園前', 'ja-Hrkt': 'もりこうえんまえ', en: 'Mori Park' },
    stop_lat: 35.7497,
    stop_lon: 139.7669,
    location_type: 0,
    agency_id: 'mock:agency',
  },
  {
    stop_id: 'bus_library',
    stop_name: 'あおば図書館前',
    stop_names: { ja: 'あおば図書館前', 'ja-Hrkt': 'あおばとしょかんまえ', en: 'Aoba Library' },
    stop_lat: 35.7514,
    stop_lon: 139.7636,
    location_type: 0,
    agency_id: 'mock:agency',
  },
  {
    stop_id: 'bus_tower',
    stop_name: 'そらタワー下',
    stop_names: { ja: 'そらタワー下', 'ja-Hrkt': 'そらたわーした', en: 'Sora Tower' },
    stop_lat: 35.7457,
    stop_lon: 139.7626,
    location_type: 0,
    agency_id: 'mock:agency',
  },
  {
    stop_id: 'bus_bridge',
    stop_name: 'にじ橋',
    stop_names: { ja: 'にじ橋', 'ja-Hrkt': 'にじばし', en: 'Niji Bridge' },
    stop_lat: 35.7587,
    stop_lon: 139.7599,
    location_type: 0,
    agency_id: 'mock:agency',
  },
  // Tram-only stop
  {
    stop_id: 'tram_hoshi_park',
    stop_name: 'ほし公園前',
    stop_names: { ja: 'ほし公園前', 'ja-Hrkt': 'ほしこうえんまえ', en: 'Hoshi Park' },
    stop_lat: 35.7518,
    stop_lon: 139.7858,
    location_type: 0,
    agency_id: 'mock:agency',
  },
  // Subway-only stop
  {
    stop_id: 'subway_sora_nishi',
    stop_name: 'そら西駅',
    stop_names: { ja: 'そら西駅', 'ja-Hrkt': 'そらにしえき', en: 'Sora-nishi Sta.' },
    stop_lat: 35.7438,
    stop_lon: 139.7576,
    location_type: 1,
    agency_id: 'mock:agency',
  },
  // Distant station (~15 km south, near Haneda) for testing pan+zoom behavior
  {
    stop_id: 'sta_airport',
    stop_name: 'つき宇宙空港駅',
    stop_names: {
      ja: 'つき宇宙空港駅',
      'ja-Hrkt': 'つきうちゅうくうこうえき',
      en: 'Tsuki Spaceport Sta.',
    },
    stop_lat: 35.5494,
    stop_lon: 139.7798,
    location_type: 1,
    agency_id: 'mock:agency',
  },
];

const ROUTES: Route[] = [
  // Bus routes (route_type: 3)
  {
    route_id: 'bus_aoba01',
    route_short_name: 'あ01',
    route_long_name: 'あおば中央-にじ橋',
    route_names: {},
    route_type: 3,
    route_color: '2E7D32',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
  {
    route_id: 'bus_aoba02',
    route_short_name: 'あ02',
    route_long_name: 'あおば中央-そらタワー',
    route_names: {},
    route_type: 3,
    route_color: '1565C0',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
  {
    route_id: 'bus_midori10',
    route_short_name: 'み10',
    route_long_name: 'みどり丘-かぜの駅',
    route_names: {},
    route_type: 3,
    route_color: 'E65100',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
  /**
   * Route with empty headsign (GTFS trip_headsign is optional).
   * Assigned to `bus_park` alongside normal routes (bus_aoba01) to test
   * that the stop card displays a "行先が表示されない路線があります"
   * annotation when headsign-present and headsign-absent routes coexist.
   */
  {
    route_id: 'bus_nohd01',
    route_short_name: '無01',
    route_long_name: '',
    route_names: {},
    route_type: 3,
    route_color: '757575',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
  // Rail routes (route_type: 2)
  {
    route_id: 'rail_aoba',
    route_short_name: 'あおば線',
    route_long_name: 'あおば線',
    route_names: {},
    route_type: 2,
    route_color: 'F15A22',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
  {
    route_id: 'rail_hikari',
    route_short_name: 'ひかり線',
    route_long_name: 'ひかり線',
    route_names: {},
    route_type: 2,
    route_color: '0068B7',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
  {
    route_id: 'rail_midori',
    route_short_name: 'みどり線',
    route_long_name: 'みどり線',
    route_names: {},
    route_type: 2,
    route_color: 'E60012',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
  // Subway route (route_type: 1)
  {
    route_id: 'subway_sora',
    route_short_name: 'そら線',
    route_long_name: 'そら線',
    route_names: {},
    route_type: 1,
    route_color: 'CF3366',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
  // Subway express route (route_type: 1) — distant stop for pan+zoom testing
  {
    route_id: 'subway_airport',
    route_short_name: 'AL',
    route_long_name: 'エアポートライナー',
    route_names: {},
    route_type: 1,
    route_color: '00796B',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
  // Tram route (route_type: 0) — for multi-type testing
  {
    route_id: 'tram_hoshi',
    route_short_name: 'ほし電車',
    route_long_name: 'ほし電車線',
    route_names: {},
    route_type: 0,
    route_color: '8B0000',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:agency',
  },
];

/**
 * Which routes serve which stops.
 *
 * Multi-route-type stops:
 * - sta_central: tram(0) + subway(1) + rail(2) + bus(3) — all 4 types
 * - sta_central_s: subway(1) + rail(2) + bus(3)
 * - sta_hill: rail(2) + bus(3)
 * - sta_east: tram(0) + rail(2)
 * - sta_south: subway(1) + rail(2)
 */
const STOP_ROUTES: Record<string, { routeId: string; headsign: string }[]> = {
  sta_central: [
    { routeId: 'rail_aoba', headsign: 'はなみ方面' },
    { routeId: 'rail_aoba', headsign: 'かぜの方面' },
    { routeId: 'subway_sora', headsign: 'そらタワー方面' },
    { routeId: 'subway_sora', headsign: 'にじ橋方面' },
    { routeId: 'subway_airport', headsign: 'つき宇宙空港方面' },
    { routeId: 'tram_hoshi', headsign: 'ほし公園' },
    { routeId: 'bus_aoba01', headsign: 'にじ橋' },
    { routeId: 'bus_aoba02', headsign: 'そらタワー' },
  ],
  sta_central_s: [
    { routeId: 'rail_aoba', headsign: 'はなみ方面' },
    { routeId: 'rail_aoba', headsign: 'かぜの方面' },
    { routeId: 'subway_sora', headsign: 'そらタワー方面' },
    { routeId: 'subway_sora', headsign: 'にじ橋方面' },
    { routeId: 'bus_aoba02', headsign: 'そらタワー' },
  ],
  sta_hill: [
    { routeId: 'rail_midori', headsign: 'ゆめの丘方面' },
    { routeId: 'rail_midori', headsign: 'ひかり台方面' },
    { routeId: 'bus_midori10', headsign: 'かぜの駅' },
  ],
  sta_east: [
    { routeId: 'rail_hikari', headsign: 'あおば中央方面' },
    { routeId: 'rail_hikari', headsign: 'みどり丘方面' },
    { routeId: 'tram_hoshi', headsign: 'ほし公園' },
  ],
  sta_north: [
    { routeId: 'rail_hikari', headsign: 'あおば中央方面' },
    { routeId: 'rail_hikari', headsign: 'みどり丘方面' },
  ],
  sta_west: [
    { routeId: 'rail_midori', headsign: 'ゆめの丘方面' },
    { routeId: 'rail_midori', headsign: 'ひかり台方面' },
  ],
  sta_south: [
    { routeId: 'rail_aoba', headsign: 'はなみ方面' },
    { routeId: 'rail_aoba', headsign: 'かぜの方面' },
    { routeId: 'subway_sora', headsign: 'そらタワー方面' },
    { routeId: 'subway_sora', headsign: 'にじ橋方面' },
  ],
  sta_northwest: [
    { routeId: 'rail_midori', headsign: 'ゆめの丘方面' },
    { routeId: 'rail_midori', headsign: 'ひかり台方面' },
  ],
  bus_park: [
    { routeId: 'bus_aoba01', headsign: 'にじ橋' },
    { routeId: 'bus_aoba01', headsign: 'あおば中央駅' },
    { routeId: 'bus_nohd01', headsign: '' }, // empty headsign — tests missing destination annotation
  ],
  bus_library: [
    { routeId: 'bus_aoba01', headsign: 'にじ橋' },
    { routeId: 'bus_aoba02', headsign: 'そらタワー' },
  ],
  bus_tower: [{ routeId: 'bus_aoba02', headsign: 'あおば中央駅' }],
  bus_bridge: [{ routeId: 'bus_aoba01', headsign: 'あおば中央駅' }],
  tram_hoshi_park: [
    { routeId: 'tram_hoshi', headsign: 'あおば中央方面' },
    { routeId: 'tram_hoshi', headsign: 'ほし公園' },
  ],
  subway_sora_nishi: [
    { routeId: 'subway_sora', headsign: 'にじ橋方面' },
    { routeId: 'subway_sora', headsign: 'そらタワー方面' },
  ],
  sta_airport: [{ routeId: 'subway_airport', headsign: 'あおば中央方面' }],
};

/** Pre-computed route types per stop (deduplicated, sorted ascending). */
const STOP_ROUTE_TYPES: Map<string, RouteType[]> = (() => {
  const routeMap = new Map(ROUTES.map((r) => [r.route_id, r]));
  const result = new Map<string, RouteType[]>();

  for (const [stopId, entries] of Object.entries(STOP_ROUTES)) {
    const types = new Set<RouteType>();
    for (const { routeId } of entries) {
      const route = routeMap.get(routeId);
      if (route) {
        types.add(route.route_type);
      }
    }
    if (types.size > 0) {
      result.set(
        stopId,
        [...types].sort((a, b) => a - b),
      );
    }
  }
  return result;
})();

/** Stop coordinate lookup for building route shapes. */
const STOP_COORDS = new Map(STOPS.map((s) => [s.stop_id, [s.stop_lat, s.stop_lon] as const]));

function coord(stopId: string): [number, number] {
  const c = STOP_COORDS.get(stopId);
  return c ? [c[0], c[1]] : [0, 0];
}

const ROUTE_MAP = new Map(ROUTES.map((r) => [r.route_id, r]));

/**
 * Route shapes built from stop coordinates.
 * Each route connects its stops in order as a polyline.
 */
const ROUTE_SHAPES: RouteShape[] = [
  // rail_aoba: かぜの駅 → 中央駅南口 → 中央駅 → はなみ駅
  {
    routeId: 'rail_aoba',
    routeType: 2,
    color: `#${ROUTE_MAP.get('rail_aoba')!.route_color}`,
    route: ROUTE_MAP.get('rail_aoba')!,
    points: [coord('sta_south'), coord('sta_central_s'), coord('sta_central'), coord('sta_north')],
  },
  // rail_hikari: みどり丘駅 → はなみ駅 → ひかり台駅
  {
    routeId: 'rail_hikari',
    routeType: 2,
    color: `#${ROUTE_MAP.get('rail_hikari')!.route_color}`,
    route: ROUTE_MAP.get('rail_hikari')!,
    points: [coord('sta_hill'), coord('sta_north'), coord('sta_east')],
  },
  // rail_midori: ひかり台駅 → みどり丘駅 → ゆめの丘駅 → つきの駅
  {
    routeId: 'rail_midori',
    routeType: 2,
    color: `#${ROUTE_MAP.get('rail_midori')!.route_color}`,
    route: ROUTE_MAP.get('rail_midori')!,
    points: [coord('sta_east'), coord('sta_hill'), coord('sta_northwest'), coord('sta_west')],
  },
  // subway_sora: かぜの駅 → 中央駅南口 → そらタワー下
  {
    routeId: 'subway_sora',
    routeType: 1,
    color: `#${ROUTE_MAP.get('subway_sora')!.route_color}`,
    route: ROUTE_MAP.get('subway_sora')!,
    points: [
      coord('sta_south'),
      coord('sta_central_s'),
      coord('bus_tower'),
      coord('subway_sora_nishi'),
    ],
  },
  // tram_hoshi: 中央駅 → ひかり台駅 → ほし公園前
  {
    routeId: 'tram_hoshi',
    routeType: 0,
    color: `#${ROUTE_MAP.get('tram_hoshi')!.route_color}`,
    route: ROUTE_MAP.get('tram_hoshi')!,
    points: [coord('sta_central'), coord('sta_east'), coord('tram_hoshi_park')],
  },
  // subway_airport: 中央駅 → つき宇宙空港駅 (~15 km direct)
  {
    routeId: 'subway_airport',
    routeType: 1,
    color: `#${ROUTE_MAP.get('subway_airport')!.route_color}`,
    route: ROUTE_MAP.get('subway_airport')!,
    points: [coord('sta_central'), coord('sta_airport')],
  },
  // bus_aoba01: 中央駅 → もり公園前 → 図書館前 → にじ橋
  {
    routeId: 'bus_aoba01',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_aoba01')!.route_color}`,
    route: ROUTE_MAP.get('bus_aoba01')!,
    points: [coord('sta_central'), coord('bus_park'), coord('bus_library'), coord('bus_bridge')],
  },
  // bus_aoba02: 中央駅 → そらタワー下
  {
    routeId: 'bus_aoba02',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_aoba02')!.route_color}`,
    route: ROUTE_MAP.get('bus_aoba02')!,
    points: [coord('sta_central'), coord('bus_tower')],
  },
  // bus_midori10: みどり丘駅 → 図書館前 → かぜの駅
  {
    routeId: 'bus_midori10',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_midori10')!.route_color}`,
    route: ROUTE_MAP.get('bus_midori10')!,
    points: [coord('sta_hill'), coord('bus_library'), coord('sta_south')],
  },
];

function simpleHash(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) | 0;
  }
  return Math.abs(hash);
}

function generateDepartureTimes(now: Date, routeId: string, isBus: boolean): Date[] {
  const offsets = isBus ? [3, 15, 32] : [2, 7, 13];
  const routeOffset = simpleHash(routeId) % 5;

  return offsets.map((offset) => {
    const time = new Date(now);
    time.setMinutes(time.getMinutes() + offset + routeOffset);
    time.setSeconds(0, 0);
    return time;
  });
}

/** Euclidean distance approximation in km at ~35 N latitude. */
function approxDistanceKm(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const dlat = (lat1 - lat2) * 111;
  const dlng = (lon1 - lon2) * 91;
  return Math.sqrt(dlat * dlat + dlng * dlng);
}

export class MockRepository implements TransitRepository {
  /** {@inheritDoc TransitRepository.getStopsInBounds} */
  getStopsInBounds(bounds: Bounds, limit: number): Promise<CollectionResult<StopWithMeta>> {
    const effectiveLimit = Math.min(limit, MAX_STOPS_RESULT);
    const centerLat = (bounds.north + bounds.south) / 2;
    const centerLng = (bounds.east + bounds.west) / 2;

    const matching: { stop: Stop; distance: number }[] = [];
    for (const stop of STOPS) {
      if (
        stop.stop_lat >= bounds.south &&
        stop.stop_lat <= bounds.north &&
        stop.stop_lon >= bounds.west &&
        stop.stop_lon <= bounds.east
      ) {
        const distKm = approxDistanceKm(stop.stop_lat, stop.stop_lon, centerLat, centerLng);
        matching.push({ stop, distance: distKm * 1000 });
      }
    }

    matching.sort((a, b) => a.distance - b.distance);

    const truncated = matching.length > effectiveLimit;
    const data: StopWithMeta[] = matching
      .slice(0, effectiveLimit)
      .map((m) => ({ stop: m.stop, distance: m.distance }));

    return Promise.resolve({ success: true, data, truncated });
  }

  /** {@inheritDoc TransitRepository.getUpcomingDepartures} */
  getUpcomingDepartures(
    stopId: string,
    now: Date,
    limit = 3,
  ): Promise<CollectionResult<DepartureGroup>> {
    const stop = STOPS.find((s) => s.stop_id === stopId);
    if (!stop) {
      return Promise.resolve({ success: false, error: `No departure data for stop: ${stopId}` });
    }

    const stopRoutes = STOP_ROUTES[stopId] ?? [];
    const groups: DepartureGroup[] = [];

    for (const { routeId, headsign } of stopRoutes) {
      const route = ROUTES.find((r) => r.route_id === routeId);
      if (!route) {
        continue;
      }

      const isBus = route.route_type === 3;
      const times = generateDepartureTimes(now, routeId + headsign, isBus);

      const departures = times.slice(0, limit);
      if (departures.length === 0) {
        continue;
      }
      groups.push({ route, headsign, headsign_names: {}, departures });
    }

    groups.sort((a, b) => a.departures[0].getTime() - b.departures[0].getTime());

    return Promise.resolve({ success: true, data: groups, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getRouteTypesForStop} */
  getRouteTypesForStop(stopId: string): Promise<Result<RouteType[]>> {
    const types = STOP_ROUTE_TYPES.get(stopId);
    if (!types) {
      return Promise.resolve({ success: false, error: `No route types for stop: ${stopId}` });
    }
    return Promise.resolve({ success: true, data: types });
  }

  /** {@inheritDoc TransitRepository.getStopsNearby} */
  getStopsNearby(
    center: LatLng,
    radiusM: number,
    limit: number,
  ): Promise<CollectionResult<StopWithMeta>> {
    if (radiusM <= 0) {
      return Promise.resolve({ success: true, data: [], truncated: false });
    }

    const effectiveLimit = Math.min(limit, MAX_STOPS_RESULT);
    const radiusKm = radiusM / 1000;
    const sorted = STOPS.map((stop) => {
      const distKm = approxDistanceKm(stop.stop_lat, stop.stop_lon, center.lat, center.lng);
      return { stop, distKm };
    })
      .filter(({ distKm }) => distKm <= radiusKm)
      .sort((a, b) => a.distKm - b.distKm);

    const truncated = sorted.length > effectiveLimit;
    const data: StopWithMeta[] = sorted
      .slice(0, effectiveLimit)
      .map(({ stop, distKm }) => ({ stop, distance: distKm * 1000 }));

    return Promise.resolve({ success: true, data, truncated });
  }

  /** {@inheritDoc TransitRepository.getRouteShapes} */
  getRouteShapes(): Promise<CollectionResult<RouteShape>> {
    return Promise.resolve({ success: true, data: ROUTE_SHAPES, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getFullDayDepartures} */
  getFullDayDepartures(
    ...[, , ,]: [string, string, string, Date]
  ): Promise<CollectionResult<number>> {
    const minutes: number[] = [];
    for (let h = 5; h <= 23; h++) {
      minutes.push(h * 60, h * 60 + 15, h * 60 + 30, h * 60 + 45);
    }
    return Promise.resolve({ success: true, data: minutes, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getFullDayDeparturesForStop} */
  getFullDayDeparturesForStop(
    stopId: string,
    ...[
      /* dateTime */
    ]: [Date]
  ): Promise<CollectionResult<FullDayStopDeparture>> {
    const stopRoutes = STOP_ROUTES[stopId] ?? [];
    const departures: FullDayStopDeparture[] = [];

    for (const { routeId, headsign } of stopRoutes) {
      const route = ROUTES.find((r) => r.route_id === routeId);
      if (!route) {
        continue;
      }
      for (let h = 5; h <= 23; h++) {
        for (const offset of [0, 15, 30, 45]) {
          departures.push({ minutes: h * 60 + offset, route, headsign, headsign_names: {} });
        }
      }
    }

    departures.sort((a, b) => a.minutes - b.minutes);
    return Promise.resolve({ success: true, data: departures, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getAllStops} */
  getAllStops(): Promise<CollectionResult<Stop>> {
    return Promise.resolve({ success: true, data: STOPS, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getAgency} */
  getAgency(agencyId: string): Promise<Result<Agency>> {
    if (agencyId === AGENCY.agency_id) {
      return Promise.resolve({ success: true, data: AGENCY });
    }
    return Promise.resolve({ success: false, error: `Agency not found: ${agencyId}` });
  }
}
