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
  agency_long_name: '首都圏新都市鉄道株式会社',
  agency_short_name: 'GX',
  agency_names: {
    ja: '首都圏新都市鉄道',
    'ja-Hrkt': 'しゅとけんしんとしてつどう',
    en: 'Metropolitan Intercity Railway',
    ko: '수도권 신도시 철도',
    'zh-Hans': '首都圈新都市铁道',
    'zh-Hant': '首都圈新都市鐵道',
    fr: 'Chemin de fer interurbain métropolitain',
    es: 'Ferrocarril Interurbano Metropolitano',
  },
  agency_long_names: {
    ja: '首都圏新都市鉄道株式会社',
    'ja-Hrkt': 'しゅとけんしんとしてつどうかぶしきがいしゃ',
    en: 'Metropolitan Intercity Railway Company, Limited',
    ko: '수도권 신도시 철도 주식회사',
    'zh-Hans': '首都圈新都市铁道株式会社',
    'zh-Hant': '首都圈新都市鐵道株式會社',
  },
  agency_short_names: {
    ja: 'GX',
    'ja-Hrkt': 'GX',
    en: 'GX',
    ko: 'GX',
    'zh-Hans': 'GX',
    'zh-Hant': 'GX',
  },
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
  agency_long_name: 'San Francisco Bay Area Rapid Transit District',
  agency_short_name: 'BART',
  agency_names: {
    en: 'Bay Area Rapid Transit District',
    ja: 'ベイエリア高速鉄道',
    'ja-Hrkt': 'べいえりあこうそくてつどう',
    ko: '베이 에어리어 고속철도',
    'zh-Hans': '旧金山湾区捷运',
    'zh-Hant': '舊金山灣區捷運',
    de: 'Bay Area Rapid Transit Bezirk',
    fr: 'District de transit rapide de la baie',
    es: 'Distrito de Tránsito Rápido del Área de la Bahía',
  },
  agency_long_names: {
    en: 'San Francisco Bay Area Rapid Transit District',
    ja: 'サンフランシスコ・ベイエリア高速鉄道地区',
    'ja-Hrkt': 'さんふらんしすこ・べいえりあこうそくてつどうちく',
    ko: '샌프란시스코 베이 에어리어 고속철도 특별구',
    'zh-Hans': '旧金山湾区捷运特别区',
    'zh-Hant': '舊金山灣區捷運特別區',
    de: 'San Francisco Bay Area Rapid Transit Bezirk',
    fr: 'District de transit rapide de la région de la baie de San Francisco',
    es: 'Distrito de Tránsito Rápido del Área de la Bahía de San Francisco',
  },
  agency_short_names: {
    en: 'BART',
    ja: 'BART',
    'ja-Hrkt': 'BART',
    ko: 'BART',
    'zh-Hans': 'BART',
    'zh-Hant': 'BART',
    de: 'BART',
    fr: 'BART',
    es: 'BART',
  },
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
  agency_long_name: 'Berliner Verkehrsbetriebe AöR',
  agency_short_name: 'BVG',
  agency_names: {
    de: 'Berliner Verkehrsbetriebe',
    en: 'Berlin Transport Company',
    ja: 'ベルリン交通局',
    'ja-Hrkt': 'べるりんこうつうきょく',
    ko: '베를린 교통공사',
    'zh-Hans': '柏林交通公司',
    'zh-Hant': '柏林交通公司',
    fr: 'Société des transports de Berlin',
    es: 'Empresa de Transportes de Berlín',
  },
  agency_long_names: {
    de: 'Berliner Verkehrsbetriebe AöR',
    en: 'Berlin Transport Company (public institution)',
    ja: 'ベルリン交通局 (公法上の機関)',
    'ja-Hrkt': 'べるりんこうつうきょく',
    ko: '베를린 교통공사',
    'zh-Hans': '柏林交通公司 (公法機構)',
    'zh-Hant': '柏林交通公司 (公法機構)',
    fr: 'Société des transports de Berlin (établissement public)',
    es: 'Empresa de Transportes de Berlín (entidad pública)',
  },
  agency_short_names: {
    de: 'BVG',
    en: 'BVG',
    ja: 'ベルリン交通',
    'ja-Hrkt': 'べるりんこうつう',
    ko: 'BVG',
    'zh-Hans': 'BVG',
    'zh-Hant': 'BVG',
    fr: 'BVG',
    es: 'BVG',
  },
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
  agency_long_name: 'West Midlands Railways Limited',
  agency_short_name: 'WMR',
  agency_names: {
    en: 'West Midlands Railways',
    ja: 'ウェスト・ミッドランズ鉄道',
    'ja-Hrkt': 'うぇすと・みっどらんずてつどう',
    de: 'West Midlands Eisenbahn',
    ko: '웨스트 미들랜즈 철도',
    'zh-Hans': '西米德兰铁路',
    'zh-Hant': '西米德蘭鐵路',
    fr: 'Chemins de fer des Midlands de l’Ouest',
    es: 'Ferrocarriles de West Midlands',
  },
  agency_long_names: {
    en: 'West Midlands Railways Limited',
    ja: 'ウェスト・ミッドランズ鉄道株式会社',
    'ja-Hrkt': 'うぇすと・みっどらんずてつどうかぶしきがいしゃ',
    de: 'West Midlands Eisenbahn GmbH',
    ko: '웨스트 미들랜즈 철도 유한회사',
    'zh-Hans': '西米德兰铁路有限公司',
    'zh-Hant': '西米德蘭鐵路有限公司',
    fr: 'Chemins de fer des Midlands de l’Ouest Limited',
    es: 'Ferrocarriles de West Midlands Limited',
  },
  agency_short_names: {
    en: 'WMR',
    ja: 'WMR',
    'ja-Hrkt': 'WMR',
    de: 'WMR',
    ko: 'WMR',
    'zh-Hans': 'WMR',
    'zh-Hant': 'WMR',
    fr: 'WMR',
    es: 'WMR',
  },
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
  agency_long_name: 'Wiener Linien Regional GmbH',
  agency_short_name: 'WLR',
  agency_names: {
    de: 'Wiener Linien Regional',
    en: 'Vienna Regional Lines',
    ja: 'ウィーン地域線',
    'ja-Hrkt': 'うぃーんちいきせん',
    ko: '빈 지역 노선',
    'zh-Hans': '维也纳地区线',
    'zh-Hant': '維也納地區線',
    fr: 'Lignes régionales de Vienne',
    es: 'Líneas Regionales de Viena',
  },
  agency_long_names: {
    de: 'Wiener Linien Regional GmbH',
    en: 'Vienna Regional Public Transport Ltd.',
    ja: 'ウィーン地域公共交通有限会社',
    'ja-Hrkt': 'うぃーんちいきこうきょうこうつうゆうげんがいしゃ',
    ko: '빈 지역 공공 교통 유한회사',
    'zh-Hans': '维也纳地区公共交通有限公司',
    'zh-Hant': '維也納地區公共交通有限公司',
    fr: 'Transports publics régionaux de Vienne SARL',
    es: 'Transporte Público Regional de Viena S.L.',
  },
  agency_short_names: {
    de: 'WLR',
    en: 'WLR',
    ja: 'WLR',
    'ja-Hrkt': 'WLR',
    ko: 'WLR',
    'zh-Hans': 'WLR',
    'zh-Hant': 'WLR',
    fr: 'WLR',
    es: 'WLR',
  },
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
  agency_long_name: '蜜柑バス株式会社',
  agency_short_name: '蜜柑バス',
  agency_names: {
    ja: '蜜柑バス株式会社',
    'ja-Hrkt': 'みかんばすかぶしきがいしゃ',
    en: 'Mikan Bus Co., Ltd.',
    ko: '밀감버스',
    'zh-Hans': '蜜柑巴士株式会社',
    'zh-Hant': '蜜柑巴士株式會社',
  },
  agency_long_names: {
    ja: '蜜柑バス株式会社',
    'ja-Hrkt': 'みかんばすかぶしきがいしゃ',
    en: 'Mikan Bus Company, Limited',
    ko: '밀감버스 주식회사',
    'zh-Hans': '蜜柑巴士株式会社',
    'zh-Hant': '蜜柑巴士株式會社',
  },
  agency_short_names: {
    ja: '蜜柑バス',
    'ja-Hrkt': 'みかんばす',
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
  agency_long_name: '東京都交通局 都営バス',
  agency_short_name: '都バス',
  agency_names: {
    ja: '都営バス',
    'ja-Hrkt': 'とえいばす',
    en: 'Toei Bus',
    ko: '도에이버스',
    'zh-Hans': '都营巴士',
    'zh-Hant': '都營巴士',
  },
  agency_long_names: {
    ja: '東京都交通局 都営バス',
    'ja-Hrkt': 'とうきょうとこうつうきょく とえいばす',
    en: 'Tokyo Metropolitan Bureau of Transportation - Toei Bus',
    ko: '도쿄도 교통국 도에이 버스',
    'zh-Hans': '东京都交通局 都营巴士',
    'zh-Hant': '東京都交通局 都營巴士',
  },
  agency_short_names: {
    ja: '都バス',
    'ja-Hrkt': 'とばす',
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
  agency_long_name: '架空都市圏高速鉄道株式会社',
  agency_short_name: '架空都市圏高速鉄道',
  agency_names: {
    ja: '架空都市圏高速鉄道株式会社',
    'ja-Hrkt': 'かくうとしけんこうそくてつどうかぶしきがいしゃ',
    en: 'Fictional Metropolitan Rapid Railway Co., Ltd.',
    ko: '가공 도시권 고속철도 주식회사',
    'zh-Hans': '架空都市圈高速铁道株式会社',
    'zh-Hant': '架空都市圈高速鐵道株式會社',
    fr: 'Chemin de fer rapide métropolitain fictif S.A.',
    es: 'Ferrocarril Rápido Metropolitano Ficticio S.A.',
  },
  agency_long_names: {
    ja: '架空都市圏高速鉄道株式会社',
    'ja-Hrkt': 'かくうとしけんこうそくてつどうかぶしきがいしゃ',
    en: 'Fictional Metropolitan Rapid Railway Company, Limited',
    ko: '가공 도시권 고속철도 주식회사',
    'zh-Hans': '架空都市圈高速铁道株式会社',
    'zh-Hant': '架空都市圈高速鐵道株式會社',
    fr: 'Société de Chemin de fer Rapide Métropolitain Fictif',
    es: 'Sociedad Anónima del Ferrocarril Rápido Metropolitano Ficticio',
  },
  agency_short_names: {
    ja: '架空都市圏高速鉄道',
    'ja-Hrkt': 'かくうとしけんこうそくてつどう',
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
  agency_long_name: '赤色地下鉄株式会社',
  agency_short_name: '赤色バス',
  agency_names: {
    ja: '赤色地下鉄株式会社',
    'ja-Hrkt': 'あかいろちかてつかぶしきがいしゃ',
    en: 'Red Metro Co., Ltd.',
    ko: '적색 지하철 주식회사',
    'zh-Hans': '赤色地铁株式会社',
    'zh-Hant': '紅色地鐵株式會社',
  },
  agency_long_names: {
    ja: '赤色地下鉄株式会社',
    'ja-Hrkt': 'あかいろちかてつかぶしきがいしゃ',
    en: 'Red Subway Company, Limited',
    ko: '적색 지하철 주식회사',
    'zh-Hans': '赤色地铁株式会社',
    'zh-Hant': '紅色地鐵株式會社',
  },
  agency_short_names: {
    ja: '赤色バス',
    'ja-Hrkt': 'あかいろばす',
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
  agency_long_name: '青色モノレール株式会社',
  agency_short_name: 'あおいろ号',
  agency_names: {
    ja: '青色モノレール株式会社',
    'ja-Hrkt': 'あおいろものれーるかぶしきがいしゃ',
    en: 'Blue Monorail Co., Ltd.',
    ko: '청색 모노레일 주식회사',
    'zh-Hans': '青色单轨株式会社',
    'zh-Hant': '青色單軌株式會社',
  },
  agency_long_names: {
    ja: '青色モノレール株式会社',
    'ja-Hrkt': 'あおいろものれーるかぶしきがいしゃ',
    en: 'Blue Monorail Company, Limited',
    ko: '청색 모노레일 주식회사',
    'zh-Hans': '青色单轨株式会社',
    'zh-Hant': '青色單軌株式會社',
  },
  agency_short_names: {
    ja: 'あおいろ号',
    'ja-Hrkt': 'あおいろごう',
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
  agency_long_name: '緑色市交通局',
  agency_short_name: '緑色市バス',
  agency_names: {
    ja: '緑色市交通局',
    'ja-Hrkt': 'みどりいろしこうつうきょく',
    en: 'Green City Transportation Bureau',
    ko: '녹색시 교통국',
    'zh-Hans': '绿色市交通局',
    'zh-Hant': '綠色市交通局',
  },
  agency_long_names: {
    ja: '緑色市交通局',
    'ja-Hrkt': 'みどりいろしこうつうきょく',
    en: 'Green City Bureau of Transportation',
    ko: '녹색시 교통국',
    'zh-Hans': '绿色市交通局',
    'zh-Hant': '綠色市交通局',
  },
  agency_short_names: {
    ja: '緑色市バス',
    'ja-Hrkt': 'みどりいろしばす',
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
  agency_long_name: '黄色トラム株式会社',
  agency_short_name: '黄トラ',
  agency_names: {
    ja: '黄色トラム株式会社',
    'ja-Hrkt': 'きいろとらむかぶしきがいしゃ',
    en: 'Yellow Tram Co., Ltd.',
    ko: '황색 트램 주식회사',
    'zh-Hans': '黄色电车株式会社',
    'zh-Hant': '黃色電車株式會社',
  },
  agency_long_names: {
    ja: '黄色トラム株式会社',
    'ja-Hrkt': 'きいろとらむかぶしきがいしゃ',
    en: 'Yellow Tram Company, Limited',
    ko: '황색 트램 주식회사',
    'zh-Hans': '黄色电车株式会社',
    'zh-Hant': '黃色電車株式會社',
  },
  agency_short_names: {
    ja: '黄トラ',
    'ja-Hrkt': 'きとら',
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
  agency_long_name: '無色バス株式会社',
  agency_short_name: '無色バス',
  agency_names: {
    ja: '無色バス株式会社',
    'ja-Hrkt': 'むしょくばすかぶしきがいしゃ',
    en: 'Colorless Bus Co., Ltd.',
    ko: '무색 버스 주식회사',
    'zh-Hans': '无色巴士株式会社',
    'zh-Hant': '無色巴士株式會社',
  },
  agency_long_names: {
    ja: '無色バス株式会社',
    'ja-Hrkt': 'むしょくばすかぶしきがいしゃ',
    en: 'Colorless Bus Company, Limited',
    ko: '무색 버스 주식회사',
    'zh-Hans': '无色巴士株式会社',
    'zh-Hant': '無色巴士株式會社',
  },
  agency_short_names: {
    ja: '無色バス',
    'ja-Hrkt': 'むしょくばす',
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
// Logical Route fixtures — length axis
// ---------------------------------------------------------------------------
//
// These routes are deliberately abstract (no real GTFS source) so
// stories exercising label wrapping / truncation don't break when
// real transit data changes. Each fixture covers every
// {@link SUPPORTED_LANGS} entry for both `route_short_names` and
// `route_long_names`, paired with a route color / text color so
// chip-style rendering has something to work with.

/**
 * Synthetic short route — 2-char `route_short_name` and a compact
 * endpoint-to-endpoint `route_long_name`. Models a typical urban
 * bus line code.
 */
export const routeShort: Route = {
  route_id: 'fixture:route-short',
  route_short_name: 'S1',
  route_short_names: {
    ja: 'S1',
    'ja-Hrkt': 'えすいち',
    en: 'S1',
    'zh-Hans': 'S1',
    'zh-Hant': 'S1',
    ko: 'S1',
    de: 'S1',
    es: 'S1',
    fr: 'S1',
  },
  route_long_name: 'Sample Line S1 — Alpha ↔ Bravo',
  route_long_names: {
    ja: 'サンプル路線 S1 アルファ ⇔ ブラボー',
    'ja-Hrkt': 'さんぷる ろせん えすいち あるふぁ ⇔ ぶらぼー',
    en: 'Sample Line S1 — Alpha ↔ Bravo',
    'zh-Hans': '样本线 S1 甲 ⇔ 乙',
    'zh-Hant': '樣本線 S1 甲 ⇔ 乙',
    ko: '샘플 노선 S1 알파 ⇔ 브라보',
    de: 'Beispiellinie S1 — Alpha ⇔ Bravo',
    es: 'Línea de Muestra S1 — Alfa ⇔ Bravo',
    fr: 'Ligne d’Exemple S1 — Alpha ⇔ Bravo',
  },
  route_type: 3,
  route_color: '1976D2',
  route_text_color: 'FFFFFF',
  agency_id: 'fixture:agency',
};

/**
 * Synthetic long route — the longer end of the length axis. Models
 * a Kyoto-city-bus / Tokyo-tram style line whose `route_long_name`
 * is a system number followed by a bullet-separated list of
 * waypoints, long enough to exercise wrapping / truncation paths
 * in every {@link SUPPORTED_LANGS} entry.
 */
export const routeLong: Route = {
  route_id: 'fixture:route-long',
  route_short_name: 'L99',
  route_short_names: {
    ja: 'L99',
    'ja-Hrkt': 'える きゅうじゅうきゅう',
    en: 'L99',
    'zh-Hans': 'L99',
    'zh-Hant': 'L99',
    ko: 'L99',
    de: 'L99',
    es: 'L99',
    fr: 'L99',
  },
  route_long_name:
    'Sample Line L99 System — Alpha Park · Bravo Station · Charlie Mall · Delta Harbor · Echo Terminal',
  route_long_names: {
    ja: 'サンプル L99 号系統 アルファ公園・ブラボー駅・チャーリー商店街・デルタ港・エコーターミナル',
    'ja-Hrkt':
      'さんぷる える きゅうじゅうきゅう ごうけいとう あるふぁ こうえん・ぶらぼー えき・ちゃーりー しょうてんがい・でるたこう・えこー たーみなる',
    en: 'Sample Line L99 System — Alpha Park · Bravo Station · Charlie Mall · Delta Harbor · Echo Terminal',
    'zh-Hans': '样本线 L99 系统 甲公园・乙站・丙商店街・丁港・戊总站',
    'zh-Hant': '樣本線 L99 系統 甲公園・乙站・丙商店街・丁港・戊總站',
    ko: '샘플 노선 L99 계통 알파공원・브라보역・찰리 상점가・델타항・에코 터미널',
    de: 'Beispiellinie L99 System — Alpha-Park · Bahnhof Bravo · Charlie-Markt · Delta-Hafen · Echo-Terminal',
    es: 'Línea de Muestra L99 Sistema — Parque Alfa · Estación Bravo · Galería Charlie · Puerto Delta · Terminal Echo',
    fr: 'Ligne d’Exemple L99 Système — Parc Alpha · Gare Bravo · Galerie Charlie · Port Delta · Terminal Echo',
  },
  route_type: 3,
  route_color: 'E60012',
  route_text_color: 'FFFFFF',
  agency_id: 'fixture:agency',
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
// Logical Stop fixtures — length axis
// ---------------------------------------------------------------------------
//
// Abstract placeholder stops in the same short/long × 9-language
// shape as `tripHeadsignShort`/`tripHeadsignLong` and
// `routeShort`/`routeLong`. Use these when the story cares about
// the logical length category rather than any specific real stop.

/**
 * Synthetic short stop — a compact stop name at the shorter end of
 * typical transit data. Covers every {@link SUPPORTED_LANGS} entry.
 */
export const stopShort: Stop = {
  stop_id: 'fixture:stop-short',
  stop_name: 'Alpha Park Stop',
  stop_names: {
    ja: 'アルファ公園前',
    'ja-Hrkt': 'あるふぁ こうえん まえ',
    en: 'Alpha Park Stop',
    'zh-Hans': '甲公园前',
    'zh-Hant': '甲公園前',
    ko: '알파공원 앞',
    de: 'Haltestelle Alpha-Park',
    es: 'Parada Parque Alfa',
    fr: 'Arrêt Parc Alpha',
  },
  stop_lat: 35.6939,
  stop_lon: 139.8118,
  location_type: 0,
  agency_id: 'fixture:agency',
};

/**
 * Synthetic long stop — exercises wrapping / truncation paths for
 * the stop name slot. Modelled after verbose real-world entries
 * like '東京都立産業技術研究センター前' but abstracted away from
 * any real place.
 */
export const stopLong: Stop = {
  stop_id: 'fixture:stop-long',
  stop_name: 'Charlie Mall Central Entrance — East Wing Bus Stop',
  stop_names: {
    ja: 'チャーリー商店街 中央口 東棟 バス停',
    'ja-Hrkt': 'ちゃーりー しょうてんがい ちゅうおうぐち ひがしとう ばすてい',
    en: 'Charlie Mall Central Entrance — East Wing Bus Stop',
    'zh-Hans': '丙商店街 中央入口 东栋 公交站',
    'zh-Hant': '丙商店街 中央入口 東棟 公車站',
    ko: '찰리 상점가 중앙 입구 동관 버스정류장',
    de: 'Charlie-Markt Haupteingang — Ostflügel Bushaltestelle',
    es: 'Parada de Autobús Galería Charlie — Entrada Principal Ala Este',
    fr: 'Arrêt de Bus Galerie Charlie — Entrée Principale Aile Est',
  },
  stop_lat: 35.6945,
  stop_lon: 139.8122,
  location_type: 0,
  wheelchair_boarding: 1,
  agency_id: 'fixture:agency',
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

// ---------------------------------------------------------------------------
// Logical headsign fixtures — place-name independent
// ---------------------------------------------------------------------------
//
// The fixtures below are deliberately abstracted away from real-world
// place names (中野駅 / 新橋駅前 / 武蔵小金井駅南口 / ...). They exist
// to drive stories that exercise the component's *logical* handling
// of each headsign state — trip-only, stop-only, both, etc. — so the
// failure mode reads as "the trip-only branch is broken" rather than
// "the Nakano fixture broke". Use these for structural / regression
// stories; keep the named real-place fixtures above for cases where
// the visual language of actual transit data is the point.

/**
 * Synthetic long trip headsign — an obviously-fake placeholder
 * covering every {@link SUPPORTED_LANGS} entry. The value is
 * intentionally abstract (no real place name) while sized to the
 * longer end of realistic bus / train headsign character counts,
 * so layout tests exercise the wrapping and truncation paths they
 * will see in production.
 */
export const tripHeadsignLong: TranslatableText = {
  name: 'Sample Trip Destination — Alpha Park via Central Plaza',
  names: {
    ja: 'サンプル行先 アルファ公園 経由 中央広場',
    'ja-Hrkt': 'さんぷる いきさき あるふぁ こうえん けいゆ ちゅうおう ひろば',
    en: 'Sample Trip Destination — Alpha Park via Central Plaza',
    'zh-Hans': '样本 终点站 甲公园 途经 中央广场',
    'zh-Hant': '樣本 終點站 甲公園 途經 中央廣場',
    ko: '샘플 행선지 알파공원 경유 중앙광장',
    de: 'Beispielziel — Alpha-Park über Zentralplatz',
    es: 'Destino de Muestra — Parque Alfa vía Plaza Central',
    fr: 'Destination Échantillon — Parc Alpha via la Place Centrale',
  },
};

/**
 * Synthetic short trip headsign — counterpart to
 * {@link tripHeadsignLong}, intentionally shorter so stories can
 * compare headsigns of different lengths side by side.
 */
export const tripHeadsignShort: TranslatableText = {
  name: 'Sample — Bravo Station',
  names: {
    ja: 'サンプル ブラボー駅',
    'ja-Hrkt': 'さんぷる ぶらぼーえき',
    en: 'Sample — Bravo Station',
    'zh-Hans': '样本 乙站',
    'zh-Hant': '樣本 乙站',
    ko: '샘플 브라보역',
    de: 'Beispiel — Bahnhof Bravo',
    es: 'Muestra — Estación Bravo',
    fr: 'Exemple — Gare Bravo',
  },
};

/**
 * Synthetic short stop headsign — placeholder for the stop-level
 * slot so stories can tell it apart from the trip-level values
 * above. Intentionally short so stories can contrast against
 * {@link stopHeadsignLong}.
 */
export const stopHeadsignShort: TranslatableText = {
  name: 'Sub — Charlie Mall',
  names: {
    ja: '副行先 チャーリー商店街',
    'ja-Hrkt': 'ふくいきさき ちゃーりーしょうてんがい',
    en: 'Sub — Charlie Mall',
    'zh-Hans': '副终点 丙商店街',
    'zh-Hant': '副終點 丙商店街',
    ko: '부차행선 찰리 상점가',
    de: 'Unterziel — Charlie-Markt',
    es: 'Sub-destino — Galería Charlie',
    fr: 'Sous-destination — Galerie Charlie',
  },
};

/**
 * Synthetic long stop headsign — exercises the wrapping /
 * truncation paths for the stop-level slot. Includes a "via"
 * waypoint modelled after routes like the Kyoto city bus loops.
 */
export const stopHeadsignLong: TranslatableText = {
  name: 'Sub-destination — Delta Harbor via Riverside Terminal',
  names: {
    ja: '副行先 デルタ港 経由 リバーサイド ターミナル',
    'ja-Hrkt': 'ふくいきさき でるたこう けいゆ りばーさいど たーみなる',
    en: 'Sub-destination — Delta Harbor via Riverside Terminal',
    'zh-Hans': '副终点 丁港 途经 河畔总站',
    'zh-Hant': '副終點 丁港 途經 河畔總站',
    ko: '부차행선 델타항 경유 리버사이드 터미널',
    de: 'Unterziel — Delta-Hafen über Uferterminal',
    es: 'Sub-destino — Puerto Delta vía Terminal Ribereño',
    fr: 'Sous-destination — Port Delta via le Terminal Riverain',
  },
};

/** Single-character headsign — exercises minimum-length rendering. */
export const headsignShort: TranslatableText = {
  name: 'X',
  names: {
    ja: 'X',
    en: 'X',
  },
};

/**
 * Long multi-part headsign — exercises wrap / truncation / overflow
 * handling. Not a real place; the text is deliberately synthetic.
 */
export const headsignLong: TranslatableText = {
  name: 'Very Long Destination Via Many Intermediate Points',
  names: {
    ja: '非常に長い目的地 経由地点を多数含む 行先',
    'ja-Hrkt': 'ひじょうに ながい もくてきち けいゆ ちてん を たすう ふくむ いきさき',
    en: 'Very Long Destination Via Many Intermediate Points',
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

// ---------------------------------------------------------------------------
// Logical RouteDirection fixtures — headsign state axis
// ---------------------------------------------------------------------------
//
// Each fixture is a coherent RouteDirection pinned to a specific
// headsign-state combination so stories can pick "the trip-only
// case" / "the stop-only case" / "the both case" etc. without
// hand-assembling parts whose consistency can silently drift.

/**
 * Trip-only headsign: the classic case. `tripHeadsign` is populated,
 * `stopHeadsign` is absent. Covers most straightforward bus routes.
 */
export const routeDirectionHeadsignTripOnly: RouteDirection = {
  route: busRoute,
  tripHeadsign: tripHeadsignLong,
  direction: 0,
};

/**
 * Stop-only headsign: keio-bus pattern. `tripHeadsign` is empty,
 * `stopHeadsign` overrides the trip-level destination. The UI must
 * promote `stopHeadsign` to the primary label slot.
 */
export const routeDirectionHeadsignStopOnly: RouteDirection = {
  route: busRoute,
  tripHeadsign: emptyHeadsign,
  stopHeadsign: stopHeadsignShort,
  direction: 0,
};

/**
 * Both headsigns present and different. Typical when the route goes
 * to `tripHeadsignLong` but this particular stop's next service is
 * routed via `stopHeadsignShort`. The UI should show both with their
 * respective source markers (🪧 trip / 📍 stop).
 */
export const routeDirectionHeadsignBoth: RouteDirection = {
  route: busRoute,
  tripHeadsign: tripHeadsignLong,
  stopHeadsign: stopHeadsignShort,
  direction: 0,
};

/**
 * Both headsigns present but identical (redundant upstream data).
 * The UI should collapse the duplicate so the user is not shown the
 * same text twice.
 */
export const routeDirectionHeadsignBothMatching: RouteDirection = {
  route: busRoute,
  tripHeadsign: tripHeadsignLong,
  stopHeadsign: tripHeadsignLong,
  direction: 0,
};

/**
 * Neither headsign populated — data-quality worst case. The UI must
 * fall back to `route_short_name` / `route_long_name` without
 * surfacing empty strings.
 */
export const routeDirectionHeadsignNeither: RouteDirection = {
  route: busRoute,
  tripHeadsign: emptyHeadsign,
  direction: 0,
};

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
