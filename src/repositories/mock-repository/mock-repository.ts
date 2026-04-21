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

import type { Bounds, LatLng, RouteShape } from '../../types/app/map';
import type { Agency, Route, AppRouteTypeValue, Stop } from '../../types/app/transit';
import type {
  ContextualTimetableEntry,
  SourceMeta,
  StopWithMeta,
  TimetableEntry,
  TranslatableText,
} from '../../types/app/transit-composed';
import type {
  CollectionResult,
  Result,
  TimetableQueryMeta,
  TimetableResult,
  UpcomingTimetableResult,
} from '../../types/app/repository';
import { getTimetableEntriesState } from '../../domain/transit/timetable-utils';
import { getServiceDay, getServiceDayMinutes } from '../../domain/transit/service-day';
import {
  sortTimetableEntriesByDepartureTime,
  sortTimetableEntriesChronologically,
} from '../../domain/transit/sort-timetable-entries';
import { MAX_STOPS_RESULT } from '../transit-repository';
import type { TransitRepository } from '../transit-repository';

// --- Mock agencies ---
const AGENCY: Agency = {
  agency_id: 'mock:aoba',
  agency_name: 'あおば交通株式会社',
  agency_long_name: 'あおば交通株式会社 本社営業部',
  agency_short_name: 'あおバス',
  agency_names: {
    ja: 'あおば交通株式会社',
    'ja-Hrkt': 'あおばこうつうかぶしきがいしゃ',
    en: 'Aoba Transit Co.',
    ko: '아오바교통',
    'zh-Hans': '青叶交通株式会社',
    'zh-Hant': '青葉交通株式會社',
  },
  agency_long_names: {
    ja: 'あおば交通株式会社 本社営業部',
    'ja-Hrkt': 'あおばこうつうかぶしきがいしゃ ほんしゃえいぎょうぶ',
    en: 'Aoba Transit Co., Ltd. - Headquarters Sales Division',
    ko: '아오바교통 주식회사 본사 영업부',
    'zh-Hans': '青叶交通株式会社 总公司营业部',
    'zh-Hant': '青葉交通株式會社 總公司營業部',
  },
  agency_short_names: {
    ja: 'あおバス',
    'ja-Hrkt': 'あおばす',
    en: 'Aoba',
    ko: '아오바',
    'zh-Hans': '青叶巴士',
  },
  agency_url: 'https://example.com/aoba',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: 'https://example.com/aoba/fare',
  agency_colors: [{ bg: '2E7D32', text: 'FFFFFF' }],
};

const AGENCY_SORA: Agency = {
  agency_id: 'mock:soraq',
  agency_name: 'そら急行バス株式会社',
  agency_long_name: 'そら急行バス株式会社 高速バス事業部',
  agency_short_name: 'そら急',
  agency_names: {
    ja: 'そら急行バス株式会社',
    'ja-Hrkt': 'そらきゅうこうばすかぶしきがいしゃ',
    en: 'Sora Express Bus Co.',
    ko: '소라급행버스',
    'zh-Hans': '空急行巴士株式会社',
  },
  agency_long_names: {
    ja: 'そら急行バス株式会社 高速バス事業部',
    'ja-Hrkt': 'そらきゅうこうばすかぶしきがいしゃ こうそくばすじぎょうぶ',
    en: 'Sora Express Bus Co., Ltd. - Highway Bus Division',
    ko: '소라급행버스 주식회사 고속버스 사업부',
    'zh-Hans': '空急行巴士株式会社 高速巴士事业部',
    'zh-Hant': '空急行巴士株式會社 高速巴士事業部',
  },
  agency_short_names: {
    ja: 'そら急',
    'ja-Hrkt': 'そらきゅう',
    en: 'Sora Exp',
    ko: '소라급',
  },
  agency_url: 'https://example.com/sora',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: 'https://example.com/sora/fare',
  agency_colors: [{ bg: '1565C0', text: 'FFFFFF' }],
};

/**
 * English-primary research institute operator.
 *
 * Demonstrates an agency with `agency_lang = 'en'` and fully populated multilingual
 * fields directly in the literal (no AGENCY_*_TRANSLATIONS merge). Operates the
 * Issue #47 shape-stress / duplicate-stop-in-pattern fixture routes:
 * `bus_stuck` (consecutive duplicate), `bus_six` (6-の字), `bus_eight` (8-の字),
 * `n92` (nakano-92 終点 2 連続), `kc10a` (kyoto-city 乗降切替型), `kc10b`
 * (kyoto-city 通常停車型).
 */
const AGENCY_DRI: Agency = {
  agency_id: 'dri',
  agency_name: 'Data Research Institute',
  agency_long_name: 'Data Research Institute Foundation',
  agency_short_name: 'DRI',
  agency_names: {
    en: 'Data Research Institute',
    ja: 'データ研究所',
    'ja-Hrkt': 'でーたけんきゅうじょ',
    ko: '데이터 연구소',
    'zh-Hans': '数据研究所',
    'zh-Hant': '數據研究所',
    de: 'Forschungsinstitut für Daten',
    es: 'Instituto de Investigación de Datos',
    fr: 'Institut de Recherche sur les Données',
  },
  agency_long_names: {
    en: 'Data Research Institute Foundation',
    ja: 'データ研究所 財団',
    'ja-Hrkt': 'でーたけんきゅうじょ ざいだん',
    ko: '데이터 연구소 재단',
    'zh-Hans': '数据研究所基金会',
    'zh-Hant': '數據研究所基金會',
    de: 'Stiftung Forschungsinstitut für Daten',
    es: 'Fundación Instituto de Investigación de Datos',
    fr: 'Fondation Institut de Recherche sur les Données',
  },
  agency_short_names: {
    en: 'DRI',
    ja: 'DRI',
    'ja-Hrkt': 'DRI',
    ko: 'DRI',
    'zh-Hans': 'DRI',
    'zh-Hant': 'DRI',
    de: 'DRI',
    es: 'DRI',
    fr: 'DRI',
  },
  agency_url: 'https://example.com/dri',
  agency_lang: 'en',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: '6A1B9A', text: 'FFFFFF' }],
};

/**
 * Fictional operator used to stress-test low-contrast `route_color`
 * values. Routes under this agency are deliberately given colors that
 * coincide with the theme background (white, black, pale yellow, etc.)
 * so the `useIsLowContrastAgainstTheme` hook and the TripPositionIndicator
 * track outline can be verified visually.
 */
const AGENCY_COLORFUL: Agency = {
  agency_id: 'mock:colorful',
  agency_name: 'カラフルルート',
  agency_long_name: 'カラフルルート交通株式会社',
  agency_short_name: 'カラフル',
  agency_names: {
    ja: 'カラフルルート',
    'ja-Hrkt': 'からふるるーと',
    en: 'Colorful Route',
  },
  agency_long_names: {
    ja: 'カラフルルート交通株式会社',
    'ja-Hrkt': 'からふるるーとこうつうかぶしきがいしゃ',
    en: 'Colorful Route Transportation Co., Ltd.',
  },
  agency_short_names: {
    ja: 'カラフル',
    'ja-Hrkt': 'からふる',
    en: 'Colorful',
  },
  agency_url: 'https://example.com/colorful',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: '888888', text: 'FFFFFF' }],
};

const AGENCY_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  'mock:aoba': {
    'zh-Hant': '青葉交通株式會社',
    de: 'Aoba Verkehr AG',
    es: 'Aoba Transportes S.A.',
    fr: 'Aoba Transport S.A.',
  },
  'mock:soraq': {
    ko: '소라급행버스',
    'zh-Hans': '空急行巴士株式会社',
    'zh-Hant': '空急行巴士株式會社',
    de: 'Sora Schnellbus AG',
    es: 'Sora Autobús Expreso S.A.',
    fr: 'Sora Autocar Express S.A.',
  },
};

const AGENCY_LONG_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  'mock:aoba': {
    de: 'Aoba Verkehr AG - Hauptbüro Vertrieb',
    es: 'Aoba Transportes S.A. - División Comercial de Oficina Central',
    fr: 'Aoba Transport S.A. - Division commerciale du siège',
  },
  'mock:soraq': {
    de: 'Sora Schnellbus AG - Geschäftsbereich Fernbus',
    es: 'Sora Autobús Expreso S.A. - División de Autobuses de Larga Distancia',
    fr: 'Sora Autocar Express S.A. - Division des autocars longue distance',
  },
};

const AGENCY_SHORT_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  'mock:aoba': {
    'zh-Hant': '青葉巴士',
    de: 'Aoba',
    es: 'Aoba',
    fr: 'Aoba',
  },
  'mock:soraq': {
    ko: '소라급',
    'zh-Hans': '空急',
    'zh-Hant': '空急',
    de: 'Sora Exp',
    es: 'Sora Exp',
    fr: 'Sora Exp',
  },
};

// All agencies — including AGENCY_DRI, whose translations are fully inlined
// into its literal — are folded through the same merge step so the
// `AGENCY_*_TRANSLATIONS` maps remain the single place to add new
// translations. For AGENCY_DRI the map lookups are currently `undefined`
// and the `?? {}` fallback makes every Object.assign a no-op. Keeping DRI
// in the loop means a future `AGENCY_LONG_NAME_TRANSLATIONS['dri']` entry
// will be picked up automatically instead of silently missing the merge.
for (const agency of [AGENCY, AGENCY_SORA, AGENCY_DRI, AGENCY_COLORFUL]) {
  Object.assign(agency.agency_names, AGENCY_NAME_TRANSLATIONS[agency.agency_id] ?? {});
  Object.assign(agency.agency_long_names, AGENCY_LONG_NAME_TRANSLATIONS[agency.agency_id] ?? {});
  Object.assign(agency.agency_short_names, AGENCY_SHORT_NAME_TRANSLATIONS[agency.agency_id] ?? {});
}

const AGENCY_MAP = new Map<string, Agency>(
  [AGENCY, AGENCY_SORA, AGENCY_DRI, AGENCY_COLORFUL].map((a) => [a.agency_id, a]),
);

const STOP_NAME_TRANSLATIONS: Record<string, Record<string, string>> = {
  sta_central: {
    ko: '아오바중앙역',
    'zh-Hans': '青叶中央站',
    'zh-Hant': '青葉中央站',
    de: 'Aoba-Chūō Bahnhof',
    es: 'Estación Aoba-Chūō',
    fr: "Gare d'Aoba-Chūō",
  },
  sta_central_s: {
    ko: '아오바중앙역 남쪽 출구',
    'zh-Hans': '青叶中央站南口',
    'zh-Hant': '青葉中央站南口',
    de: 'Aoba-Chūō Bahnhof Südausgang',
    es: 'Estación Aoba-Chūō salida sur',
    fr: "Gare d'Aoba-Chūō sortie sud",
  },
  sta_hill: {
    ko: '미도리오카역',
    'zh-Hans': '绿丘站',
    'zh-Hant': '綠丘站',
    de: 'Midori-oka Bahnhof',
    es: 'Estación Midori-oka',
    fr: 'Gare de Midori-oka',
  },
  sta_east: {
    ko: '히카리다이역',
    'zh-Hans': '光台站',
    'zh-Hant': '光台站',
    de: 'Hikari-dai Bahnhof',
    es: 'Estación Hikari-dai',
    fr: 'Gare de Hikari-dai',
  },
  sta_north: {
    ko: '하나미역',
    'zh-Hans': '花见站',
    'zh-Hant': '花見站',
    de: 'Hanami Bahnhof',
    es: 'Estación Hanami',
    fr: 'Gare de Hanami',
  },
  sta_west: {
    ko: '쓰키미노역',
    'zh-Hans': '月见野站',
    'zh-Hant': '月見野站',
    de: 'Tsukimino Bahnhof',
    es: 'Estación Tsukimino',
    fr: 'Gare de Tsukimino',
  },
  sta_south: {
    ko: '가제노역',
    'zh-Hans': '风野站',
    'zh-Hant': '風野站',
    de: 'Kazeno Bahnhof',
    es: 'Estación Kazeno',
    fr: 'Gare de Kazeno',
  },
  sta_northwest: {
    ko: '유메노오카역',
    'zh-Hans': '梦之丘站',
    'zh-Hant': '夢之丘站',
    de: 'Yumeno-oka Bahnhof',
    es: 'Estación Yumeno-oka',
    fr: 'Gare de Yumeno-oka',
  },
  bus_central_dropoff: {
    ko: '아오바중앙역(하차 전용)',
    'zh-Hans': '青叶中央站(仅下车)',
    'zh-Hant': '青葉中央站(僅下車)',
    de: 'Aoba-Chūō Bahnhof (nur Ausstieg)',
    es: 'Estación Aoba-Chūō (solo descenso)',
    fr: "Gare d'Aoba-Chūō (descente uniquement)",
  },
  bus_central_closed: {
    ko: '아오바중앙역 북쪽 출구(휴지중)',
    'zh-Hans': '青叶中央站北口(停用中)',
    'zh-Hant': '青葉中央站北口(停用中)',
    de: 'Aoba-Chūō Bahnhof Nordausgang (geschlossen)',
    es: 'Estación Aoba-Chūō salida norte (cerrada)',
    fr: "Gare d'Aoba-Chūō sortie nord (fermée)",
  },
  bus_park: {
    ko: '모리공원 앞',
    'zh-Hans': '森公园前',
    'zh-Hant': '森公園前',
    de: 'Mori-Park',
    es: 'Parque Mori',
    fr: 'Parc Mori',
  },
  bus_library: {
    ko: '아오바도서관 앞',
    'zh-Hans': '青叶图书馆前',
    'zh-Hant': '青葉圖書館前',
    de: 'Aoba-Bibliothek',
    es: 'Biblioteca Aoba',
    fr: 'Bibliothèque Aoba',
  },
  bus_tower: {
    ko: '소라타워 아래',
    'zh-Hans': '空塔下',
    'zh-Hant': '空塔下',
    de: 'Unter dem Sora-Turm',
    es: 'Bajo la Torre Sora',
    fr: 'Sous la Tour Sora',
  },
  bus_bridge: {
    ko: '니지다리',
    'zh-Hans': '彩虹桥',
    'zh-Hant': '彩虹橋',
    de: 'Niji-Brücke',
    es: 'Puente Niji',
    fr: 'Pont Niji',
  },
  tram_hoshi_park: {
    ko: '호시공원 앞',
    'zh-Hans': '星公园前',
    'zh-Hant': '星公園前',
    de: 'Hoshi-Park',
    es: 'Parque Hoshi',
    fr: 'Parc Hoshi',
  },
  subway_sora_nishi: {
    ko: '소라니시역',
    'zh-Hans': '空西站',
    'zh-Hant': '空西站',
    de: 'Sora-nishi Bahnhof',
    es: 'Estación Sora-nishi',
    fr: 'Gare de Sora-nishi',
  },
  bus_hotel_mangetsu: {
    ko: '호텔 만게쓰',
    'zh-Hans': '满月酒店',
    'zh-Hant': '滿月酒店',
    de: 'Hotel Mangetsu',
    es: 'Hotel Mangetsu',
    fr: 'Hôtel Mangetsu',
  },
  bus_hotel_shingetsu: {
    ko: '호텔 신게쓰',
    'zh-Hans': '新月酒店',
    'zh-Hant': '新月酒店',
    de: 'Hotel Shingetsu',
    es: 'Hotel Shingetsu',
    fr: 'Hôtel Shingetsu',
  },
  sta_airport: {
    ko: '츠키 우주공항역',
    'zh-Hans': '月宇宙机场站',
    'zh-Hant': '月宇宙機場站',
    de: 'Tsuki-Raumhafen Bahnhof',
    es: 'Estación Puerto Espacial Tsuki',
    fr: 'Gare du Spatioport Tsuki',
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
  {
    stop_id: 'bus_central_closed',
    stop_name: 'あおば中央駅北口(休止中)',
    stop_names: {
      ja: 'あおば中央駅北口(休止中)',
      'ja-Hrkt': 'あおばちゅうおうえききたぐち(きゅうしちゅう)',
      en: 'Aoba-Chuo Sta. North Exit (Closed)',
    },
    stop_lat: 35.7494,
    stop_lon: 139.7709,
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
  // ---------------------------------------------------------------------
  // Issue #47 fixtures: 同一 stop が pattern 内で複数回出現するトポロジー
  //
  // 各路線は専用 stop だけで構成し、他路線とは接続しない (隔離された fixture)。
  // stop_id / stop_name は `r{route}-{n}` 形式で、確認時に視覚的に追跡しやすい。
  // 配置: sta_central_s (35.7471, 139.7703) の右下 (南東、空きスペース) に
  // クラスタとして配置。3 路線が縦に並ぶように lat を段階的に下げる。
  //
  // 進まない路線 (rs): [rs-1, rs-1, rs-2]              — rs-1 が連続 2 回 (dwell)
  // 6 の字路線 (r6): [r6-1, r6-2, r6-1, r6-3]          — r6-1 が index 0, 2
  // 8 の字路線 (r8): [r8-1, r8-2, r8-1, r8-3, r8-1]    — r8-1 が index 0, 2, 4
  // ---------------------------------------------------------------------
  // 進まない路線 (rs) — クラスタ最下段。
  // [rs-1, rs-1, rs-2, rs-3] で rs-1 が連続 2 回 (dwell)、rs-3 が terminal。
  // rs-1 → rs-2 → rs-3 はそれぞれ東へ 200m ずつ離れた直線配置。
  {
    stop_id: 'rs-1',
    stop_name: 'rs-1',
    stop_names: { ja: 'rs-1', en: 'rs-1' },
    stop_lat: 35.7443,
    stop_lon: 139.772,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'rs-2',
    stop_name: 'rs-2',
    stop_names: { ja: 'rs-2', en: 'rs-2' },
    stop_lat: 35.7443,
    stop_lon: 139.7742,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'rs-3',
    stop_name: 'rs-3',
    stop_names: { ja: 'rs-3', en: 'rs-3' },
    stop_lat: 35.7443,
    stop_lon: 139.7764,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  // 6 の字路線 (r6) — クラスタ中段 (元の位置から北へ約 100m 移動済)。
  // 電卓 7-segment のように 6 点で「6」を描く。
  //   r6-1          ← spine top
  //   |
  //   r6-2          ← spine middle
  //   |
  //   r6-3 — r6-4   ← loop top (r6-3 = closing point, visited twice)
  //   |       |
  //   r6-5 — r6-6   ← loop bottom
  // pattern: [r6-1, r6-2, r6-3, r6-5, r6-6, r6-4, r6-3]
  // r6-1 → r6-2 → r6-3 (ループ入口) → r6-5 → r6-6 → r6-4 → r6-3 (ループを閉じる)
  {
    stop_id: 'r6-1',
    stop_name: 'r6-1',
    stop_names: { ja: 'r6-1', en: 'r6-1' },
    stop_lat: 35.7475,
    stop_lon: 139.772,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'r6-2',
    stop_name: 'r6-2',
    stop_names: { ja: 'r6-2', en: 'r6-2' },
    stop_lat: 35.7472,
    stop_lon: 139.772,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'r6-3',
    stop_name: 'r6-3',
    stop_names: { ja: 'r6-3', en: 'r6-3' },
    stop_lat: 35.7469,
    stop_lon: 139.772,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'r6-4',
    stop_name: 'r6-4',
    stop_names: { ja: 'r6-4', en: 'r6-4' },
    stop_lat: 35.7469,
    stop_lon: 139.7724,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'r6-5',
    stop_name: 'r6-5',
    stop_names: { ja: 'r6-5', en: 'r6-5' },
    stop_lat: 35.7466,
    stop_lon: 139.772,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'r6-6',
    stop_name: 'r6-6',
    stop_names: { ja: 'r6-6', en: 'r6-6' },
    stop_lat: 35.7466,
    stop_lon: 139.7724,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  // 8 の字路線 (r8) — 元の位置から北東へ約 300m 移動済 (砂時計の交点は r8-3)。
  // 5 stops で 7 visits: r8-3 → r8-4 → r8-5 → r8-3 → r8-1 → r8-2 → r8-3
  //
  //   r8-4 — r8-5   ← upper lobe
  //      \  /
  //      r8-3       ← cross point (origin / mid / terminal)
  //      /  \
  //   r8-1 — r8-2   ← lower lobe
  {
    stop_id: 'r8-1',
    stop_name: 'r8-1',
    stop_names: { ja: 'r8-1', en: 'r8-1' },
    stop_lat: 35.7462,
    stop_lon: 139.7742,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'r8-2',
    stop_name: 'r8-2',
    stop_names: { ja: 'r8-2', en: 'r8-2' },
    stop_lat: 35.7462,
    stop_lon: 139.7754,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'r8-3',
    stop_name: 'r8-3',
    stop_names: { ja: 'r8-3', en: 'r8-3' },
    stop_lat: 35.7467,
    stop_lon: 139.7748,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'r8-4',
    stop_name: 'r8-4',
    stop_names: { ja: 'r8-4', en: 'r8-4' },
    stop_lat: 35.7472,
    stop_lon: 139.7742,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'r8-5',
    stop_name: 'r8-5',
    stop_names: { ja: 'r8-5', en: 'r8-5' },
    stop_lat: 35.7472,
    stop_lon: 139.7754,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  // ---------------------------------------------------------------------
  // n92 — 中92 (kobus:240) 練馬駅終点ケースの再現 fixture。
  // Issue #47 の参考事例: 終着 stop が同一 trip 末尾に 2 連続出現し、
  // 始発側は同名だが別 stop_id (数十 m 差) として存在する。
  //
  //   trip A: n92-1 → n92-2 → n92-3 → n92-3 (n92-3 は連続 dwell、両方 降車専用)
  //   trip B: n92-4 → n92-2 → n92-1
  //   trip C: n92-1 → n92-5 (回送便、中92 の p213 `中野駅 → 中野車庫` に相当)
  //
  // n92-3 と n92-4 は別 stop_id だが同じ display name 'nrm(t)' / 'nrm' で
  // (d) (= drop-off) で区別。練馬駅の 1079_00 と 1079_02 を模した構造。
  // n92-1 は反対側の終端 'nkn' (中野)。n92-5 は中野車庫 'nkg'。
  //
  // 配置 (1-2-3 を東西 200m 間隔で水平、4 は 3 の南 50m、5 は 1 の南 100m):
  //   nkn ─── n92-2 ─── nrm(t) (n92-3)
  //    │                  │
  //   nkg (n92-5)        nrm (n92-4)
  //
  // si 修正前: trip A の 2 連続 n92-3 が同一 entry にマージされ、両方 [4/4] TERM 表示
  // si 修正後: si=2 (中間, 降車専用) と si=3 ([4/4] TERM, 降車専用) に分離
  // ---------------------------------------------------------------------
  {
    stop_id: 'n92-1',
    stop_name: 'nkn',
    stop_names: { ja: 'nkn', en: 'nkn' },
    stop_lat: 35.74295,
    stop_lon: 139.772,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'n92-4',
    stop_name: 'nrm',
    stop_names: { ja: 'nrm', en: 'nrm' },
    stop_lat: 35.7425,
    stop_lon: 139.7764,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'n92-2',
    stop_name: 'n92-2',
    stop_names: { ja: 'n92-2', en: 'n92-2' },
    stop_lat: 35.74295,
    stop_lon: 139.7742,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'n92-3',
    stop_name: 'nrm(t)',
    stop_names: { ja: 'nrm(t)', en: 'nrm(t)' },
    stop_lat: 35.74295,
    stop_lon: 139.7764,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'n92-5',
    stop_name: 'nkg',
    stop_names: { ja: 'nkg', en: 'nkg' },
    stop_lat: 35.74205,
    stop_lon: 139.772,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  // ---------------------------------------------------------------------
  // kc10a / kc10b — 市バス10 (kcbus:01000) 三条京阪前 連続重複ケース再現。
  // Issue #47 の参考事例: 実データでは α (p43) と β (p44) は同名 stop だが
  // 別 stop_id を使う。mock では 2 路線 + 6 stop に分割して可視化。
  //
  //   route kc10a (乗降切替型, p43 模倣):
  //     [kc10a-1, kc10a-2, kc10a-2, kc10a-3]
  //     kc10a-2 si=1: pickup=1, dropoff=0 (降車のみ)
  //     kc10a-2 si=2: pickup=0, dropoff=1 (乗車のみ)
  //   route kc10b (通常停車型, p44 模倣):
  //     [kc10b-1, kc10b-2, kc10b-2, kc10b-3]
  //     kc10b-2 両 occ とも pickup=0, dropoff=0
  //
  // 配置: kc10a を東西 200m 間隔で水平 (kc10a-1 は nkg の南 200m)。
  //       kc10b は kc10a の南 100m に並行配置。
  // ---------------------------------------------------------------------
  {
    stop_id: 'kc10a-1',
    stop_name: 'kc10a-1',
    stop_names: { ja: 'kc10a-1', en: 'kc10a-1' },
    stop_lat: 35.7407,
    stop_lon: 139.772,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'kc10a-2',
    stop_name: 'kc10a-2',
    stop_names: { ja: 'kc10a-2', en: 'kc10a-2' },
    stop_lat: 35.7407,
    stop_lon: 139.7742,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'kc10a-3',
    stop_name: 'kc10a-3',
    stop_names: { ja: 'kc10a-3', en: 'kc10a-3' },
    stop_lat: 35.7407,
    stop_lon: 139.7764,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'kc10b-1',
    stop_name: 'kc10b-1',
    stop_names: { ja: 'kc10b-1', en: 'kc10b-1' },
    stop_lat: 35.7398,
    stop_lon: 139.772,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'kc10b-2',
    stop_name: 'kc10b-2',
    stop_names: { ja: 'kc10b-2', en: 'kc10b-2' },
    stop_lat: 35.7398,
    stop_lon: 139.7742,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  {
    stop_id: 'kc10b-3',
    stop_name: 'kc10b-3',
    stop_names: { ja: 'kc10b-3', en: 'kc10b-3' },
    stop_lat: 35.7398,
    stop_lon: 139.7764,
    location_type: 0,
    agency_id: 'mock:aoba',
  },
  // --- Colorful Route: three stops arranged as a 200m equilateral
  // triangle, placed ~2km SW of sta_south. Used for visual verification
  // of low-contrast route_color handling in the TripPositionIndicator
  // and JourneyTimeBar.
  {
    stop_id: 'stop_red',
    stop_name: 'Red',
    stop_names: { ja: 'レッド', en: 'Red' },
    stop_lat: 35.73,
    stop_lon: 139.749,
    location_type: 0,
    agency_id: 'mock:colorful',
  },
  {
    stop_id: 'stop_green',
    stop_name: 'Green',
    stop_names: { ja: 'グリーン', en: 'Green' },
    stop_lat: 35.73,
    stop_lon: 139.7512,
    location_type: 0,
    agency_id: 'mock:colorful',
  },
  {
    stop_id: 'stop_blue',
    stop_name: 'Blue',
    stop_names: { ja: 'ブルー', en: 'Blue' },
    stop_lat: 35.7316,
    stop_lon: 139.7501,
    location_type: 0,
    agency_id: 'mock:colorful',
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
  // ---------------------------------------------------------------------
  // Issue #47 fixtures: duplicate stop_id within pattern test routes
  // ---------------------------------------------------------------------
  // bus_stuck: 進まない路線 (consecutive duplicate)
  //   stops: [dup_a, dup_a, dup_b]  — dup_a が連続 2 回
  {
    route_id: 'bus_stuck',
    route_short_name: 'ぐず',
    route_short_names: {},
    route_long_name: '進まない路線',
    route_long_names: {},
    route_type: 3,
    route_color: '795548',
    route_text_color: 'FFFFFF',
    agency_id: 'dri',
  },
  // bus_six: 6 の字路線 (same stop visited 2 times non-consecutively)
  //   stops: [dup_a, dup_b, dup_a, dup_c]  — dup_a が index 0 と 2
  {
    route_id: 'bus_six',
    route_short_name: '六',
    route_short_names: {},
    route_long_name: '6の字路線',
    route_long_names: {},
    route_type: 3,
    route_color: 'C2185B',
    route_text_color: 'FFFFFF',
    agency_id: 'dri',
  },
  // bus_eight: 8 の字路線 (same stop visited 3 times)
  //   stops: [dup_a, dup_b, dup_a, dup_c, dup_a]  — dup_a が index 0, 2, 4
  {
    route_id: 'bus_eight',
    route_short_name: '八',
    route_short_names: {},
    route_long_name: '8の字路線',
    route_long_names: {},
    route_type: 3,
    route_color: '00838F',
    route_text_color: 'FFFFFF',
    agency_id: 'dri',
  },
  // n92: 中92 (kobus:240) 練馬駅終点ケース再現 (Issue #47 参考事例)。
  //   trip A: n92-1 (nkn) → n92-2 → n92-3 (nrm) → n92-3 [headsign: n92-3] (終点 2 連続、両方降車専用)
  //   trip B: n92-4 (nrm) → n92-2 → n92-1 (nkn)         [headsign: n92-1]
  // n92-3 と n92-4 は別 stop_id だが同じ display name 'nrm' (練馬) を共有。
  {
    route_id: 'n92',
    route_short_name: '92',
    route_short_names: {},
    route_long_name: 'なか92系統',
    route_long_names: {},
    route_type: 3,
    route_color: '6A1B9A',
    route_text_color: 'FFFFFF',
    agency_id: 'dri',
  },
  // kc10a: 市バス10 (kcbus:01000) 三条京阪前 乗降切替型 (p43 模倣) [Issue #47]
  //   pattern: [kc10a-1, kc10a-2, kc10a-2, kc10a-3]
  //   kc10a-2 si=1: pickup=1/dropoff=0 (降車のみ)
  //   kc10a-2 si=2: pickup=0/dropoff=1 (乗車のみ)
  {
    route_id: 'kc10a',
    route_short_name: '10a',
    route_short_names: {},
    route_long_name: '市バス10号系統 (乗降切替型)',
    route_long_names: {},
    route_type: 3,
    route_color: '00838F',
    route_text_color: 'FFFFFF',
    agency_id: 'dri',
  },
  // kc10b: 市バス10 (kcbus:01000) 三条京阪前 通常停車型 (p44 模倣) [Issue #47]
  //   pattern: [kc10b-1, kc10b-2, kc10b-2, kc10b-3]
  //   kc10b-2 両 occ とも通常停車 (0/0)
  {
    route_id: 'kc10b',
    route_short_name: '10b',
    route_short_names: {},
    route_long_name: '市バス10号系統 (通常停車型)',
    route_long_names: {},
    route_type: 3,
    route_color: '0097A7',
    route_text_color: 'FFFFFF',
    agency_id: 'dri',
  },
  // --- Colorful Route: low-contrast route_color fixtures. --------------
  // 15 routes across three directions around the red/green/blue stops,
  // each with a deliberately low-contrast route_color. The two
  // mandatory cases (#FFFFFF and #000000) sit in the red→green and
  // green→blue groups respectively; the remaining 13 cover real-world
  // problem palettes observed in production GTFS data.
  //
  // red → green: colors that fade into light-theme background.
  {
    route_id: 'clr_rg_white',
    route_short_name: 'W',
    route_short_names: {},
    route_long_name: 'White',
    route_long_names: {},
    route_type: 3,
    route_color: 'FFFFFF',
    route_text_color: '000000',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_rg_pale_yellow',
    route_short_name: 'PY',
    route_short_names: {},
    route_long_name: 'Pale Yellow (iyt2)',
    route_long_names: {},
    route_type: 3,
    route_color: 'FBD074',
    route_text_color: '0A0A0A',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_rg_pale_gold',
    route_short_name: 'PG',
    route_short_names: {},
    route_long_name: 'Pale Gold (minkuru 北47)',
    route_long_names: {},
    route_type: 3,
    route_color: 'FFDB82',
    route_text_color: '260A00',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_rg_bright_yellow',
    route_short_name: 'BY',
    route_short_names: {},
    route_long_name: 'Bright Yellow',
    route_long_names: {},
    route_type: 3,
    route_color: 'FFFF00',
    route_text_color: '000000',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_rg_light_cyan',
    route_short_name: 'LC',
    route_short_names: {},
    route_long_name: 'Light Cyan (kseiw 塩浜03)',
    route_long_names: {},
    route_type: 3,
    route_color: '80FFFF',
    route_text_color: '000000',
    agency_id: 'mock:colorful',
  },
  // green → blue: colors that fade into dark-theme background.
  {
    route_id: 'clr_gb_black',
    route_short_name: 'K',
    route_short_names: {},
    route_long_name: 'Black',
    route_long_names: {},
    route_type: 3,
    route_color: '000000',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_gb_near_black',
    route_short_name: 'NK',
    route_short_names: {},
    route_long_name: 'Near Black',
    route_long_names: {},
    route_type: 3,
    route_color: '0A1428',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_gb_gray_900',
    route_short_name: 'G9',
    route_short_names: {},
    route_long_name: 'Gray 900 (dark bg)',
    route_long_names: {},
    route_type: 3,
    route_color: '111827',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_gb_gray_800',
    route_short_name: 'G8',
    route_short_names: {},
    route_long_name: 'Gray 800',
    route_long_names: {},
    route_type: 3,
    route_color: '1F2937',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_gb_dark_gray',
    route_short_name: 'DG',
    route_short_names: {},
    route_long_name: 'Dark Gray',
    route_long_names: {},
    route_type: 3,
    route_color: '2C2C2C',
    route_text_color: 'FFFFFF',
    agency_id: 'mock:colorful',
  },
  // blue → red: other low-contrast palettes observed in production data.
  {
    route_id: 'clr_br_light_yellow',
    route_short_name: 'LY',
    route_short_names: {},
    route_long_name: 'Light Yellow (kseiw 浦安01)',
    route_long_names: {},
    route_type: 3,
    route_color: 'FFFF80',
    route_text_color: '000000',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_br_light_green',
    route_short_name: 'LG',
    route_short_names: {},
    route_long_name: 'Light Green (kseiw 行徳03)',
    route_long_names: {},
    route_type: 3,
    route_color: '80FF80',
    route_text_color: '000000',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_br_bright_green',
    route_short_name: 'BG',
    route_short_names: {},
    route_long_name: 'Bright Green (ktbus 百01)',
    route_long_names: {},
    route_type: 3,
    route_color: '4DFB41',
    route_text_color: '000000',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_br_gold',
    route_short_name: 'GD',
    route_short_names: {},
    route_long_name: 'Gold (sbbus 吉66)',
    route_long_names: {},
    route_type: 3,
    route_color: 'FDD000',
    route_text_color: '000000',
    agency_id: 'mock:colorful',
  },
  {
    route_id: 'clr_br_light_gray',
    route_short_name: 'LX',
    route_short_names: {},
    route_long_name: 'Light Gray',
    route_long_names: {},
    route_type: 3,
    route_color: 'E0E0E0',
    route_text_color: '000000',
    agency_id: 'mock:colorful',
  },
];

for (const route of ROUTES) {
  route.route_long_names = ROUTE_NAME_TRANSLATIONS[route.route_id] ?? route.route_long_names;
}

const HEADSIGN_TRANSLATIONS: Record<string, Record<string, string>> = {
  はなみ: {
    'ja-Hrkt': 'はなみ',
    en: 'Hanami',
    ko: '하나미',
    'zh-Hans': '花见',
    'zh-Hant': '花見',
    de: 'Hanami',
    es: 'Hanami',
    fr: 'Hanami',
  },
  かぜの: {
    'ja-Hrkt': 'かぜの',
    en: 'Kazeno',
    ko: '가제노',
    'zh-Hans': '风野',
    'zh-Hant': '風野',
    de: 'Kazeno',
    es: 'Kazeno',
    fr: 'Kazeno',
  },
  そらタワー: {
    'ja-Hrkt': 'そらたわー',
    en: 'Sora Tower',
    ko: '소라타워',
    'zh-Hans': '空塔',
    'zh-Hant': '空塔',
    de: 'Sora-Turm',
    es: 'Torre Sora',
    fr: 'Tour Sora',
  },
  にじ橋: {
    'ja-Hrkt': 'にじばし',
    en: 'Niji Bridge',
    ko: '니지다리',
    'zh-Hans': '彩虹桥',
    'zh-Hant': '彩虹橋',
    de: 'Niji-Brücke',
    es: 'Puente Niji',
    fr: 'Pont Niji',
  },
  つき宇宙空港: {
    'ja-Hrkt': 'つきうちゅうくうこう',
    en: 'Tsuki Spaceport',
    ko: '츠키 우주공항',
    'zh-Hans': '月宇宙机场',
    'zh-Hant': '月宇宙機場',
    de: 'Tsuki-Raumhafen',
    es: 'Puerto Espacial Tsuki',
    fr: 'Spatioport Tsuki',
  },
  ホテル満月: {
    'ja-Hrkt': 'ほてるまんげつ',
    en: 'Hotel Mangetsu',
    ko: '호텔 만게쓰',
    'zh-Hans': '满月酒店',
    'zh-Hant': '滿月酒店',
    de: 'Hotel Mangetsu',
    es: 'Hotel Mangetsu',
    fr: 'Hôtel Mangetsu',
  },
  ほし公園: {
    'ja-Hrkt': 'ほしこうえん',
    en: 'Hoshi Park',
    ko: '호시공원',
    'zh-Hans': '星公园',
    'zh-Hant': '星公園',
    de: 'Hoshi-Park',
    es: 'Parque Hoshi',
    fr: 'Parc Hoshi',
  },
  つきみの駅: {
    'ja-Hrkt': 'つきみのえき',
    en: 'Tsukimino Sta.',
    ko: '쓰키미노역',
    'zh-Hans': '月见野站',
    'zh-Hant': '月見野站',
    de: 'Bahnhof Tsukimino',
    es: 'Estación Tsukimino',
    fr: 'Gare de Tsukimino',
  },
  もり公園前: {
    'ja-Hrkt': 'もりこうえんまえ',
    en: 'Mori Park',
    ko: '모리공원 앞',
    'zh-Hans': '森公园前',
    'zh-Hant': '森公園前',
    de: 'Mori-Park',
    es: 'Parque Mori',
    fr: 'Parc Mori',
  },
  ゆめの丘: {
    'ja-Hrkt': 'ゆめのおか',
    en: 'Yumeno-oka',
    ko: '유메노오카',
    'zh-Hans': '梦之丘',
    'zh-Hant': '夢之丘',
    de: 'Yumeno-oka',
    es: 'Yumeno-oka',
    fr: 'Yumeno-oka',
  },
  ひかり台: {
    'ja-Hrkt': 'ひかりだい',
    en: 'Hikari-dai',
    ko: '히카리다이',
    'zh-Hans': '光台',
    'zh-Hant': '光台',
    de: 'Hikari-dai',
    es: 'Hikari-dai',
    fr: 'Hikari-dai',
  },
  かぜの駅: {
    'ja-Hrkt': 'かぜのえき',
    en: 'Kazeno Sta.',
    ko: '가제노역',
    'zh-Hans': '风野站',
    'zh-Hant': '風野站',
    de: 'Bahnhof Kazeno',
    es: 'Estación Kazeno',
    fr: 'Gare de Kazeno',
  },
  あおば中央: {
    'ja-Hrkt': 'あおばちゅうおう',
    en: 'Aoba-Chuo',
    ko: '아오바중앙',
    'zh-Hans': '青叶中央',
    'zh-Hant': '青葉中央',
    de: 'Aoba-Chūō',
    es: 'Aoba-Chūō',
    fr: 'Aoba-Chūō',
  },
  あおば中央駅: {
    'ja-Hrkt': 'あおばちゅうおうえき',
    en: 'Aoba-Chuo Sta.',
    ko: '아오바중앙역',
    'zh-Hans': '青叶中央站',
    'zh-Hant': '青葉中央站',
    de: 'Aoba-Chūō Bahnhof',
    es: 'Estación Aoba-Chūō',
    fr: "Gare d'Aoba-Chūō",
  },
  'もり公園前・にじ橋': {
    'ja-Hrkt': 'もりこうえんまえ・にじばし',
    en: 'Mori Park / Niji Bridge',
    ko: '모리공원 앞 / 니지다리',
    'zh-Hans': '森公园前 / 彩虹桥',
    'zh-Hant': '森公園前 / 彩虹橋',
    de: 'Mori-Park / Niji-Brücke',
    es: 'Parque Mori / Puente Niji',
    fr: 'Parc Mori / Pont Niji',
  },
  '図書館前・もり公園前': {
    'ja-Hrkt': 'としょかんまえ・もりこうえんまえ',
    en: 'Library / Mori Park',
    ko: '도서관 앞 / 모리공원 앞',
    'zh-Hans': '图书馆前 / 森公园前',
    'zh-Hant': '圖書館前 / 森公園前',
    de: 'Bibliothek / Mori-Park',
    es: 'Biblioteca / Parque Mori',
    fr: 'Bibliothèque / Parc Mori',
  },
  あおば中央方面: {
    'ja-Hrkt': 'あおばちゅうおうほうめん',
    en: 'For Aoba-Chuo',
    ko: '아오바중앙 방면',
    'zh-Hans': '往青叶中央',
    'zh-Hant': '往青葉中央',
    de: 'Richtung Aoba-Chūō',
    es: 'Hacia Aoba-Chūō',
    fr: 'Direction Aoba-Chūō',
  },
  にじ橋方面: {
    'ja-Hrkt': 'にじばしほうめん',
    en: 'For Niji Bridge',
    ko: '니지다리 방면',
    'zh-Hans': '往彩虹桥',
    'zh-Hant': '往彩虹橋',
    de: 'Richtung Niji-Brücke',
    es: 'Hacia el Puente Niji',
    fr: 'Direction Pont Niji',
  },
  そらタワー方面: {
    'ja-Hrkt': 'そらたわーほうめん',
    en: 'For Sora Tower',
    ko: '소라타워 방면',
    'zh-Hans': '往空塔',
    'zh-Hant': '往空塔',
    de: 'Richtung Sora-Turm',
    es: 'Hacia la Torre Sora',
    fr: 'Direction Tour Sora',
  },
  ホテル新月: {
    'ja-Hrkt': 'ほてるしんげつ',
    en: 'Hotel Shingetsu',
    ko: '호텔 신게쓰',
    'zh-Hans': '新月酒店',
    'zh-Hant': '新月酒店',
    de: 'Hotel Shingetsu',
    es: 'Hotel Shingetsu',
    fr: 'Hôtel Shingetsu',
  },
  みどり丘: {
    'ja-Hrkt': 'みどりおか',
    en: 'Midori-oka',
    ko: '미도리오카',
    'zh-Hans': '绿丘',
    'zh-Hant': '綠丘',
    de: 'Midori-oka',
    es: 'Midori-oka',
    fr: 'Midori-oka',
  },
  // --- Stop headsign values showing upcoming waypoints (kyoto-city-bus pattern) ---
  'ほし公園・にじ橋': {
    'ja-Hrkt': 'ほしこうえん・にじばし',
    en: 'Hoshi Park / Niji Bridge',
    ko: '호시공원 / 니지다리',
    'zh-Hans': '星公园 / 彩虹桥',
    'zh-Hant': '星公園 / 彩虹橋',
    de: 'Hoshi-Park / Niji-Brücke',
    es: 'Parque Hoshi / Puente Niji',
    fr: 'Parc Hoshi / Pont Niji',
  },
  'にじ橋・そらタワー': {
    'ja-Hrkt': 'にじばし・そらたわー',
    en: 'Niji Bridge / Sora Tower',
    ko: '니지다리 / 소라타워',
    'zh-Hans': '彩虹桥 / 空塔',
    'zh-Hant': '彩虹橋 / 空塔',
    de: 'Niji-Brücke / Sora-Turm',
    es: 'Puente Niji / Torre Sora',
    fr: 'Pont Niji / Tour Sora',
  },
  '図書館前・あおば中央駅': {
    'ja-Hrkt': 'としょかんまえ・あおばちゅうおうえき',
    en: 'Library / Aoba-Chuo Sta.',
    ko: '도서관 앞 / 아오바중앙역',
    'zh-Hans': '图书馆前 / 青叶中央站',
    'zh-Hant': '圖書館前 / 青葉中央站',
    de: 'Bibliothek / Aoba-Chūō Bahnhof',
    es: 'Biblioteca / Estación Aoba-Chūō',
    fr: "Bibliothèque / Gare d'Aoba-Chūō",
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
      // bus_aoba01 with stop_headsign: shows upcoming waypoints (non-empty trip_headsign + override).
      { routeId: 'bus_aoba01', headsign: 'にじ橋', stopHeadsign: 'ほし公園・にじ橋' },
      { routeId: 'bus_aoba01', headsign: 'あおば中央駅' },
      // bus_nohd01: trip_headsign empty + stop_headsign present (keio-bus pattern).
      // stop_headsign becomes the effective headsign via GTFS spec.
      { routeId: 'bus_nohd01', headsign: '', stopHeadsign: 'もり公園前' },
      { routeId: 'bus_yukkuri01', headsign: 'あおば中央駅' },
      { routeId: 'bus_yukkuri01', headsign: 'もり公園前' },
    ],
    bus_library: [
      { routeId: 'bus_aoba01', headsign: 'にじ橋' },
      // bus_aoba02 with stop_headsign: remaining waypoints via Niji Bridge to Sora Tower.
      { routeId: 'bus_aoba02', headsign: 'そらタワー', stopHeadsign: 'にじ橋・そらタワー' },
      { routeId: 'bus_yukkuri01', headsign: 'あおば中央駅' },
      { routeId: 'bus_yukkuri01', headsign: 'もり公園前' },
      // bus_nohd01: mid-trip stop_headsign differs from bus_park
      // (kyoto-city-bus pattern: stop_headsign changes as stops pass).
      { routeId: 'bus_nohd01', headsign: '', stopHeadsign: 'もり公園前・にじ橋' },
    ],
    bus_tower: [
      // bus_aoba02 return trip with stop_headsign: via Aoba Library to Aoba-Chuo Sta.
      {
        routeId: 'bus_aoba02',
        headsign: 'あおば中央駅',
        stopHeadsign: '図書館前・あおば中央駅',
      },
    ],
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
    // ---------------------------------------------------------------------
    // Issue #47 fixtures: duplicate stop_id within pattern (isolated routes)
    // 各路線専用 stop。他路線とは接続しない (cross-route reuse なし)。
    // ---------------------------------------------------------------------
    // 進まない路線 (rs): [rs-1, rs-1, rs-2, rs-3]
    'rs-1': [{ routeId: 'bus_stuck', headsign: 'rs-3' }],
    'rs-2': [{ routeId: 'bus_stuck', headsign: 'rs-3' }],
    'rs-3': [{ routeId: 'bus_stuck', headsign: 'rs-3' }],
    // 6 の字路線 (r6): [r6-1, r6-2, r6-3, r6-5, r6-6, r6-4, r6-3]
    // r6-3 が ループの閉じ点で 2 回通過 (terminal も r6-3)
    'r6-1': [{ routeId: 'bus_six', headsign: 'r6-3' }],
    'r6-2': [{ routeId: 'bus_six', headsign: 'r6-3' }],
    'r6-3': [{ routeId: 'bus_six', headsign: 'r6-3' }],
    'r6-4': [{ routeId: 'bus_six', headsign: 'r6-3' }],
    'r6-5': [{ routeId: 'bus_six', headsign: 'r6-3' }],
    'r6-6': [{ routeId: 'bus_six', headsign: 'r6-3' }],
    // 8 の字路線 (r8): [r8-3, r8-4, r8-5, r8-3, r8-1, r8-2, r8-3]
    'r8-1': [{ routeId: 'bus_eight', headsign: 'r8-3' }],
    'r8-2': [{ routeId: 'bus_eight', headsign: 'r8-3' }],
    'r8-3': [{ routeId: 'bus_eight', headsign: 'r8-3' }],
    'r8-4': [{ routeId: 'bus_eight', headsign: 'r8-3' }],
    'r8-5': [{ routeId: 'bus_eight', headsign: 'r8-3' }],
    // n92: 2 trip パターン (往復イメージ)
    //   trip A [n92-1, n92-2, n92-3]: headsign = 'n92-3'
    //   trip B [n92-4, n92-2, n92-1]: headsign = 'n92-1'
    // n92-1, n92-2 は両 trip で参照される。
    'n92-1': [
      { routeId: 'n92', headsign: 'n92-3' }, // trip A origin
      { routeId: 'n92', headsign: 'n92-1' }, // trip B terminal
      { routeId: 'n92', headsign: 'n92-5' }, // trip C origin (回送)
    ],
    'n92-2': [
      { routeId: 'n92', headsign: 'n92-3' }, // trip A 中間
      { routeId: 'n92', headsign: 'n92-1' }, // trip B 中間
    ],
    'n92-3': [{ routeId: 'n92', headsign: 'n92-3' }], // trip A terminal
    'n92-4': [{ routeId: 'n92', headsign: 'n92-1' }], // trip B origin
    'n92-5': [{ routeId: 'n92', headsign: 'n92-5' }], // trip C terminal (中野車庫)

    // kc10a: 乗降切替型 (p43 模倣)
    'kc10a-1': [{ routeId: 'kc10a', headsign: 'kc10a-3' }],
    'kc10a-2': [{ routeId: 'kc10a', headsign: 'kc10a-3' }],
    'kc10a-3': [{ routeId: 'kc10a', headsign: 'kc10a-3' }],
    // kc10b: 通常停車型 (p44 模倣)
    'kc10b-1': [{ routeId: 'kc10b', headsign: 'kc10b-3' }],
    'kc10b-2': [{ routeId: 'kc10b', headsign: 'kc10b-3' }],
    'kc10b-3': [{ routeId: 'kc10b', headsign: 'kc10b-3' }],

    // --- Colorful Route low-contrast fixtures -------------------------
    // Three directions × 5 routes each, arranged as red → green → blue
    // → red. Every stop therefore serves 10 entries: 5 as origin and
    // 5 as terminal. Headsign values are the terminal stop name.
    stop_red: [
      // Origin for red → green (light-theme problem colors).
      { routeId: 'clr_rg_white', headsign: 'green' },
      { routeId: 'clr_rg_pale_yellow', headsign: 'green' },
      { routeId: 'clr_rg_pale_gold', headsign: 'green' },
      { routeId: 'clr_rg_bright_yellow', headsign: 'green' },
      { routeId: 'clr_rg_light_cyan', headsign: 'green' },
      // Terminal for blue → red (misc low-contrast palettes).
      { routeId: 'clr_br_light_yellow', headsign: 'red' },
      { routeId: 'clr_br_light_green', headsign: 'red' },
      { routeId: 'clr_br_bright_green', headsign: 'red' },
      { routeId: 'clr_br_gold', headsign: 'red' },
      { routeId: 'clr_br_light_gray', headsign: 'red' },
    ],
    stop_green: [
      // Terminal for red → green.
      { routeId: 'clr_rg_white', headsign: 'green' },
      { routeId: 'clr_rg_pale_yellow', headsign: 'green' },
      { routeId: 'clr_rg_pale_gold', headsign: 'green' },
      { routeId: 'clr_rg_bright_yellow', headsign: 'green' },
      { routeId: 'clr_rg_light_cyan', headsign: 'green' },
      // Origin for green → blue (dark-theme problem colors).
      { routeId: 'clr_gb_black', headsign: 'blue' },
      { routeId: 'clr_gb_near_black', headsign: 'blue' },
      { routeId: 'clr_gb_gray_900', headsign: 'blue' },
      { routeId: 'clr_gb_gray_800', headsign: 'blue' },
      { routeId: 'clr_gb_dark_gray', headsign: 'blue' },
    ],
    stop_blue: [
      // Terminal for green → blue.
      { routeId: 'clr_gb_black', headsign: 'blue' },
      { routeId: 'clr_gb_near_black', headsign: 'blue' },
      { routeId: 'clr_gb_gray_900', headsign: 'blue' },
      { routeId: 'clr_gb_gray_800', headsign: 'blue' },
      { routeId: 'clr_gb_dark_gray', headsign: 'blue' },
      // Origin for blue → red.
      { routeId: 'clr_br_light_yellow', headsign: 'red' },
      { routeId: 'clr_br_light_green', headsign: 'red' },
      { routeId: 'clr_br_bright_green', headsign: 'red' },
      { routeId: 'clr_br_gold', headsign: 'red' },
      { routeId: 'clr_br_light_gray', headsign: 'red' },
    ],
  };

/** Stops where all departures are drop-off only (pickupType=1). */
const DROP_OFF_ONLY_STOPS = new Set(['bus_central_dropoff', 'n92-3']);

/**
 * Time offset (minutes) added to entries for non-first occurrence of the same
 * stop_id in a pattern. Approximates the layover/dwell time that real GTFS
 * captures via consecutive duplicate stops with different time values
 * (e.g., kobus:240 中92 練馬駅: stop_sequence 20 at 09:28 → 21 at 09:33).
 */
const OCCURRENCE_LAYOVER_MINUTES = 5;

/**
 * Per-(routeId, headsign, stopId, occurrence) override for boarding semantics.
 * Key format: `${routeId}__${headsign}__${stopId}__${occ}` (occ is 0-based).
 *
 * Used to model patterns like 市バス10 (kcbus:01000) 三条京阪前 where the same
 * stop_id appears consecutively with different pickup_type/drop_off_type per
 * occurrence (e.g., si=3 has pt=1/dt=0, si=4 has pt=0/dt=1).
 *
 * Falls back to {@link DROP_OFF_ONLY_STOPS} when no override is registered.
 */
const BOARDING_OVERRIDES = new Map<
  string,
  { pickupType: 0 | 1 | 2 | 3; dropOffType: 0 | 1 | 2 | 3 }
>([
  // kc10a (乗降切替型): kc10a-2 occ=0 = 降車のみ, occ=1 = 乗車のみ
  ['kc10a__kc10a-3__kc10a-2__0', { pickupType: 1, dropOffType: 0 }],
  ['kc10a__kc10a-3__kc10a-2__1', { pickupType: 0, dropOffType: 1 }],
  // kc10b (通常停車型) は全 stop デフォルト (pickupType=0, dropOffType=0) で表現可能。
  // override 不要だが、明示性のため記録なし。
]);

function getBoardingTypes(
  routeId: string,
  headsign: string,
  stopId: string,
  occ: number,
): { pickupType: 0 | 1 | 2 | 3; dropOffType: 0 | 1 | 2 | 3 } {
  const key = `${routeId}__${headsign}__${stopId}__${occ}`;
  const override = BOARDING_OVERRIDES.get(key);
  if (override !== undefined) {
    return override;
  }
  return {
    pickupType: DROP_OFF_ONLY_STOPS.has(stopId) ? 1 : 0,
    dropOffType: 0,
  };
}

/** Routes with dwell time: arrival + N minutes = departure at every stop. */
const DWELL_TIME_ROUTES = new Map<string, number>([['bus_yukkuri01', 3]]);

/**
 * Routes that use the "within-stop dwell" model for consecutive duplicate stops.
 * For these routes, multiple occurrences of the same stop_id share the same
 * departure_time, with only the first occurrence (occ=0) having a non-zero dwell.
 *
 * Models real GTFS like kcbus:01000 (市バス10) at 114410 (三条京阪前):
 *   ss=3: arrival=06:38, departure=06:41 (3 min dwell)
 *   ss=4: arrival=06:41, departure=06:41 (0 dwell, instant)
 * The bus is physically at the stop from 06:38 to 06:41 (3 min). The 2 entries
 * encode a boarding-mode swap within that single dwell window.
 *
 * Mutually exclusive with OCCURRENCE_LAYOVER_MINUTES: routes in this map do
 * NOT receive the per-occurrence time offset (they share departure_time).
 *
 * Value is the dwell length in minutes for occ=0.
 */
const WITHIN_STOP_DWELL_ROUTES = new Map<string, number>([
  ['kc10a', 3],
  ['kc10b', 3],
]);

function computeOccOffset(routeId: string, occ: number): number {
  if (WITHIN_STOP_DWELL_ROUTES.has(routeId)) {
    return 0;
  }
  return occ * OCCURRENCE_LAYOVER_MINUTES;
}

function computeArrivalMinutes(routeId: string, occ: number, departureMinutes: number): number {
  const withinStopDwell = WITHIN_STOP_DWELL_ROUTES.get(routeId);
  if (withinStopDwell !== undefined && occ === 0) {
    return departureMinutes - withinStopDwell;
  }
  const dwellTime = DWELL_TIME_ROUTES.get(routeId) ?? 0;
  return dwellTime > 0 ? departureMinutes - dwellTime : departureMinutes;
}

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
  // ---------------------------------------------------------------------
  // Issue #47 fixtures: 同一 stop が pattern 内で複数回出現するトポロジー
  // 各路線専用 stop。他路線とは接続しない (cross-route reuse なし)。
  // ---------------------------------------------------------------------
  // 進まない路線 (rs): rs-1 が連続 2 回 (dwell)、rs-3 が terminal
  ['bus_stuck__rs-3', ['rs-1', 'rs-1', 'rs-2', 'rs-3']],
  // 6 の字路線 (r6): 6 stops, 7 visits.
  // 電卓 7-segment のように 6 点で「6」を描く。
  // r6-1(spine top) → r6-2(spine mid) → r6-3(loop entry/closing) → r6-5(loop SW)
  //   → r6-6(loop SE) → r6-4(loop NE) → r6-3(loop closes, terminal)
  // r6-3 が index 2 と 6 で 2 回通過。
  ['bus_six__r6-3', ['r6-1', 'r6-2', 'r6-3', 'r6-5', 'r6-6', 'r6-4', 'r6-3']],
  // 8 の字路線 (r8): 5 stops, 7 visits.
  // r8-3 が figure-eight の交点 — index 0 (origin), 3 (mid-cross), 6 (terminal) で 3 回通過
  // 上ループ: r8-3 → r8-4 → r8-5 → r8-3
  // 下ループ: r8-3 → r8-1 → r8-2 → r8-3
  ['bus_eight__r8-3', ['r8-3', 'r8-4', 'r8-5', 'r8-3', 'r8-1', 'r8-2', 'r8-3']],
  // n92: 中92 練馬駅終点ケース再現 (Issue #47 参考事例) + 回送便
  //   trip A: n92-1 → n92-2 → n92-3 → n92-3  (n92-3 連続 dwell、両方降車専用)
  //   trip B: n92-4 → n92-2 → n92-1
  //   trip C: n92-1 → n92-5  (回送便、中92 の p213 中野駅→中野車庫 に相当)
  ['n92__n92-3', ['n92-1', 'n92-2', 'n92-3', 'n92-3']],
  ['n92__n92-1', ['n92-4', 'n92-2', 'n92-1']],
  ['n92__n92-5', ['n92-1', 'n92-5']],
  // kc10a: 市バス10 乗降切替型 (p43 模倣)
  ['kc10a__kc10a-3', ['kc10a-1', 'kc10a-2', 'kc10a-2', 'kc10a-3']],
  // kc10b: 市バス10 通常停車型 (p44 模倣)
  ['kc10b__kc10b-3', ['kc10b-1', 'kc10b-2', 'kc10b-2', 'kc10b-3']],
  // Colorful Route: three directions, each 2-stop hop.
  // red → green (5 routes, light-theme problem colors)
  ['clr_rg_white__green', ['stop_red', 'stop_green']],
  ['clr_rg_pale_yellow__green', ['stop_red', 'stop_green']],
  ['clr_rg_pale_gold__green', ['stop_red', 'stop_green']],
  ['clr_rg_bright_yellow__green', ['stop_red', 'stop_green']],
  ['clr_rg_light_cyan__green', ['stop_red', 'stop_green']],
  // green → blue (5 routes, dark-theme problem colors)
  ['clr_gb_black__blue', ['stop_green', 'stop_blue']],
  ['clr_gb_near_black__blue', ['stop_green', 'stop_blue']],
  ['clr_gb_gray_900__blue', ['stop_green', 'stop_blue']],
  ['clr_gb_gray_800__blue', ['stop_green', 'stop_blue']],
  ['clr_gb_dark_gray__blue', ['stop_green', 'stop_blue']],
  // blue → red (5 routes, misc low-contrast palettes)
  ['clr_br_light_yellow__red', ['stop_blue', 'stop_red']],
  ['clr_br_light_green__red', ['stop_blue', 'stop_red']],
  ['clr_br_bright_green__red', ['stop_blue', 'stop_red']],
  ['clr_br_gold__red', ['stop_blue', 'stop_red']],
  ['clr_br_light_gray__red', ['stop_blue', 'stop_red']],
]);

/**
 * Count how many times a stop appears in a route+headsign sequence.
 *
 * Most stops appear once. Returns >1 for 6-shape and circular routes
 * where the same stop is visited at multiple positions in one trip
 * (Issue #47). Callers must emit one entry per occurrence.
 */
function countStopOccurrences(routeId: string, headsign: string, stopId: string): number {
  const seq = ROUTE_STOP_SEQUENCES.get(`${routeId}__${headsign}`);
  if (!seq) {
    return 0;
  }
  let count = 0;
  for (const id of seq) {
    if (id === stopId) {
      count++;
    }
  }
  return count;
}

/**
 * Look up pattern position for the N-th occurrence of a stop within a
 * route+headsign sequence.
 *
 * The `occurrenceIndex` parameter (0-based) selects which visit when the
 * stop appears multiple times in the same pattern (Issue #47, 6-shape /
 * circular routes). For stops that appear only once, callers pass
 * `occurrenceIndex=0`.
 */
function getPatternPosition(
  routeId: string,
  headsign: string,
  stopId: string,
  occurrenceIndex: number,
): { stopIndex: number; totalStops: number; isTerminal: boolean; isOrigin: boolean } {
  const seq = ROUTE_STOP_SEQUENCES.get(`${routeId}__${headsign}`);
  if (!seq) {
    // No sequence defined — fall back to unknown position.
    return { stopIndex: 0, totalStops: 1, isTerminal: false, isOrigin: false };
  }
  // Find the occurrenceIndex-th match. Linear scan since seq is short.
  let seen = 0;
  let idx = -1;
  for (let i = 0; i < seq.length; i++) {
    if (seq[i] === stopId) {
      if (seen === occurrenceIndex) {
        idx = i;
        break;
      }
      seen++;
    }
  }
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
  const routeTypes = new Map<string, AppRouteTypeValue[]>();
  const agencies = new Map<string, Agency[]>();
  const routesResolved = new Map<string, Route[]>();

  for (const [stopId, entries] of Object.entries(STOP_ROUTES)) {
    const types = new Set<AppRouteTypeValue>();
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
  // ---------------------------------------------------------------------
  // Issue #47 fixtures: duplicate stop_id within pattern (route shapes)
  // ---------------------------------------------------------------------
  // bus_six: 6 の字路線 (Issue #47, 6 stops, 7 visits, r6-3 が ループ閉じ点)
  // ポリラインは pattern と同じ順序で stops を辿る:
  //   r6-1 → r6-2 → r6-3 → r6-5 → r6-6 → r6-4 → r6-3
  // r6-3 が 2 回現れることでループの「閉じ」を視覚的に表現する。
  {
    routeId: 'bus_six',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_six')!.route_color}`,
    route: ROUTE_MAP.get('bus_six')!,
    points: [
      coord('r6-1'),
      coord('r6-2'),
      coord('r6-3'),
      coord('r6-5'),
      coord('r6-6'),
      coord('r6-4'),
      coord('r6-3'),
    ],
  },
  // bus_eight: 8 の字路線 (Issue #47, 5 stops, 7 visits, r8-3 が砂時計の交点 3 回通過)
  // ポリラインは pattern と同じ順序で stops を辿る:
  //   r8-3 → r8-4 → r8-5 → r8-3 → r8-1 → r8-2 → r8-3
  // 上ループ (r8-3 → r8-4 → r8-5 → r8-3) と下ループ (r8-3 → r8-1 → r8-2 → r8-3) が
  // r8-3 で交差して砂時計 (figure-eight) を形成する。
  {
    routeId: 'bus_eight',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_eight')!.route_color}`,
    route: ROUTE_MAP.get('bus_eight')!,
    points: [
      coord('r8-3'),
      coord('r8-4'),
      coord('r8-5'),
      coord('r8-3'),
      coord('r8-1'),
      coord('r8-2'),
      coord('r8-3'),
    ],
  },
  // bus_stuck: 進まない路線 (Issue #47, 3 stops, 4 visits, rs-1 が連続 dwell)
  // ポリラインは pattern と同じ順序で stops を辿る:
  //   rs-1 → rs-1 → rs-2 → rs-3
  // rs-1 → rs-1 は同一座標で 0 距離 (dwell)。視覚的には rs-1 → rs-2 → rs-3 の
  // 直線として表示される。
  {
    routeId: 'bus_stuck',
    routeType: 3,
    color: `#${ROUTE_MAP.get('bus_stuck')!.route_color}`,
    route: ROUTE_MAP.get('bus_stuck')!,
    points: [coord('rs-1'), coord('rs-1'), coord('rs-2'), coord('rs-3')],
  },
  // n92: 中92 練馬駅終点ケース再現 (5 stops, 3 trips: 営業 2 + 回送 1)
  // 実際の運行 segment は 4 本 (n92-3 → n92-4 の運行は無し):
  //   edge a: n92-1 ↔ n92-2 (trip A/B 共通)
  //   edge b: n92-2 ↔ n92-3 (trip A のみ、終点 dwell n92-3 → n92-3 は 0 距離で省略)
  //   edge c: n92-2 ↔ n92-4 (trip B のみ、対角 SE)
  //   edge d: n92-1 ↔ n92-5 (trip C 回送のみ、垂直 S)
  // 1 polyline で全 edge を辿る (n92-1, n92-2 で折り返し): 5 → 1 → 2 → 3 → 2 → 4
  {
    routeId: 'n92',
    routeType: 3,
    color: `#${ROUTE_MAP.get('n92')!.route_color}`,
    route: ROUTE_MAP.get('n92')!,
    points: [
      coord('n92-5'),
      coord('n92-1'),
      coord('n92-2'),
      coord('n92-3'),
      coord('n92-2'),
      coord('n92-4'),
    ],
  },
  // kc10a: 市バス10 乗降切替型 (p43 模倣)
  {
    routeId: 'kc10a',
    routeType: 3,
    color: `#${ROUTE_MAP.get('kc10a')!.route_color}`,
    route: ROUTE_MAP.get('kc10a')!,
    points: [coord('kc10a-1'), coord('kc10a-2'), coord('kc10a-3')],
  },
  // kc10b: 市バス10 通常停車型 (p44 模倣)、kc10a の南 100m 並行配置
  {
    routeId: 'kc10b',
    routeType: 3,
    color: `#${ROUTE_MAP.get('kc10b')!.route_color}`,
    route: ROUTE_MAP.get('kc10b')!,
    points: [coord('kc10b-1'), coord('kc10b-2'), coord('kc10b-3')],
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
      return Promise.resolve({ success: false, error: `No stop time data for stop: ${stopId}` });
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

      // Issue #47: a stop may appear at multiple positions in one pattern
      // (6-shape / circular). Emit one set of entries per occurrence.
      const occurrences = Math.max(1, countStopOccurrences(routeId, headsign, stopId));

      for (let occ = 0; occ < occurrences; occ++) {
        const position = getPatternPosition(routeId, headsign, stopId, occ);
        const occOffset = computeOccOffset(routeId, occ);
        const { pickupType, dropOffType } = getBoardingTypes(routeId, headsign, stopId, occ);

        // Count full-day entries and check boardability (per occurrence).
        fullDayCount += allMinutes.length;
        if (!hasBoardable && pickupType !== 1 && !position.isTerminal) {
          hasBoardable = true;
        }

        // Note: limit is applied per route+headsign (simplified mock behavior).
        // Production repo collects all entries then applies limit globally.
        const upcoming = allMinutes
          .map((m) => m + occOffset)
          .filter((m) => m >= nowMinutes)
          .slice(0, limit);
        for (const minutes of upcoming) {
          const arrivalMinutes = computeArrivalMinutes(routeId, occ, minutes);
          // Colorful Route fixtures need insights so JourneyTimeBar
          // renders. Real insights come from InsightsBundle in production
          // builds; for the mock we synthesize a deterministic trip
          // length (10–120 min, per route_id) and derive remainingMinutes
          // by linear interpolation across the pattern. `freq` is always
          // 1 since colorful routes are one-trip-per-day fixtures.
          const colorfulInsights = (() => {
            if (route.agency_id !== 'mock:colorful') {
              return undefined;
            }
            const totalMinutes = 10 + (simpleHash(route.route_id) % 111);
            const remainingMinutes =
              position.totalStops > 1
                ? Math.round(
                    (totalMinutes * (position.totalStops - position.stopIndex - 1)) /
                      (position.totalStops - 1),
                  )
                : 0;
            return { totalMinutes, remainingMinutes, freq: 1 };
          })();
          entries.push({
            schedule: { departureMinutes: minutes, arrivalMinutes },
            routeDirection: {
              route,
              tripHeadsign: createMockTranslatableText(headsign),
              ...(stopHeadsign != null
                ? { stopHeadsign: createMockTranslatableText(stopHeadsign) }
                : {}),
            },
            boarding: { pickupType, dropOffType },
            patternPosition: position,
            serviceDate,
            ...(colorfulInsights ? { insights: colorfulInsights } : {}),
          });
        }
      }
    }

    sortTimetableEntriesChronologically(entries);

    const meta: TimetableQueryMeta = {
      isBoardableOnServiceDay: hasBoardable,
      totalEntries: fullDayCount,
    };
    return Promise.resolve({ success: true, data: entries, truncated: false, meta });
  }

  /** {@inheritDoc TransitRepository.getRouteTypesForStop} */
  getRouteTypesForStop(stopId: string): Promise<Result<AppRouteTypeValue[]>> {
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
      // Issue #47: emit one set of entries per occurrence (6-shape / circular).
      const occurrences = Math.max(1, countStopOccurrences(routeId, headsign, stopId));

      for (let occ = 0; occ < occurrences; occ++) {
        const position = getPatternPosition(routeId, headsign, stopId, occ);
        const occOffset = computeOccOffset(routeId, occ);
        const { pickupType, dropOffType } = getBoardingTypes(routeId, headsign, stopId, occ);
        for (const baseMinutes of generateFixedMinutes(routeId, headsign)) {
          const minutes = baseMinutes + occOffset;
          const arrivalMinutes = computeArrivalMinutes(routeId, occ, minutes);
          entries.push({
            schedule: { departureMinutes: minutes, arrivalMinutes },
            routeDirection: {
              route,
              tripHeadsign: createMockTranslatableText(headsign),
              ...(stopHeadsign != null
                ? { stopHeadsign: createMockTranslatableText(stopHeadsign) }
                : {}),
            },
            boarding: { pickupType, dropOffType },
            patternPosition: position,
          });
        }
      }
    }

    sortTimetableEntriesByDepartureTime(entries);
    const meta: TimetableQueryMeta = {
      isBoardableOnServiceDay: getTimetableEntriesState(entries) === 'boardable',
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
