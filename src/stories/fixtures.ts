/**
 * Shared story fixtures for Storybook.
 *
 * Provides realistic test data based on actual GTFS sources.
 * Import from `../../stories/fixtures` in story files.
 */
import type { Agency, Route, Stop } from '../types/app/transit';
import type { ContextualTimetableEntry, StopServiceType } from '../types/app/transit-composed';

// ---------------------------------------------------------------------------
// Agencies
// ---------------------------------------------------------------------------

/** 2-char short name (shortest real example — Tsukuba Express). */
export const agencyGx: Agency = {
  agency_id: 'mir:0000020001320',
  agency_name: '首都圏新都市鉄道',
  agency_short_name: 'GX',
  agency_names: { en: 'Metropolitan Intercity Railway' },
  agency_short_names: { en: 'GX' },
  agency_url: 'https://gx.example.com/',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: 'https://gx.example.com/fare',
  agency_colors: [{ bg: '003B83', text: 'FFFFFF' }],
};

/** Fictional US agency — English name, long agency_name. */
export const agencyUs: Agency = {
  agency_id: 'fixture:us',
  agency_name: 'Bay Area Rapid Transit District',
  agency_short_name: 'BART',
  agency_names: { ja: 'ベイエリア高速鉄道', 'zh-Hans': '旧金山湾区捷运' },
  agency_short_names: {},
  agency_url: 'https://bart.example.com/',
  agency_lang: 'en',
  agency_timezone: 'America/Los_Angeles',
  agency_fare_url: '',
  agency_colors: [{ bg: '0060A9', text: 'FFFFFF' }],
};

/** Fictional German agency — German name, EU timezone. */
export const agencyDe: Agency = {
  agency_id: 'fixture:de',
  agency_name: 'Berliner Verkehrsbetriebe',
  agency_short_name: 'BVG',
  agency_names: { en: 'Berlin Transport Company', ja: 'ベルリン交通局' },
  agency_short_names: { ja: 'ベルリン交通' },
  agency_url: 'https://bvg.example.de/',
  agency_lang: 'de',
  agency_timezone: 'Europe/Berlin',
  agency_fare_url: 'https://bvg.example.de/fare',
  agency_colors: [{ bg: 'F0D722', text: '000000' }],
};

/** 5-char short name (typical real example — Oretetsu Bus). */
export const agencyOretetsu: Agency = {
  agency_id: 'iyt2:0000038000143',
  agency_name: '蜜柑バス株式会社',
  agency_short_name: '蜜柑バス',
  agency_names: { en: 'Mikan Bus Co., Ltd.', ko: '밀감버스' },
  agency_short_names: { en: 'Mikan Bus' },
  agency_url: 'https://mikan-bus.example.com/',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: 'EB6100', text: 'FFFFFF' }],
};

/** 3-char short name (common real example — Toei Bus). */
export const agencyTobus: Agency = {
  agency_id: 'minkuru:8000020130001',
  agency_name: '都営バス',
  agency_short_name: '都バス',
  agency_names: {
    en: 'Toei Bus',
    'ja-Hrkt': 'とえいばす',
    ko: '도에이버스',
    'zh-Hans': '都营巴士',
  },
  agency_short_names: { en: 'Toei' },
  agency_url: 'https://tobus.example.jp/',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: '009f40', text: 'FFFFFF' }],
};

/** 8-char short name (fictional, stress test for layout). */
export const agencyLong: Agency = {
  agency_id: 'fictional:9999999999999',
  agency_name: '架空都市圏高速鉄道株式会社',
  agency_short_name: '架空都市圏高速鉄道',
  agency_names: {},
  agency_short_names: {},
  agency_url: 'https://kakuu-rail.example.jp/',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: 'https://kakuu-rail.example.jp/fare',
  agency_colors: [{ bg: '8B5CF6', text: 'FFFFFF' }],
};

/** Red. */
export const agencyRed: Agency = {
  agency_id: 'fixture:red',
  agency_name: '赤色地下鉄株式会社',
  agency_short_name: '赤色バス',
  agency_names: {},
  agency_short_names: {},
  agency_url: 'https://red-bus.example.jp/',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: 'E60013', text: 'FFFFFF' }],
};

/** Blue, 5-char hiragana name. */
export const agencyBlue: Agency = {
  agency_id: 'fixture:blue',
  agency_name: '青色モノレール株式会社',
  agency_short_name: 'あおいろ号',
  agency_names: {},
  agency_short_names: {},
  agency_url: '',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: 'https://aoiro.example.jp/fare',
  agency_colors: [{ bg: '1662B8', text: 'FFFFFF' }],
};

/** Dark green. */
export const agencyGreen: Agency = {
  agency_id: 'fixture:green',
  agency_name: '緑色市交通局',
  agency_short_name: '緑色市バス',
  agency_names: {},
  agency_short_names: {},
  agency_url: '',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: '138060', text: 'FFFFFF' }],
};

/** Yellow background with dark text — tests contrast. */
export const agencyYellow: Agency = {
  agency_id: 'fixture:yellow',
  agency_name: '黄色トラム株式会社',
  agency_short_name: '黄トラ',
  agency_names: {},
  agency_short_names: {},
  agency_url: '',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [{ bg: 'FDD23D', text: '000000' }],
};

/** Agency without brand colors. */
export const agencyNoColor: Agency = {
  agency_id: 'nocolor:0000000000000',
  agency_name: '無色バス株式会社',
  agency_short_name: '無色バス',
  agency_names: {},
  agency_short_names: {},
  agency_url: '',
  agency_lang: 'ja',
  agency_timezone: 'Asia/Tokyo',
  agency_fare_url: '',
  agency_colors: [],
};

/** All agencies for multi-agency scenarios. */
export const allAgencies: Agency[] = [
  agencyGx,
  agencyOretetsu,
  agencyTobus,
  agencyLong,
  agencyRed,
  agencyBlue,
  agencyGreen,
  agencyYellow,
  agencyUs,
  agencyDe,
  agencyNoColor,
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const busRoute: Route = {
  route_id: 'route-001',
  route_short_name: '都02',
  route_long_name: '大塚駅〜錦糸町駅前',
  route_names: {},
  route_type: 3,
  route_color: '1976D2',
  route_text_color: 'FFFFFF',
  agency_id: 'minkuru:8000020130001',
};

export const busRoute2: Route = {
  route_id: 'route-002',
  route_short_name: '都08',
  route_long_name: '日暮里駅〜錦糸町駅前',
  route_names: {},
  route_type: 3,
  route_color: '00A850',
  route_text_color: 'FFFFFF',
  agency_id: 'minkuru:8000020130001',
};

export const tramRoute: Route = {
  route_id: 'route-003',
  route_short_name: '荒川線',
  route_long_name: '三ノ輪橋〜早稲田',
  route_names: {},
  route_type: 0,
  route_color: 'E60012',
  route_text_color: 'FFFFFF',
  agency_id: 'iyt2:0000038000143',
};

export const noColorRoute: Route = {
  route_id: 'route-004',
  route_short_name: 'A5',
  route_long_name: '',
  route_names: {},
  route_type: 3,
  route_color: '',
  route_text_color: '',
  agency_id: 'nocolor:0000000000000',
};

// ---------------------------------------------------------------------------
// Stops
// ---------------------------------------------------------------------------

export const baseStop: Stop = {
  stop_id: 'stop-001',
  stop_name: '錦糸町駅前',
  stop_names: {
    ja: '錦糸町駅前',
    'ja-Hrkt': 'きんしちょうえきまえ',
    en: 'Kinshichō Sta.',
  },
  stop_lat: 35.6955,
  stop_lon: 139.8135,
  location_type: 0,
  agency_id: 'minkuru:8000020130001',
};

/** Long stop name with 6-language support (matching Kyoto City Bus GTFS coverage). */
export const longNameStop: Stop = {
  ...baseStop,
  stop_id: 'stop-long',
  stop_name: '東京都立産業技術研究センター前',
  stop_names: {
    ja: '東京都立産業技術研究センター前',
    'ja-Hrkt': 'とうきょうとりつさんぎょうぎじゅつけんきゅうせんたーまえ',
    en: 'Tokyo Metropolitan Industrial Technology Research Institute',
    ko: '도쿄도립산업기술연구센터앞',
    'zh-Hans': '东京都立产业技术研究中心前',
    'zh-Hant': '東京都立產業技術研究中心前',
  },
};

// ---------------------------------------------------------------------------
// Timetable entries
// ---------------------------------------------------------------------------

/** Default service date for stories. */
export const storyServiceDate = new Date('2026-03-30T00:00:00');

/** Default "now" for stories — 14:25, 5 minutes before the default 14:30 departure. */
export const storyNow = new Date('2026-03-30T14:25:00');

/** Map center ~235m south-west of the base stop. */
export const storyMapCenter = { lat: 35.6939, lng: 139.8118 };

export function createEntry(
  overrides: Partial<{
    departureMinutes: number;
    arrivalMinutes: number;
    route: Route;
    headsign: string;
    pickupType: StopServiceType;
    dropOffType: StopServiceType;
    isTerminal: boolean;
    isOrigin: boolean;
    stopIndex: number;
    totalStops: number;
    direction: 0 | 1;
  }> = {},
): ContextualTimetableEntry {
  const depMin = overrides.departureMinutes ?? 870; // 14:30
  return {
    schedule: {
      departureMinutes: depMin,
      arrivalMinutes: overrides.arrivalMinutes ?? depMin,
    },
    routeDirection: {
      route: overrides.route ?? busRoute,
      headsign: overrides.headsign ?? '大塚駅前',
      headsign_names: {},
      direction: overrides.direction,
    },
    boarding: {
      pickupType: overrides.pickupType ?? 0,
      dropOffType: overrides.dropOffType ?? 0,
    },
    patternPosition: {
      stopIndex: overrides.stopIndex ?? 3,
      totalStops: overrides.totalStops ?? 15,
      isTerminal: overrides.isTerminal ?? false,
      isOrigin: overrides.isOrigin ?? false,
    },
    serviceDate: storyServiceDate,
  };
}
