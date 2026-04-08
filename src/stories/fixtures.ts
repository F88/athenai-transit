/**
 * Shared story fixtures for Storybook.
 *
 * Provides realistic test data based on actual GTFS sources.
 * Import from `src/stories/fixtures` in story files.
 */
import type { Agency, Route, Stop } from '../types/app/transit';
import type {
  ContextualTimetableEntry,
  RouteDirection,
  StopServiceType,
  StopWithContext,
  StopWithMeta,
  TranslatableText,
} from '../types/app/transit-composed';

// ---------------------------------------------------------------------------
// Agencies
// ---------------------------------------------------------------------------

/** 2-char short name (shortest real example — Tsukuba Express). */
export const agencyGx: Agency = {
  agency_id: 'mir:0000020001320',
  agency_name: '首都圏新都市鉄道',
  agency_short_name: 'GX',
  agency_names: {
    ja: '首都圏新都市鉄道',
    en: 'Metropolitan Intercity Railway',
    ko: '수도권 신도시 철도',
    'zh-Hans': '首都圈新都市铁道',
    'zh-Hant': '首都圈新都市鐵道',
  },
  agency_short_names: { ja: 'GX', en: 'GX', ko: 'GX', 'zh-Hans': 'GX', 'zh-Hant': 'GX' },
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
  agency_names: {
    en: 'Bay Area Rapid Transit District',
    ja: 'ベイエリア高速鉄道',
    ko: '베이 에어리어 고속철도',
    'zh-Hans': '旧金山湾区捷运',
    'zh-Hant': '舊金山灣區捷運',
  },
  agency_short_names: { en: 'BART', ja: 'BART', ko: 'BART', 'zh-Hans': 'BART' },
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
  agency_names: {
    de: 'Berliner Verkehrsbetriebe',
    en: 'Berlin Transport Company',
    ja: 'ベルリン交通局',
    ko: '베를린 교통공사',
    'zh-Hans': '柏林交通公司',
  },
  agency_short_names: { de: 'BVG', en: 'BVG', ja: 'ベルリン交通', ko: 'BVG' },
  agency_url: 'https://bvg.example.de/',
  agency_lang: 'de',
  agency_timezone: 'Europe/Berlin',
  agency_fare_url: 'https://bvg.example.de/fare',
  agency_colors: [{ bg: 'F0D722', text: '000000' }],
};

/** Fictional UK agency — English primary language, rail-focused branding. */
export const agencyUk: Agency = {
  agency_id: 'fixture:uk',
  agency_name: 'West Midlands Railways',
  agency_short_name: 'WMR',
  agency_names: {
    en: 'West Midlands Railways',
    ja: 'ウェスト・ミッドランズ鉄道',
    de: 'West Midlands Eisenbahn',
    ko: '웨스트 미들랜즈 철도',
  },
  agency_short_names: { en: 'WMR', ja: 'WMR', de: 'WMR', ko: 'WMR' },
  agency_url: 'https://wmr.example.co.uk/',
  agency_lang: 'en',
  agency_timezone: 'Europe/London',
  agency_fare_url: 'https://wmr.example.co.uk/fares',
  agency_colors: [{ bg: '1D428A', text: 'FFFFFF' }],
};

/** Fictional Austrian agency — German primary language, lighter branding. */
export const agencyAt: Agency = {
  agency_id: 'fixture:at',
  agency_name: 'Wiener Linien Regional',
  agency_short_name: 'WLR',
  agency_names: {
    de: 'Wiener Linien Regional',
    en: 'Vienna Regional Lines',
    ja: 'ウィーン地域線',
    ko: '빈 지역 노선',
  },
  agency_short_names: { de: 'WLR', en: 'WLR', ja: 'WLR', ko: 'WLR' },
  agency_url: 'https://wlr.example.at/',
  agency_lang: 'de',
  agency_timezone: 'Europe/Vienna',
  agency_fare_url: 'https://wlr.example.at/tickets',
  agency_colors: [{ bg: 'D52B1E', text: 'FFFFFF' }],
};

/** 5-char short name (typical real example — Oretetsu Bus). */
export const agencyOretetsu: Agency = {
  agency_id: 'iyt2:0000038000143',
  agency_name: '蜜柑バス株式会社',
  agency_short_name: '蜜柑バス',
  agency_names: {
    ja: '蜜柑バス株式会社',
    en: 'Mikan Bus Co., Ltd.',
    ko: '밀감버스',
    'zh-Hans': '蜜柑巴士株式会社',
    'zh-Hant': '蜜柑巴士株式會社',
  },
  agency_short_names: {
    ja: '蜜柑バス',
    en: 'Mikan Bus',
    ko: '밀감버스',
    'zh-Hans': '蜜柑巴士',
    'zh-Hant': '蜜柑巴士',
  },
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
    ja: '都営バス',
    en: 'Toei Bus',
    'ja-Hrkt': 'とえいばす',
    ko: '도에이버스',
    'zh-Hans': '都营巴士',
    'zh-Hant': '都營巴士',
  },
  agency_short_names: {
    ja: '都バス',
    en: 'Toei',
    ko: '도에이',
    'zh-Hans': '都巴士',
    'zh-Hant': '都巴士',
  },
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
  agency_names: {
    ja: '架空都市圏高速鉄道株式会社',
    en: 'Fictional Metropolitan Rapid Railway Co., Ltd.',
    ko: '가공 도시권 고속철도 주식회사',
    'zh-Hans': '架空都市圈高速铁道株式会社',
    'zh-Hant': '架空都市圈高速鐵道株式會社',
  },
  agency_short_names: {
    ja: '架空都市圏高速鉄道',
    en: 'Fictional Metro Rapid',
    ko: '가공 도시권 고속철도',
    'zh-Hans': '架空都市圈高速铁道',
    'zh-Hant': '架空都市圈高速鐵道',
  },
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
  agency_names: {
    ja: '赤色地下鉄株式会社',
    en: 'Red Metro Co., Ltd.',
    ko: '적색 지하철 주식회사',
    'zh-Hans': '赤色地铁株式会社',
    'zh-Hant': '紅色地鐵株式會社',
  },
  agency_short_names: {
    ja: '赤色バス',
    en: 'Red Bus',
    ko: '적색 버스',
    'zh-Hans': '赤色巴士',
    'zh-Hant': '紅色巴士',
  },
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
  agency_names: {
    ja: '青色モノレール株式会社',
    en: 'Blue Monorail Co., Ltd.',
    ko: '청색 모노레일 주식회사',
    'zh-Hans': '青色单轨株式会社',
    'zh-Hant': '青色單軌株式會社',
  },
  agency_short_names: {
    ja: 'あおいろ号',
    en: 'Blue Liner',
    ko: '파란선',
    'zh-Hans': '蓝色号',
    'zh-Hant': '藍色號',
  },
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
  agency_names: {
    ja: '緑色市交通局',
    en: 'Green City Transportation Bureau',
    ko: '녹색시 교통국',
    'zh-Hans': '绿色市交通局',
    'zh-Hant': '綠色市交通局',
  },
  agency_short_names: {
    ja: '緑色市バス',
    en: 'Green City Bus',
    ko: '녹색시 버스',
    'zh-Hans': '绿色市巴士',
    'zh-Hant': '綠色市巴士',
  },
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
  agency_names: {
    ja: '黄色トラム株式会社',
    en: 'Yellow Tram Co., Ltd.',
    ko: '황색 트램 주식회사',
    'zh-Hans': '黄色电车株式会社',
    'zh-Hant': '黃色電車株式會社',
  },
  agency_short_names: {
    ja: '黄トラ',
    en: 'Yellow Tram',
    ko: '황색 트램',
    'zh-Hans': '黄电车',
    'zh-Hant': '黃電車',
  },
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
  agency_names: {
    ja: '無色バス株式会社',
    en: 'Colorless Bus Co., Ltd.',
    ko: '무색 버스 주식회사',
    'zh-Hans': '无色巴士株式会社',
    'zh-Hant': '無色巴士株式會社',
  },
  agency_short_names: {
    ja: '無色バス',
    en: 'Colorless Bus',
    ko: '무색 버스',
    'zh-Hans': '无色巴士',
    'zh-Hant': '無色巴士',
  },
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
  agencyUk,
  agencyAt,
  agencyNoColor,
];

// ---------------------------------------------------------------------------
// Routes
// ---------------------------------------------------------------------------

export const busRoute: Route = {
  route_id: 'route-001',
  route_short_name: '都02',
  route_short_names: {
    ja: '都02',
    en: 'To 02',
    ko: '도 02',
    'zh-Hans': '都02',
    'zh-Hant': '都02',
  },
  route_long_name: '大塚駅〜錦糸町駅前',
  route_long_names: {
    ja: '大塚駅〜錦糸町駅前',
    en: 'Otsuka Station - Kinshicho Station',
    ko: '오쓰카역 - 긴시초역',
    'zh-Hans': '大塚站 - 锦糸町站',
    'zh-Hant': '大塚站 - 錦糸町站',
  },
  route_type: 3,
  route_color: '1976D2',
  route_text_color: 'FFFFFF',
  agency_id: 'minkuru:8000020130001',
};

export const busRoute2: Route = {
  route_id: 'route-002',
  route_short_name: '都08',
  route_short_names: {
    ja: '都08',
    en: 'To 08',
    ko: '도 08',
    'zh-Hans': '都08',
    'zh-Hant': '都08',
  },
  route_long_name: '日暮里駅〜錦糸町駅前',
  route_long_names: {
    ja: '日暮里駅〜錦糸町駅前',
    en: 'Nippori Station - Kinshicho Station',
    ko: '닛포리역 - 긴시초역',
    'zh-Hans': '日暮里站 - 锦糸町站',
    'zh-Hant': '日暮里站 - 錦糸町站',
  },
  route_type: 3,
  route_color: '00A850',
  route_text_color: 'FFFFFF',
  agency_id: 'minkuru:8000020130001',
};

export const tramRoute: Route = {
  route_id: 'route-003',
  route_short_name: '荒川線',
  route_short_names: {
    ja: '荒川線',
    en: 'Arakawa Line',
    ko: '아라카와선',
    'zh-Hans': '荒川线',
    'zh-Hant': '荒川線',
  },
  route_long_name: '三ノ輪橋〜早稲田',
  route_long_names: {
    ja: '三ノ輪橋〜早稲田',
    en: 'Minowabashi - Waseda',
    ko: '미노와바시 - 와세다',
    'zh-Hans': '三之轮桥 - 早稻田',
    'zh-Hant': '三之輪橋 - 早稻田',
  },
  route_type: 0,
  route_color: 'E60012',
  route_text_color: 'FFFFFF',
  agency_id: 'iyt2:0000038000143',
};

export const noColorRoute: Route = {
  route_id: 'route-004',
  route_short_name: 'A5',
  route_short_names: {
    ja: 'A5',
    en: 'A5',
    ko: 'A5',
    'zh-Hans': 'A5',
    'zh-Hant': 'A5',
  },
  route_long_name: '',
  route_long_names: {
    ja: '',
    en: 'Airport Connector',
    ko: '공항 연결선',
    'zh-Hans': '机场联络线',
    'zh-Hant': '機場聯絡線',
  },
  route_type: 3,
  route_color: '',
  route_text_color: '',
  agency_id: 'nocolor:0000000000000',
};

/** Subway line — short name only. */
export const subwayRoute: Route = {
  route_id: 'route-005',
  route_short_name: 'E',
  route_short_names: {
    ja: 'E',
    en: 'E',
    ko: 'E',
    'zh-Hans': 'E',
    'zh-Hant': 'E',
  },
  route_long_name: '大江戸線',
  route_long_names: {
    ja: '大江戸線',
    en: 'Oedo Line',
    ko: '오에도선',
    'zh-Hans': '大江户线',
    'zh-Hant': '大江戶線',
  },
  route_type: 1,
  route_color: 'B6007A',
  route_text_color: 'FFFFFF',
  agency_id: 'fixture:purple',
};

/** Rail line. */
export const railRoute: Route = {
  route_id: 'route-006',
  route_short_name: 'TX',
  route_short_names: {
    ja: 'TX',
    en: 'TX',
    ko: 'TX',
    'zh-Hans': 'TX',
    'zh-Hant': 'TX',
  },
  route_long_name: 'つくばエクスプレス',
  route_long_names: {
    ja: 'つくばエクスプレス',
    en: 'Tsukuba Express',
    ko: '쓰쿠바 익스프레스',
    'zh-Hans': '筑波快线',
    'zh-Hant': '筑波快線',
  },
  route_type: 2,
  route_color: '003B83',
  route_text_color: 'FFFFFF',
  agency_id: 'mir:0000020001320',
};

/** US bus route. */
export const usRoute: Route = {
  route_id: 'route-007',
  route_short_name: 'BART',
  route_short_names: {
    ja: 'BART',
    en: 'BART',
    ko: 'BART',
    'zh-Hans': 'BART',
    'zh-Hant': 'BART',
  },
  route_long_name: 'Richmond - Millbrae',
  route_long_names: {
    en: 'Richmond - Millbrae',
    ja: 'リッチモンド - ミルブレー',
    ko: '리치먼드 - 밀브레이',
    'zh-Hans': '里士满 - 密尔布雷',
    'zh-Hant': '里奇蒙 - 密爾布雷',
  },
  route_type: 1,
  route_color: '0060A9',
  route_text_color: 'FFFFFF',
  agency_id: 'fixture:us',
};

/** German tram route. */
export const deRoute: Route = {
  route_id: 'route-008',
  route_short_name: 'M10',
  route_short_names: {
    ja: 'M10',
    en: 'M10',
    de: 'M10',
    ko: 'M10',
    'zh-Hans': 'M10',
    'zh-Hant': 'M10',
  },
  route_long_name: 'Warschauer Str. - Nordbahnhof',
  route_long_names: {
    de: 'Warschauer Str. - Nordbahnhof',
    en: 'Warschauer Str. - Nordbahnhof',
    ja: 'ワルシャウアー通り - ノルトバーンホーフ',
    ko: '바르샤우어 슈트라세 - 노르트반호프',
    'zh-Hans': '华沙大街 - 北站',
    'zh-Hant': '華沙大街 - 北站',
  },
  route_type: 0,
  route_color: 'F0D722',
  route_text_color: '000000',
  agency_id: 'fixture:de',
};

/** Green bus route. */
export const greenBusRoute: Route = {
  route_id: 'route-009',
  route_short_name: '緑01',
  route_short_names: {
    ja: '緑01',
    en: 'Green 01',
    ko: '녹 01',
    'zh-Hans': '绿01',
    'zh-Hant': '綠01',
  },
  route_long_name: '緑色市役所〜中央公園',
  route_long_names: {
    ja: '緑色市役所〜中央公園',
    en: 'Green City Hall - Central Park',
    ko: '녹색 시청 - 중앙공원',
    'zh-Hans': '绿色市政府 - 中央公园',
    'zh-Hant': '綠色市政府 - 中央公園',
  },
  route_type: 3,
  route_color: '138060',
  route_text_color: 'FFFFFF',
  agency_id: 'fixture:green',
};

/** Red bus route. */
export const redBusRoute: Route = {
  route_id: 'route-010',
  route_short_name: '赤02',
  route_short_names: {
    ja: '赤02',
    en: 'Red 02',
    ko: '적 02',
    'zh-Hans': '赤02',
    'zh-Hant': '紅02',
  },
  route_long_name: '赤色駅〜港',
  route_long_names: {
    ja: '赤色駅〜港',
    en: 'Red Station - Harbor',
    ko: '붉은역 - 항구',
    'zh-Hans': '赤色站 - 港口',
    'zh-Hant': '紅色站 - 港口',
  },
  route_type: 3,
  route_color: 'E60013',
  route_text_color: 'FFFFFF',
  agency_id: 'fixture:red',
};

/** All routes for multi-route scenarios. */
export const allRoutes: Route[] = [
  busRoute,
  busRoute2,
  tramRoute,
  noColorRoute,
  subwayRoute,
  railRoute,
  usRoute,
  deRoute,
  greenBusRoute,
  redBusRoute,
];

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

/** Long stop name with 6-language support and all optional fields populated. */
export const longNameStop: Stop = {
  ...baseStop,
  stop_id: 'stop-long',
  stop_name: '東京都立産業技術研究センター前',
  location_type: 0,
  wheelchair_boarding: 1,
  parent_station: 'station-001',
  platform_code: '2',
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
// Stats & Geo
// ---------------------------------------------------------------------------

/** Sample stats for a moderately busy bus stop. */
export const sampleStats: StopWithMeta['stats'] = {
  freq: 42,
  routeCount: 3,
  routeTypeCount: 1,
  earliestDeparture: 330, // 5:30
  latestDeparture: 1390, // 23:10
};

/** Sample geo metrics. */
export const sampleGeo: StopWithContext['geo'] = {
  nearestRoute: 0.12,
  walkablePortal: 0.35,
  connectivity: {
    ho: { routeCount: 5, freq: 120, stopCount: 3 },
  },
};

// ---------------------------------------------------------------------------
// Timetable entries
// ---------------------------------------------------------------------------

export const emptyHeadsign: TranslatableText = {
  name: '',
  names: {},
};

export const headsignOtsukaEkimae: TranslatableText = {
  name: '大塚駅前',
  names: {
    ja: '大塚駅前',
    'ja-Hrkt': 'おおつかえきまえ',
    en: 'Otsuka Sta.',
    ko: '오쓰카역앞',
    'zh-Hans': '大塚站前',
    'zh-Hant': '大塚站前',
  },
};

export const headsignNakano: TranslatableText = {
  name: '中野駅',
  names: {
    ja: '中野駅',
    'ja-Hrkt': 'なかのえき',
    en: 'Nakano Sta.',
    ko: '나카노역',
    'zh-Hans': '中野站',
    'zh-Hant': '中野站',
  },
};

export const headsignShinjuku: TranslatableText = {
  name: '新宿',
  names: {
    ja: '新宿',
    'ja-Hrkt': 'しんじゅく',
    en: 'Shinjuku',
    ko: '신주쿠',
    'zh-Hans': '新宿',
    'zh-Hant': '新宿',
  },
};

export const headsignShimbashiEkimae: TranslatableText = {
  name: '新橋駅前',
  names: {
    ja: '新橋駅前',
    'ja-Hrkt': 'しんばしえきまえ',
    en: 'Shimbashi Sta.',
    ko: '신바시역앞',
    'zh-Hans': '新桥站前',
    'zh-Hant': '新橋站前',
  },
};

export const headsignMinowabashi: TranslatableText = {
  name: '三ノ輪橋',
  names: {
    ja: '三ノ輪橋',
    'ja-Hrkt': 'みのわばし',
    en: 'Minowabashi',
    ko: '미노와바시',
    'zh-Hans': '三之轮桥',
    'zh-Hant': '三之輪橋',
  },
};

export const headsignWaseda: TranslatableText = {
  name: '早稲田',
  names: {
    ja: '早稲田',
    'ja-Hrkt': 'わせだ',
    en: 'Waseda',
    ko: '와세다',
    'zh-Hans': '早稻田',
    'zh-Hant': '早稻田',
  },
};

export const headsignEkimae: TranslatableText = {
  name: '駅前',
  names: {
    ja: '駅前',
    'ja-Hrkt': 'えきまえ',
    en: 'Station Front',
    ko: '역앞',
    'zh-Hans': '站前',
    'zh-Hant': '站前',
  },
};

export const headsignShakomae: TranslatableText = {
  name: '車庫前',
  names: {
    ja: '車庫前',
    'ja-Hrkt': 'しゃこまえ',
    en: 'Depot',
    ko: '차고앞',
    'zh-Hans': '车库前',
    'zh-Hant': '車庫前',
  },
};

export const headsignKyotoLong: TranslatableText = {
  name: '北大路バスターミナル・下鴨神社・出町柳駅',
  names: {
    ja: '北大路バスターミナル・下鴨神社・出町柳駅',
    'ja-Hrkt': 'きたおおじバスターミナル・しもがもじんじゃ・でまちやなぎえき',
    en: 'Kitaoji Bus Terminal via Shimogamo Shrine & Demachiyanagi Sta.',
    ko: '기타오지 버스 터미널・시모가모 신사・데마치야나기역',
    'zh-Hans': '北大路公交总站・下鸭神社・出町柳站',
    'zh-Hant': '北大路公交總站・下鴨神社・出町柳站',
  },
};

export const headsignKyotoLongShortJa: TranslatableText = {
  name: '北大路BT・下鴨神社・出町柳駅',
  names: {
    ja: '北大路BT・下鴨神社・出町柳駅',
    en: 'Demachiyanagi Sta. via Kitaoji BT and Shimogamo-jinja',
  },
};

export const stopHeadsignDemachiyanagi: TranslatableText = {
  name: '出町柳駅',
  names: {
    ja: '出町柳駅',
    'ja-Hrkt': 'でまちやなぎえき',
    en: 'Demachiyanagi Sta.',
    ko: '데마치야나기역',
    'zh-Hans': '出町柳站',
    'zh-Hant': '出町柳站',
  },
};

export const stopHeadsignMusashiKoganeiSouth: TranslatableText = {
  name: '武蔵小金井駅南口',
  names: {
    ja: '武蔵小金井駅南口',
    'ja-Hrkt': 'むさしこがねいえきみなみぐち',
    en: 'Musashi-Koganei Sta. South Exit',
    ko: '무사시코가네이역 남쪽 출구',
    'zh-Hans': '武藏小金井站南口',
    'zh-Hant': '武藏小金井站南口',
  },
};

/** Default service date for stories. */
export const storyServiceDate = new Date('2026-03-30T00:00:00');

/** Default "now" for stories — 14:25, 5 minutes before the default 14:30 departure. */
export const storyNow = new Date('2026-03-30T14:25:00');

/** Map center ~235m south-west of the base stop. */
export const storyMapCenter = { lat: 35.6939, lng: 139.8118 };

/**
 * Create a RouteDirection fixture for stories.
 *
 * @param overrides - Partial route direction fields to override.
 * @returns A RouteDirection with shared default route/headsign values.
 */
export function createRouteDirection(
  overrides: Partial<{
    route: Route;
    tripHeadsign: TranslatableText;
    stopHeadsign: TranslatableText;
    direction: 0 | 1;
  }> = {},
): RouteDirection {
  return {
    route: overrides.route ?? busRoute,
    tripHeadsign: overrides.tripHeadsign ?? headsignOtsukaEkimae,
    ...(overrides.stopHeadsign != null ? { stopHeadsign: overrides.stopHeadsign } : {}),
    direction: overrides.direction,
  };
}

export function createEntry(
  overrides: Partial<{
    departureMinutes: number;
    arrivalMinutes: number;
    route: Route;
    headsign: string;
    tripHeadsign: TranslatableText;
    stopHeadsign: TranslatableText;
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
    routeDirection: createRouteDirection({
      route: overrides.route,
      tripHeadsign:
        overrides.tripHeadsign ??
        (overrides.headsign != null ? { name: overrides.headsign, names: {} } : undefined),
      stopHeadsign: overrides.stopHeadsign,
      direction: overrides.direction,
    }),
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
