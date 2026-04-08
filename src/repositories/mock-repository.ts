/**
 * In-memory mock implementation of {@link TransitRepository}.
 *
 * Provides fictional stops and routes around Kumano-mae for UI development
 * and edge-marker validation without real GTFS data.
 * All stop/route names are fictional and do not represent real services.
 *
 * Includes stops with multiple route types for testing the
 * `routeTypes: RouteType[]` feature:
 * - `sta_central`: tram(0) + subway(1) + rail(2) + bus(3) — all 4 types,
 *   with bus routes from two agencies (あおば交通 + そら急行バス)
 * - `sta_central_s`: subway(1) + rail(2) + bus(3) — 3 types
 * - `sta_hill`: rail(2) + bus(3)
 * - `sta_east`: tram(0) + rail(2)
 * - `sta_south`: subway(1) + rail(2)
 */

import type { Bounds, LatLng, RouteShape } from '../types/app/map';
import type { Agency, Route, RouteType, Stop } from '../types/app/transit';
import type {
  ContextualTimetableEntry,
  SourceMeta,
  StopWithMeta,
  TimetableEntry,
  TranslatableText,
} from '../types/app/transit-composed';
import type {
  CollectionResult,
  Result,
  TimetableQueryMeta,
  TimetableResult,
  UpcomingTimetableResult,
} from '../types/app/repository';
import { isDropOffOnly } from '../domain/transit/timetable-utils';
import { getServiceDay, getServiceDayMinutes } from '../domain/transit/service-day';
import { MAX_STOPS_RESULT } from './transit-repository';
import type { TransitRepository } from './transit-repository';

// --- Mock agencies ---
const AGENCY: Agency = {
  agency_id: 'mock:aoba',
  agency_name: 'あおば交通株式会社',
  agency_short_name: 'あおバス',
  agency_names: {
    ja: 'あおば交通株式会社',
    en: 'Aoba Transit Co.',
    ko: '아오바교통',
    'zh-Hans': '青叶交通株式会社',
    'zh-Hant': '青葉交通株式會社',
  },
  agency_short_names: { ja: 'あおバス', en: 'Aoba', ko: '아오바', 'zh-Hans': '青叶巴士' },
  agency_url: 'https://example.com/aoba',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: 'https://example.com/aoba/fare',
  agency_colors: [{ bg: '2E7D32', text: 'FFFFFF' }],
};

const AGENCY_SORA: Agency = {
  agency_id: 'mock:soraq',
  agency_name: 'そら急行バス株式会社',
  agency_short_name: 'そら急',
  agency_names: {
    ja: 'そら急行バス株式会社',
    en: 'Sora Express Bus Co.',
    ko: '소라급행버스',
    'zh-Hans': '空急行巴士株式会社',
  },
  agency_short_names: { ja: 'そら急', en: 'Sora Exp', ko: '소라급' },
  agency_url: 'https://example.com/sora',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: 'https://example.com/sora/fare',
  agency_colors: [{ bg: '1565C0', text: 'FFFFFF' }],
};

const AGENCY_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  'mock:aoba': {
    'zh-Hant': '青葉交通株式會社',
  },
  'mock:soraq': {
    ko: '소라급행버스',
    'zh-Hans': '空急行巴士株式会社',
    'zh-Hant': '空急行巴士株式會社',
  },
};

const AGENCY_SHORT_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  'mock:aoba': {
    'zh-Hant': '青葉巴士',
  },
  'mock:soraq': {
    ko: '소라급',
    'zh-Hans': '空急',
    'zh-Hant': '空急',
  },
};

for (const agency of [AGENCY, AGENCY_SORA]) {
  Object.assign(agency.agency_names, AGENCY_NAME_TRANSLATIONS[agency.agency_id] ?? {});
  Object.assign(agency.agency_short_names, AGENCY_SHORT_NAME_TRANSLATIONS[agency.agency_id] ?? {});
}

const AGENCY_MAP = new Map<string, Agency>([AGENCY, AGENCY_SORA].map((a) => [a.agency_id, a]));

const STOP_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  sta_central: { ko: '아오바중앙역', 'zh-Hans': '青叶中央站', 'zh-Hant': '青葉中央站' },
  sta_central_s: {
    ko: '아오바중앙역 남쪽 출구',
    'zh-Hans': '青叶中央站南口',
    'zh-Hant': '青葉中央站南口',
  },
  sta_hill: { ko: '미도리오카역', 'zh-Hans': '绿丘站', 'zh-Hant': '綠丘站' },
  sta_east: { ko: '히카리다이역', 'zh-Hans': '光台站', 'zh-Hant': '光台站' },
  sta_north: { ko: '하나미역', 'zh-Hans': '花见站', 'zh-Hant': '花見站' },
  sta_west: { ko: '쓰키미노역', 'zh-Hans': '月见野站', 'zh-Hant': '月見野站' },
  sta_south: { ko: '가제노역', 'zh-Hans': '风野站', 'zh-Hant': '風野站' },
  sta_northwest: { ko: '유메노오카역', 'zh-Hans': '梦之丘站', 'zh-Hant': '夢之丘站' },
  bus_central_dropoff: {
    ko: '아오바중앙역(하차 전용)',
    'zh-Hans': '青叶中央站(仅下车)',
    'zh-Hant': '青葉中央站(僅下車)',
  },
  bus_park: { ko: '모리공원 앞', 'zh-Hans': '森公园前', 'zh-Hant': '森公園前' },
  bus_library: {
    ko: '아오바도서관 앞',
    'zh-Hans': '青叶图书馆前',
    'zh-Hant': '青葉圖書館前',
  },
  bus_tower: { ko: '소라타워 아래', 'zh-Hans': '空塔下', 'zh-Hant': '空塔下' },
  bus_bridge: { ko: '니지다리', 'zh-Hans': '彩虹桥', 'zh-Hant': '彩虹橋' },
  tram_hoshi_park: { ko: '호시공원 앞', 'zh-Hans': '星公园前', 'zh-Hant': '星公園前' },
  subway_sora_nishi: { ko: '소라니시역', 'zh-Hans': '空西站', 'zh-Hant': '空西站' },
  bus_hotel_mangetsu: { ko: '호텔 만게쓰', 'zh-Hans': '满月酒店', 'zh-Hant': '滿月酒店' },
  bus_hotel_shingetsu: { ko: '호텔 신게쓰', 'zh-Hans': '新月酒店', 'zh-Hant': '新月酒店' },
  sta_airport: {
    ko: '츠키 우주공항역',
    'zh-Hans': '月宇宙机场站',
    'zh-Hant': '月宇宙機場站',
  },
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
    agency_id: 'mock:aoba',
    wheelchair_boarding: 1,
    platform_code: '1',
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
    agency_id: 'mock:aoba',
    wheelchair_boarding: 2,
    platform_code: '2',
  },
  {
    stop_id: 'sta_hill',
    stop_name: 'みどり丘駅',
    stop_names: { ja: 'みどり丘駅', 'ja-Hrkt': 'みどりおかえき', en: 'Midori-oka Sta.' },
    stop_lat: 35.7534,
    stop_lon: 139.7579,
    location_type: 1,
    agency_id: 'mock:aoba',
    wheelchair_boarding: 1,
  },
  {
    stop_id: 'sta_east',
    stop_name: 'ひかり台駅',
    stop_names: { ja: 'ひかり台駅', 'ja-Hrkt': 'ひかりだいえき', en: 'Hikari-dai Sta.' },
    stop_lat: 35.7509,
    stop_lon: 139.7809,
    location_type: 1,
    agency_id: 'mock:aoba',
  },
  // Single-type rail stations
  {
    stop_id: 'sta_north',
    stop_name: 'はなみ駅',
    stop_names: { ja: 'はなみ駅', 'ja-Hrkt': 'はなみえき', en: 'Hanami Sta.' },
    stop_lat: 35.7577,
    stop_lon: 139.7659,
    location_type: 1,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'sta_west',
    stop_name: 'つきみの駅',
    stop_names: { ja: 'つきみの駅', 'ja-Hrkt': 'つきみのえき', en: 'Tsukimino Sta.' },
    stop_lat: 35.7521,
    stop_lon: 139.7529,
    location_type: 1,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'sta_south',
    stop_name: 'かぜの駅',
    stop_names: { ja: 'かぜの駅', 'ja-Hrkt': 'かぜのえき', en: 'Kazeno Sta.' },
    stop_lat: 35.7427,
    stop_lon: 139.7646,
    location_type: 1,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'sta_northwest',
    stop_name: 'ゆめの丘駅',
    stop_names: { ja: 'ゆめの丘駅', 'ja-Hrkt': 'ゆめのおかえき', en: 'Yumeno-oka Sta.' },
    stop_lat: 35.7564,
    stop_lon: 139.7556,
    location_type: 1,
    agency_id: 'mock:aoba',
  },
  // Drop-off only bus stop near あおば中央駅
  {
    stop_id: 'bus_central_dropoff',
    stop_name: 'あおば中央駅(降車専用)',
    stop_names: {
      ja: 'あおば中央駅(降車専用)',
      'ja-Hrkt': 'あおばちゅうおうえき(こうしゃせんよう)',
      en: 'Aoba-Chuo Sta. (Drop-off Only)',
    },
    stop_lat: 35.7489,
    stop_lon: 139.7706,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  // Bus stops (location_type: 0)
  {
    stop_id: 'bus_park',
    stop_name: 'もり公園前',
    stop_names: { ja: 'もり公園前', 'ja-Hrkt': 'もりこうえんまえ', en: 'Mori Park' },
    stop_lat: 35.7497,
    stop_lon: 139.7669,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'bus_library',
    stop_name: 'あおば図書館前',
    stop_names: { ja: 'あおば図書館前', 'ja-Hrkt': 'あおばとしょかんまえ', en: 'Aoba Library' },
    stop_lat: 35.7514,
    stop_lon: 139.7636,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'bus_tower',
    stop_name: 'そらタワー下',
    stop_names: { ja: 'そらタワー下', 'ja-Hrkt': 'そらたわーした', en: 'Sora Tower' },
    stop_lat: 35.7457,
    stop_lon: 139.7626,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'bus_bridge',
    stop_name: 'にじ橋',
    stop_names: { ja: 'にじ橋', 'ja-Hrkt': 'にじばし', en: 'Niji Bridge' },
    stop_lat: 35.7587,
    stop_lon: 139.7599,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  // Tram-only stop
  {
    stop_id: 'tram_hoshi_park',
    stop_name: 'ほし公園前',
    stop_names: { ja: 'ほし公園前', 'ja-Hrkt': 'ほしこうえんまえ', en: 'Hoshi Park' },
    stop_lat: 35.7518,
    stop_lon: 139.7858,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  // Subway-only stop
  {
    stop_id: 'subway_sora_nishi',
    stop_name: 'そら西駅',
    stop_names: { ja: 'そら西駅', 'ja-Hrkt': 'そらにしえき', en: 'Sora-nishi Sta.' },
    stop_lat: 35.7438,
    stop_lon: 139.7576,
    location_type: 1,
    agency_id: 'mock:aoba',
  },
  // Hotel near the spaceport
  {
    stop_id: 'bus_hotel_mangetsu',
    stop_name: 'ホテル満月',
    stop_names: { ja: 'ホテル満月', 'ja-Hrkt': 'ほてるまんげつ', en: 'Hotel Mangetsu' },
    stop_lat: 35.57967,
    stop_lon: 139.7857,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  // Hotel near the coast
  {
    stop_id: 'bus_hotel_shingetsu',
    stop_name: 'ホテル新月',
    stop_names: { ja: 'ホテル新月', 'ja-Hrkt': 'ほてるしんげつ', en: 'Hotel Shingetsu' },
    stop_lat: 35.464832,
    stop_lon: 139.873584,
    location_type: 0,
    agency_id: 'mock:aoba',
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
    agency_id: 'mock:aoba',
  },
];

for (const stop of STOPS) {
  Object.assign(stop.stop_names, STOP_NAME_TRANSLATIONS[stop.stop_id] ?? {});
}

const ROUTE_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  bus_aoba01: {
    en: 'Aoba-Chuo - Niji Bridge',
    ko: '아오바중앙-니지다리',
    'zh-Hans': '青叶中央-彩虹桥',
    'zh-Hant': '青葉中央-彩虹橋',
  },
  bus_aoba02: {
    en: 'Aoba-Chuo - Sora Tower',
    ko: '아오바중앙-소라타워',
    'zh-Hans': '青叶中央-空塔',
    'zh-Hant': '青葉中央-空塔',
  },
  bus_midori10: {
    en: 'Midori-oka - Kazeno Sta.',
    ko: '미도리오카-가제노역',
    'zh-Hans': '绿丘-风野站',
    'zh-Hant': '綠丘-風野站',
  },
  bus_sora_exp01: {
    en: 'Aoba-Chuo - Tsukimino Sta.',
    ko: '아오바중앙-쓰키미노역',
    'zh-Hans': '青叶中央-月见野站',
    'zh-Hant': '青葉中央-月見野站',
  },
  subway_hotel_shuttle: {
    en: 'Tsuki Spaceport - Hotel Shingetsu',
    ko: '츠키 우주공항-호텔 신게쓰',
    'zh-Hans': '月宇宙机场-新月酒店',
    'zh-Hant': '月宇宙機場-新月酒店',
  },
  rail_aoba: {
    en: 'Aoba Line',
    ko: '아오바선',
    'zh-Hans': '青叶线',
    'zh-Hant': '青葉線',
  },
  rail_hikari: {
    en: 'Hikari Line',
    ko: '히카리선',
    'zh-Hans': '光线',
    'zh-Hant': '光線',
  },
  rail_midori: {
    en: 'Midori Line',
    ko: '미도리선',
    'zh-Hans': '绿线',
    'zh-Hant': '綠線',
  },
  subway_sora: {
    en: 'Sora Line',
    ko: '소라선',
    'zh-Hans': '空线',
    'zh-Hant': '空線',
  },
  subway_airport: {
    en: 'Airport Liner',
    ko: '에어포트 라이너',
    'zh-Hans': '机场线',
    'zh-Hant': '機場線',
  },
  subway_airport_sora: {
    en: 'Airport Liner',
    ko: '에어포트 라이너',
    'zh-Hans': '机场线',
    'zh-Hant': '機場線',
  },
  bus_yukkuri01: {
    en: 'Slow 01',
    ko: '천천히 01',
    'zh-Hans': '慢行01',
    'zh-Hant': '慢行01',
  },
  tram_hoshi: {
    en: 'Hoshi Tram Line',
    ko: '호시전차선',
    'zh-Hans': '星电车线',
    'zh-Hant': '星電車線',
  },
};

const ROUTES: Route[] = [
  // Bus routes (route_type: 3)
  {
    route_id: 'bus_aoba01',
    route_short_name: 'あ01',
    route_short_names: {},
    route_long_name: 'あおば中央-にじ橋',
    route_long_names: {},
    route_type: 3,
    route_color: '2E7D32',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  {
    route_id: 'bus_aoba02',
    route_short_name: 'あ02',
    route_short_names: {},
    route_long_name: 'あおば中央-そらタワー',
    route_long_names: {},
    route_type: 3,
    route_color: '1565C0',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  {
    route_id: 'bus_midori10',
    route_short_name: 'み10',
    route_short_names: {},
    route_long_name: 'みどり丘-かぜの駅',
    route_long_names: {},
    route_type: 3,
    route_color: 'E65100',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  /**
   * Route with empty trip_headsign but per-stop stop_headsign (keio-bus pattern).
   * Assigned to `bus_park`, `bus_library`, `bus_bridge` with stop_headsign
   * values that change per stop (kyoto-city-bus pattern). Tests:
   * - effective headsign = stop_headsign when trip_headsign is empty
   * - mid-trip headsign change across stops
   */
  {
    route_id: 'bus_nohd01',
    route_short_name: '無01',
    route_short_names: {},
    route_long_name: '',
    route_long_names: {},
    route_type: 3,
    route_color: '757575',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  // Bus route operated by a different agency (そら急行バス).
  // Serves sta_central alongside あおば交通 routes, testing multi-agency badges.
  {
    route_id: 'bus_sora_exp01',
    route_short_name: 'そ01',
    route_short_names: {},
    route_long_name: 'あおば中央-つきみの',
    route_long_names: {},
    route_type: 3,
    route_color: '1565C0',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:soraq',
  },
  // Short shuttle subway to nearby hotel (あおバス)
  {
    route_id: 'subway_hotel_shuttle',
    route_short_name: 'H1',
    route_short_names: {},
    route_long_name: 'つき宇宙空港-ホテル新月',
    route_long_names: {},
    route_type: 1,
    route_color: '8E24AA',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  // Rail routes (route_type: 2)
  {
    route_id: 'rail_aoba',
    route_short_name: 'あおば線',
    route_short_names: {},
    route_long_name: 'あおば線',
    route_long_names: {},
    route_type: 2,
    route_color: 'F15A22',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  {
    route_id: 'rail_hikari',
    route_short_name: 'ひかり線',
    route_short_names: {},
    route_long_name: 'ひかり線',
    route_long_names: {},
    route_type: 2,
    route_color: '0068B7',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  {
    route_id: 'rail_midori',
    route_short_name: 'みどり線',
    route_short_names: {},
    route_long_name: 'みどり線',
    route_long_names: {},
    route_type: 2,
    route_color: 'E60012',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  // Subway route (route_type: 1)
  {
    route_id: 'subway_sora',
    route_short_name: 'そら線',
    route_short_names: {},
    route_long_name: 'そら線',
    route_long_names: {},
    route_type: 1,
    route_color: 'CF3366',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  // Subway express route (route_type: 1) — distant stop for pan+zoom testing
  // Joint operation: あおバス and そら急 both operate AL (airport liner).
  {
    route_id: 'subway_airport',
    route_short_name: 'AL',
    route_short_names: {},
    route_long_name: 'エアポートライナー',
    route_long_names: {},
    route_type: 1,
    route_color: 'E65100',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  // そら急の共同運行側。route_type: 6 (gondola) は意図的 — 事業者間で route_type が異なるケースをテストするため
  {
    route_id: 'subway_airport_sora',
    route_short_name: 'AL',
    route_short_names: {},
    route_long_name: 'エアポートライナー',
    route_long_names: {},
    route_type: 6,
    route_color: 'F9A825',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:soraq',
  },
  // Slow bus with 3-minute dwell at every stop (arrival + 3min = departure).
  // Tests arrival/departure time difference in timetable display.
  {
    route_id: 'bus_yukkuri01',
    route_short_name: 'ゆ01',
    route_short_names: {},
    route_long_name: 'ゆっくり01',
    route_long_names: {},
    route_type: 3,
    route_color: 'A1887F',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
  // Tram route (route_type: 0) — for multi-type testing
  {
    route_id: 'tram_hoshi',
    route_short_name: 'ほし電車',
    route_short_names: {},
    route_long_name: 'ほし電車線',
    route_long_names: {},
    route_type: 0,
    route_color: '8B0000',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:aoba',
  },
];

for (const route of ROUTES) {
  route.route_long_names = ROUTE_NAME_TRANSLATIONS[route.route_id] ?? route.route_long_names;
}

const HEADSIGN_TRANSLATIONS: Record<string, Record<string, string>> = {
  はなみ: { en: 'Hanami', ko: '하나미', 'zh-Hans': '花见', 'zh-Hant': '花見' },
  かぜの: { en: 'Kazeno', ko: '가제노', 'zh-Hans': '风野', 'zh-Hant': '風野' },
  そらタワー: {
    en: 'Sora Tower',
    ko: '소라타워',
    'zh-Hans': '空塔',
    'zh-Hant': '空塔',
  },
  にじ橋: {
    en: 'Niji Bridge',
    ko: '니지다리',
    'zh-Hans': '彩虹桥',
    'zh-Hant': '彩虹橋',
  },
  つき宇宙空港: {
    en: 'Tsuki Spaceport',
    ko: '츠키 우주공항',
    'zh-Hans': '月宇宙机场',
    'zh-Hant': '月宇宙機場',
  },
  ホテル満月: {
    en: 'Hotel Mangetsu',
    ko: '호텔 만게쓰',
    'zh-Hans': '满月酒店',
    'zh-Hant': '滿月酒店',
  },
  ほし公園: {
    en: 'Hoshi Park',
    ko: '호시공원',
    'zh-Hans': '星公园',
    'zh-Hant': '星公園',
  },
  つきみの駅: {
    en: 'Tsukimino Sta.',
    ko: '쓰키미노역',
    'zh-Hans': '月见野站',
    'zh-Hant': '月見野站',
  },
  もり公園前: {
    en: 'Mori Park',
    ko: '모리공원 앞',
    'zh-Hans': '森公园前',
    'zh-Hant': '森公園前',
  },
  ゆめの丘: {
    en: 'Yumeno-oka',
    ko: '유메노오카',
    'zh-Hans': '梦之丘',
    'zh-Hant': '夢之丘',
  },
  ひかり台: {
    en: 'Hikari-dai',
    ko: '히카리다이',
    'zh-Hans': '光台',
    'zh-Hant': '光台',
  },
  かぜの駅: {
    en: 'Kazeno Sta.',
    ko: '가제노역',
    'zh-Hans': '风野站',
    'zh-Hant': '風野站',
  },
  あおば中央: {
    en: 'Aoba-Chuo',
    ko: '아오바중앙',
    'zh-Hans': '青叶中央',
    'zh-Hant': '青葉中央',
  },
  あおば中央駅: {
    en: 'Aoba-Chuo Sta.',
    ko: '아오바중앙역',
    'zh-Hans': '青叶中央站',
    'zh-Hant': '青葉中央站',
  },
  'もり公園前・にじ橋': {
    en: 'Mori Park / Niji Bridge',
    ko: '모리공원 앞 / 니지다리',
    'zh-Hans': '森公园前 / 彩虹桥',
    'zh-Hant': '森公園前 / 彩虹橋',
  },
  '図書館前・もり公園前': {
    en: 'Library / Mori Park',
    ko: '도서관 앞 / 모리공원 앞',
    'zh-Hans': '图书馆前 / 森公园前',
    'zh-Hant': '圖書館前 / 森公園前',
  },
  あおば中央方面: {
    en: 'For Aoba-Chuo',
    ko: '아오바중앙 방면',
    'zh-Hans': '往青叶中央',
    'zh-Hant': '往青葉中央',
  },
  にじ橋方面: {
    en: 'For Niji Bridge',
    ko: '니지다리 방면',
    'zh-Hans': '往彩虹桥',
    'zh-Hant': '往彩虹橋',
  },
  そらタワー方面: {
    en: 'For Sora Tower',
    ko: '소라타워 방면',
    'zh-Hans': '往空塔',
    'zh-Hant': '往空塔',
  },
  ホテル新月: {
    en: 'Hotel Shingetsu',
    ko: '호텔 신게쓰',
    'zh-Hans': '新月酒店',
    'zh-Hant': '新月酒店',
  },
  みどり丘: {
    en: 'Midori-oka',
    ko: '미도리오카',
    'zh-Hans': '绿丘',
    'zh-Hant': '綠丘',
  },
};

function createMockTranslatableText(name: string): TranslatableText {
  return { name, names: HEADSIGN_TRANSLATIONS[name] ?? {} };
}

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
const STOP_ROUTES: Record<string, { routeId: string; headsign: string; stopHeadsign?: string }[]> =
  {
    sta_central: [
      { routeId: 'rail_aoba', headsign: 'はなみ' },
      { routeId: 'rail_aoba', headsign: 'かぜの' },
      { routeId: 'subway_sora', headsign: 'そらタワー' },
      { routeId: 'subway_sora', headsign: 'にじ橋' },
      { routeId: 'subway_airport', headsign: 'つき宇宙空港' },
      { routeId: 'subway_airport_sora', headsign: 'つき宇宙空港' },
      { routeId: 'subway_airport_sora', headsign: 'ホテル満月' },
      { routeId: 'tram_hoshi', headsign: 'ほし公園' },
      { routeId: 'bus_aoba01', headsign: 'にじ橋' },
      { routeId: 'bus_aoba02', headsign: 'そらタワー' },
      { routeId: 'bus_sora_exp01', headsign: 'つきみの駅' },
      { routeId: 'bus_yukkuri01', headsign: 'もり公園前' },
    ],
    sta_central_s: [
      { routeId: 'rail_aoba', headsign: 'はなみ' },
      { routeId: 'rail_aoba', headsign: 'かぜの' },
      { routeId: 'subway_sora', headsign: 'そらタワー' },
      { routeId: 'subway_sora', headsign: 'にじ橋' },
      { routeId: 'bus_aoba02', headsign: 'そらタワー' },
    ],
    sta_hill: [
      { routeId: 'rail_midori', headsign: 'ゆめの丘' },
      { routeId: 'rail_midori', headsign: 'ひかり台' },
      { routeId: 'bus_midori10', headsign: 'かぜの駅' },
    ],
    sta_east: [
      { routeId: 'rail_hikari', headsign: 'あおば中央' },
      { routeId: 'rail_hikari', headsign: 'みどり丘' },
      { routeId: 'tram_hoshi', headsign: 'ほし公園' },
    ],
    sta_north: [
      { routeId: 'rail_hikari', headsign: 'あおば中央' },
      { routeId: 'rail_hikari', headsign: 'みどり丘' },
    ],
    sta_west: [
      { routeId: 'rail_midori', headsign: 'ゆめの丘' },
      { routeId: 'rail_midori', headsign: 'ひかり台' },
    ],
    sta_south: [
      { routeId: 'rail_aoba', headsign: 'はなみ' },
      { routeId: 'rail_aoba', headsign: 'かぜの' },
      { routeId: 'subway_sora', headsign: 'そらタワー' },
      { routeId: 'subway_sora', headsign: 'にじ橋' },
    ],
    sta_northwest: [
      { routeId: 'rail_midori', headsign: 'ゆめの丘' },
      { routeId: 'rail_midori', headsign: 'ひかり台' },
    ],
    // Drop-off only: pickupType=1 is handled in getUpcomingTimetableEntries
    bus_central_dropoff: [
      { routeId: 'bus_aoba01', headsign: 'あおば中央駅' },
      { routeId: 'bus_aoba02', headsign: 'あおば中央駅' },
      { routeId: 'bus_yukkuri01', headsign: 'あおば中央駅' },
    ],
    bus_park: [
      { routeId: 'bus_aoba01', headsign: 'にじ橋' },
      { routeId: 'bus_aoba01', headsign: 'あおば中央駅' },
      // bus_nohd01: trip_headsign empty + stop_headsign present (keio-bus pattern).
      // stop_headsign becomes the effective headsign via GTFS spec.
      { routeId: 'bus_nohd01', headsign: '', stopHeadsign: 'もり公園前' },
      { routeId: 'bus_yukkuri01', headsign: 'あおば中央駅' },
      { routeId: 'bus_yukkuri01', headsign: 'もり公園前' },
    ],
    bus_library: [
      { routeId: 'bus_aoba01', headsign: 'にじ橋' },
      { routeId: 'bus_aoba02', headsign: 'そらタワー' },
      { routeId: 'bus_yukkuri01', headsign: 'あおば中央駅' },
      { routeId: 'bus_yukkuri01', headsign: 'もり公園前' },
      // bus_nohd01: mid-trip stop_headsign differs from bus_park
      // (kyoto-city-bus pattern: stop_headsign changes as stops pass).
      { routeId: 'bus_nohd01', headsign: '', stopHeadsign: 'もり公園前・にじ橋' },
    ],
    bus_tower: [{ routeId: 'bus_aoba02', headsign: 'あおば中央駅' }],
    bus_bridge: [
      { routeId: 'bus_aoba01', headsign: 'あおば中央駅' },
      { routeId: 'bus_yukkuri01', headsign: 'あおば中央駅' },
      { routeId: 'bus_yukkuri01', headsign: 'もり公園前' },
      // bus_nohd01 at origin: stop_headsign shows full route
      { routeId: 'bus_nohd01', headsign: '', stopHeadsign: '図書館前・もり公園前' },
    ],
    tram_hoshi_park: [
      { routeId: 'tram_hoshi', headsign: 'あおば中央方面' },
      { routeId: 'tram_hoshi', headsign: 'ほし公園' },
    ],
    subway_sora_nishi: [
      { routeId: 'subway_sora', headsign: 'にじ橋方面' },
      { routeId: 'subway_sora', headsign: 'そらタワー方面' },
    ],
    sta_airport: [
      { routeId: 'subway_airport', headsign: 'あおば中央方面' },
      { routeId: 'subway_airport_sora', headsign: 'あおば中央方面' },
      { routeId: 'subway_hotel_shuttle', headsign: 'ホテル新月' },
    ],
    bus_hotel_mangetsu: [
      { routeId: 'subway_airport', headsign: 'あおば中央' },
      { routeId: 'subway_airport', headsign: 'つき宇宙空港' },
    ],
    bus_hotel_shingetsu: [{ routeId: 'subway_hotel_shuttle', headsign: 'つき宇宙空港' }],
  };

/** Stops where all departures are drop-off only (pickupType=1). */
const DROP_OFF_ONLY_STOPS = new Set(['bus_central_dropoff']);

/** Routes with dwell time: arrival + N minutes = departure at every stop. */
const DWELL_TIME_ROUTES = new Map<string, number>([['bus_yukkuri01', 3]]);

/**
 * Stop sequences per route+headsign.
 * Used to compute patternPosition (stopIndex, totalStops, isOrigin, isTerminal).
 * Key: `${routeId}__${headsign}`
 */
const ROUTE_STOP_SEQUENCES = new Map<string, string[]>([
  // rail_aoba: かぜの駅 ↔ はなみ駅
  ['rail_aoba__はなみ', ['sta_south', 'sta_central_s', 'sta_central', 'sta_north']],
  ['rail_aoba__かぜの', ['sta_north', 'sta_central', 'sta_central_s', 'sta_south']],
  // rail_hikari: みどり丘駅 ↔ ひかり台駅
  ['rail_hikari__あおば中央', ['sta_east', 'sta_north', 'sta_central']],
  ['rail_hikari__みどり丘', ['sta_central', 'sta_north', 'sta_east', 'sta_hill']],
  // rail_midori: ひかり台駅 ↔ つきみの駅
  ['rail_midori__ゆめの丘', ['sta_east', 'sta_hill', 'sta_northwest']],
  ['rail_midori__ひかり台', ['sta_northwest', 'sta_hill', 'sta_east']],
  // subway_sora: かぜの駅 ↔ そら西駅
  ['subway_sora__そらタワー', ['sta_south', 'sta_central_s', 'bus_tower', 'subway_sora_nishi']],
  ['subway_sora__にじ橋', ['subway_sora_nishi', 'bus_tower', 'sta_central_s', 'sta_south']],
  ['subway_sora__にじ橋方面', ['subway_sora_nishi', 'bus_tower', 'sta_central_s', 'sta_south']],
  ['subway_sora__そらタワー方面', ['sta_south', 'sta_central_s', 'bus_tower', 'subway_sora_nishi']],
  // tram_hoshi: 中央駅 ↔ ほし公園前
  ['tram_hoshi__ほし公園', ['sta_central', 'sta_east', 'tram_hoshi_park']],
  ['tram_hoshi__あおば中央方面', ['tram_hoshi_park', 'sta_east', 'sta_central']],
  // subway_airport: 中央駅 ↔ つき宇宙空港駅
  ['subway_airport__つき宇宙空港', ['sta_central', 'bus_hotel_mangetsu', 'sta_airport']],
  ['subway_airport__あおば中央方面', ['sta_airport', 'bus_hotel_mangetsu', 'sta_central']],
  ['subway_airport__あおば中央', ['sta_airport', 'bus_hotel_mangetsu', 'sta_central']],
  // subway_airport_sora: 中央駅 ↔ つき宇宙空港駅 (そら急)
  ['subway_airport_sora__つき宇宙空港', ['sta_central', 'sta_airport']],
  ['subway_airport_sora__あおば中央方面', ['sta_airport', 'sta_central']],
  ['subway_airport_sora__ホテル満月', ['sta_central', 'bus_hotel_mangetsu']],
  // subway_hotel_shuttle: つき宇宙空港駅 ↔ ホテル新月
  ['subway_hotel_shuttle__ホテル新月', ['sta_airport', 'bus_hotel_shingetsu']],
  ['subway_hotel_shuttle__つき宇宙空港', ['bus_hotel_shingetsu', 'sta_airport']],
  // bus_aoba01: 中央駅 ↔ にじ橋
  [
    'bus_aoba01__にじ橋',
    ['sta_central', 'bus_central_dropoff', 'bus_park', 'bus_library', 'bus_bridge'],
  ],
  ['bus_aoba01__あおば中央駅', ['bus_bridge', 'bus_library', 'bus_park', 'bus_central_dropoff']],
  // bus_aoba02: 中央駅 ↔ そらタワー下
  ['bus_aoba02__そらタワー', ['sta_central', 'bus_central_dropoff', 'bus_tower']],
  ['bus_aoba02__あおば中央駅', ['bus_tower', 'bus_central_dropoff']],
  // bus_midori10: みどり丘駅 → かぜの駅
  ['bus_midori10__かぜの駅', ['sta_hill', 'sta_south']],
  // bus_sora_exp01: 中央駅 → つきみの駅
  ['bus_sora_exp01__つきみの駅', ['sta_central', 'sta_west']],
  // bus_nohd01: にじ橋 → 図書館前 → もり公園前 (trip_headsign empty, stop_headsign per stop)
  ['bus_nohd01__', ['bus_bridge', 'bus_library', 'bus_park']],
  // bus_yukkuri01: もり公園前 ↔ 降車専用
  ['bus_yukkuri01__あおば中央駅', ['bus_park', 'bus_library', 'bus_bridge', 'bus_central_dropoff']],
  ['bus_yukkuri01__もり公園前', ['sta_central', 'bus_bridge', 'bus_library', 'bus_park']],
]);

/** Look up pattern position for a stop within a route+headsign sequence. */
function getPatternPosition(
  routeId: string,
  headsign: string,
  stopId: string,
): { stopIndex: number; totalStops: number; isTerminal: boolean; isOrigin: boolean } {
  const seq = ROUTE_STOP_SEQUENCES.get(`${routeId}__${headsign}`);
  if (!seq) {
    // No sequence defined — fall back to unknown position.
    return { stopIndex: 0, totalStops: 1, isTerminal: false, isOrigin: false };
  }
  const idx = seq.indexOf(stopId);
  if (idx === -1) {
    return { stopIndex: 0, totalStops: seq.length, isTerminal: false, isOrigin: false };
  }
  return {
    stopIndex: idx,
    totalStops: seq.length,
    isTerminal: idx === seq.length - 1,
    isOrigin: idx === 0,
  };
}

/**
 * Pre-computed per-stop metadata: routeTypes, agencies, and routes.
 * Built in a single pass over STOP_ROUTES to avoid redundant iteration.
 */
const { STOP_ROUTE_TYPES, STOP_AGENCIES, STOP_ROUTES_RESOLVED } = (() => {
  const routeMap = new Map(ROUTES.map((r) => [r.route_id, r]));
  const routeTypes = new Map<string, RouteType[]>();
  const agencies = new Map<string, Agency[]>();
  const routesResolved = new Map<string, Route[]>();

  for (const [stopId, entries] of Object.entries(STOP_ROUTES)) {
    const types = new Set<RouteType>();
    const agencyIds = new Set<string>();
    const uniqueRoutes = new Map<string, Route>();

    for (const { routeId } of entries) {
      const route = routeMap.get(routeId);
      if (route) {
        types.add(route.route_type);
        uniqueRoutes.set(routeId, route);
        if (route.agency_id) {
          agencyIds.add(route.agency_id);
        }
      }
    }

    if (types.size > 0) {
      routeTypes.set(
        stopId,
        [...types].sort((a, b) => a - b),
      );
    }
    const stopAgencies: Agency[] = [];
    for (const id of agencyIds) {
      const agency = AGENCY_MAP.get(id);
      if (agency) {
        stopAgencies.push(agency);
      }
    }
    agencies.set(stopId, stopAgencies);
    routesResolved.set(stopId, [...uniqueRoutes.values()]);
  }

  return {
    STOP_ROUTE_TYPES: routeTypes,
    STOP_AGENCIES: agencies,
    STOP_ROUTES_RESOLVED: routesResolved,
  };
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
    points: [coord('sta_central'), coord('bus_hotel_mangetsu'), coord('sta_airport')],
  },
  // subway_airport_sora: 中央駅 → つき宇宙空港駅 直通 (そら急 joint operation, route_type: 6 gondola)
  {
    routeId: 'subway_airport_sora',
    routeType: 6,
    color: `#${ROUTE_MAP.get('subway_airport_sora')!.route_color}`,
    route: ROUTE_MAP.get('subway_airport_sora')!,
    points: [coord('sta_central'), coord('sta_airport')],
  },
  // bus_aoba01: 中央駅 → もり公園前 → 図書館前 → にじ橋
  {
    routeId: 'bus_aoba01',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_aoba01')!.route_color}`,
    route: ROUTE_MAP.get('bus_aoba01')!,
    points: [
      coord('sta_central'),
      coord('bus_central_dropoff'),
      coord('bus_park'),
      coord('bus_library'),
      coord('bus_bridge'),
    ],
  },
  // bus_aoba02: 中央駅 → そらタワー下
  {
    routeId: 'bus_aoba02',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_aoba02')!.route_color}`,
    route: ROUTE_MAP.get('bus_aoba02')!,
    points: [coord('sta_central'), coord('bus_central_dropoff'), coord('bus_tower')],
  },
  // bus_yukkuri01: もり公園前 → 図書館前 → にじ橋 → 中央駅(降車専用)
  {
    routeId: 'bus_yukkuri01',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_yukkuri01')!.route_color}`,
    route: ROUTE_MAP.get('bus_yukkuri01')!,
    points: [
      coord('bus_park'),
      coord('bus_library'),
      coord('bus_bridge'),
      coord('bus_central_dropoff'),
    ],
  },
  // bus_sora_exp01: 中央駅 → つきみの駅 (そら急行バス)
  {
    routeId: 'bus_sora_exp01',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_sora_exp01')!.route_color}`,
    route: ROUTE_MAP.get('bus_sora_exp01')!,
    points: [coord('sta_central'), coord('sta_west')],
  },
  // subway_hotel_shuttle: つき宇宙空港駅 → ホテル新月
  {
    routeId: 'subway_hotel_shuttle',
    routeType: 1,
    color: `#${ROUTE_MAP.get('subway_hotel_shuttle')!.route_color}`,
    route: ROUTE_MAP.get('subway_hotel_shuttle')!,
    points: [coord('sta_airport'), coord('bus_hotel_shingetsu')],
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

/** Fixed departure minutes for a route+headsign, 5:00-23:45. */
function generateFixedMinutes(routeId: string, headsign: string): number[] {
  const hash = simpleHash(routeId + headsign);
  const interval = 15 + (hash % 16); // 15-30 min interval
  const startOffset = hash % interval; // stagger start
  const minutes: number[] = [];
  for (let m = 5 * 60 + startOffset; m <= 23 * 60 + 45; m += interval) {
    minutes.push(m);
  }
  return minutes;
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
    const data: StopWithMeta[] = matching.slice(0, effectiveLimit).map((m) => ({
      stop: m.stop,
      distance: m.distance,
      agencies: STOP_AGENCIES.get(m.stop.stop_id) ?? [],
      routes: STOP_ROUTES_RESOLVED.get(m.stop.stop_id) ?? [],
    }));

    return Promise.resolve({ success: true, data, truncated });
  }

  /** {@inheritDoc TransitRepository.getUpcomingTimetableEntries} */
  getUpcomingTimetableEntries(
    stopId: string,
    now: Date,
    limit = 3,
  ): Promise<UpcomingTimetableResult> {
    const stop = STOPS.find((s) => s.stop_id === stopId);
    if (!stop) {
      return Promise.resolve({ success: false, error: `No departure data for stop: ${stopId}` });
    }

    const stopRoutes = STOP_ROUTES[stopId] ?? [];
    const entries: ContextualTimetableEntry[] = [];
    let fullDayCount = 0;
    let hasBoardable = false;

    const serviceDate = getServiceDay(now);
    const nowMinutes = getServiceDayMinutes(now);

    for (const { routeId, headsign, stopHeadsign } of stopRoutes) {
      const route = ROUTES.find((r) => r.route_id === routeId);
      if (!route) {
        continue;
      }

      const allMinutes = generateFixedMinutes(routeId, headsign);
      const pickupType = DROP_OFF_ONLY_STOPS.has(stopId) ? 1 : 0;
      const dwellTime = DWELL_TIME_ROUTES.get(routeId) ?? 0;
      const position = getPatternPosition(routeId, headsign, stopId);

      // Count full-day entries and check boardability.
      fullDayCount += allMinutes.length;
      if (!hasBoardable && pickupType !== 1 && !position.isTerminal) {
        hasBoardable = true;
      }

      // Note: limit is applied per route+headsign (simplified mock behavior).
      // Production repo collects all entries then applies limit globally.
      const upcoming = allMinutes.filter((m) => m >= nowMinutes).slice(0, limit);
      for (const minutes of upcoming) {
        const arrivalMinutes = dwellTime > 0 ? minutes - dwellTime : minutes;
        entries.push({
          schedule: { departureMinutes: minutes, arrivalMinutes },
          routeDirection: {
            route,
            tripHeadsign: createMockTranslatableText(headsign),
            ...(stopHeadsign != null
              ? { stopHeadsign: createMockTranslatableText(stopHeadsign) }
              : {}),
          },
          boarding: { pickupType, dropOffType: 0 },
          patternPosition: position,
          serviceDate,
        });
      }
    }

    entries.sort((a, b) => a.schedule.departureMinutes - b.schedule.departureMinutes);

    const meta: TimetableQueryMeta = {
      isBoardableOnServiceDay: hasBoardable,
      totalEntries: fullDayCount,
    };
    return Promise.resolve({ success: true, data: entries, truncated: false, meta });
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
    const data: StopWithMeta[] = sorted.slice(0, effectiveLimit).map(({ stop, distKm }) => ({
      stop,
      distance: distKm * 1000,
      agencies: STOP_AGENCIES.get(stop.stop_id) ?? [],
      routes: STOP_ROUTES_RESOLVED.get(stop.stop_id) ?? [],
    }));

    return Promise.resolve({ success: true, data, truncated });
  }

  /** {@inheritDoc TransitRepository.getRouteShapes} */
  getRouteShapes(): Promise<CollectionResult<RouteShape>> {
    return Promise.resolve({ success: true, data: ROUTE_SHAPES, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getFullDayTimetableEntries} */
  getFullDayTimetableEntries(
    stopId: string,
    ...[
      /* dateTime */
    ]: [Date]
  ): Promise<TimetableResult> {
    const stopRoutes = STOP_ROUTES[stopId] ?? [];
    const entries: TimetableEntry[] = [];

    for (const { routeId, headsign, stopHeadsign } of stopRoutes) {
      const route = ROUTES.find((r) => r.route_id === routeId);
      if (!route) {
        continue;
      }
      const pickupType = DROP_OFF_ONLY_STOPS.has(stopId) ? 1 : 0;
      const dwellTime = DWELL_TIME_ROUTES.get(routeId) ?? 0;
      const position = getPatternPosition(routeId, headsign, stopId);
      for (const minutes of generateFixedMinutes(routeId, headsign)) {
        const arrivalMinutes = dwellTime > 0 ? minutes - dwellTime : minutes;
        entries.push({
          schedule: { departureMinutes: minutes, arrivalMinutes },
          routeDirection: {
            route,
            tripHeadsign: createMockTranslatableText(headsign),
            ...(stopHeadsign != null
              ? { stopHeadsign: createMockTranslatableText(stopHeadsign) }
              : {}),
          },
          boarding: { pickupType, dropOffType: 0 },
          patternPosition: position,
        });
      }
    }

    entries.sort((a, b) => a.schedule.departureMinutes - b.schedule.departureMinutes);
    const meta: TimetableQueryMeta = {
      isBoardableOnServiceDay: entries.some((e) => !isDropOffOnly(e)),
      totalEntries: entries.length,
    };
    return Promise.resolve({ success: true, data: entries, truncated: false, meta });
  }

  /** {@inheritDoc TransitRepository.getStopMetaById} */
  getStopMetaById(stopId: string): Promise<Result<StopWithMeta>> {
    const stop = STOPS.find((s) => s.stop_id === stopId);
    if (stop) {
      return Promise.resolve({
        success: true,
        data: {
          stop,
          agencies: STOP_AGENCIES.get(stopId) ?? [],
          routes: STOP_ROUTES_RESOLVED.get(stopId) ?? [],
        },
      });
    }
    return Promise.resolve({ success: false, error: `Stop not found: ${stopId}` });
  }

  /** {@inheritDoc TransitRepository.getStopMetaByIds} */
  getStopMetaByIds(stopIds: Set<string>): StopWithMeta[] {
    const result: StopWithMeta[] = [];
    for (const stopId of stopIds) {
      const stop = STOPS.find((s) => s.stop_id === stopId);
      if (stop) {
        result.push({
          stop,
          agencies: STOP_AGENCIES.get(stopId) ?? [],
          routes: STOP_ROUTES_RESOLVED.get(stopId) ?? [],
        });
      }
    }
    return result;
  }

  /** {@inheritDoc TransitRepository.getStopsForRoutes} */
  getStopsForRoutes(routeIds: Set<string>): Set<string> {
    const stopIds = new Set<string>();
    for (const [key, stops] of ROUTE_STOP_SEQUENCES) {
      const routeId = key.split('__')[0];
      if (routeIds.has(routeId)) {
        for (const stopId of stops) {
          stopIds.add(stopId);
        }
      }
    }
    return stopIds;
  }

  /** {@inheritDoc TransitRepository.getAllStops} */
  getAllStops(): Promise<CollectionResult<Stop>> {
    return Promise.resolve({ success: true, data: STOPS, truncated: false });
  }

  /** {@inheritDoc TransitRepository.getAgency} */
  getAgency(agencyId: string): Promise<Result<Agency>> {
    const agency = AGENCY_MAP.get(agencyId);
    if (agency) {
      return Promise.resolve({ success: true, data: agency });
    }
    return Promise.resolve({ success: false, error: `Agency not found: ${agencyId}` });
  }

  /** {@inheritDoc TransitRepository.resolveStopStats} */
  resolveStopStats(_stopId: string, _serviceDate: Date): StopWithMeta['stats'] | undefined {
    // MockRepository does not have real insights data; return undefined.
    return undefined;
  }

  /** {@inheritDoc TransitRepository.resolveRouteFreq} */
  resolveRouteFreq(routeId: string, serviceDate: Date): number | undefined {
    // Return exaggerated weekday/weekend freq difference for visual testing.
    // Weekday: high freq (thick lines), Weekend: low freq (thin lines).
    const day = serviceDate.getDay(); // 0=Sun, 6=Sat
    const isWeekend = day === 0 || day === 6;
    const route = ROUTE_MAP.get(routeId);
    if (!route || route.route_type !== 3) {
      return undefined; // Only bus routes have freq
    }
    return isWeekend ? 10 : 300;
  }

  /** {@inheritDoc TransitRepository.getAllSourceMeta} */
  getAllSourceMeta(): Promise<CollectionResult<SourceMeta>> {
    const meta: SourceMeta = {
      id: 'mock',
      name: 'あおバス',
      version: 'mock-1.0',
      validity: {
        startDate: '20260101',
        endDate: '20261231',
      },
      routeTypes: [0, 1, 2, 3, 6],
      keywords: [],
      stats: {
        stopCount: STOPS.length,
        routeCount: ROUTES.length,
      },
    };
    return Promise.resolve({ success: true, data: [meta], truncated: false });
  }
}
