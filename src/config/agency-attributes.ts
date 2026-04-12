/**
 * App-side agency display attributes.
 *
 * Provides display names (long/short) and brand colors for each agency.
 * These are NOT derived from GTFS/ODPT data — they are curated by the
 * app for display purposes. The pipeline outputs only data-source fields
 * (AgencyV2Json); display attributes are merged in mergeSourcesV2.
 *
 * Keys are prefixed agency_id (e.g. "sbbus:6013301006270").
 */

export interface AgencyAttributes {
  /** Long display name (multilingual). */
  longName: Record<string, string>;
  /** Short display name (multilingual). */
  shortName: Record<string, string>;
  /** Brand colors. [0]=primary, [1]=secondary, etc. */
  colors: { bg: string; text: string }[];
}

export const AGENCY_ATTRIBUTES: Record<string, AgencyAttributes> = {
  // --- ACTV (Venice) ---
  'actvnav:ACTV': {
    longName: { ja: 'Azienda Veneziana della Mobilità', en: 'Azienda Veneziana della Mobilità' },
    shortName: { ja: 'ACTV', en: 'ACTV' },
    colors: [{ bg: '009FE3', text: 'FFFFFF' } /* ACTV Blue */],
  },

  // --- Edo Bus (Chuo City) ---
  'edobus:6011801011369': {
    longName: { ja: '中央区役所', en: 'Chuo City Office' },
    shortName: { ja: '江戸バス', en: 'Edo Bus' },
    colors: [{ bg: '1A3282', text: 'FFFFFF' }],
  },

  // --- Iyotetsu Bus ---
  'iyt2:9500001020509': {
    longName: { ja: '伊予鉄バス株式会社', en: 'Iyotetsu Bus Co., Ltd.' },
    shortName: { ja: '伊予鉄バス', en: 'Iyotetsu Bus' },
    colors: [{ bg: 'EB6100', text: 'FFFFFF' }],
  },

  // --- Kazaguruma (Chiyoda City) ---
  'kazag:6011801011369': {
    longName: { ja: '日立自動車交通株式会社', en: 'Hitachi Automobile Transportation Co., Ltd.' },
    shortName: { ja: '風ぐるま', en: 'Kazaguruma' },
    colors: [{ bg: 'E94185', text: 'FFFFFF' }],
  },

  // --- K-bus (Kita City) ---
  'kbus:6011801011369': {
    longName: { ja: '日立自動車交通株式会社', en: 'Hitachi Automobile Transportation Co., Ltd.' },
    shortName: { ja: 'Kバス', en: 'K-bus' },
    colors: [{ bg: 'D67BA3', text: 'FFFFFF' }],
  },

  // --- Kyoto City Bus ---
  'kcbus:2000020261009': {
    longName: { ja: '京都市交通局', en: 'Kyoto Municipal Transportation' },
    shortName: { ja: '京都市バス', en: 'Kyoto City Bus' },
    colors: [{ bg: '138060', text: 'FFFFFF' }],
  },

  // --- Keio Bus ---
  'kobus:9013401002381': {
    longName: { ja: '京王電鉄バス株式会社', en: 'Keio Dentetsu Bus Co., Ltd.' },
    shortName: { ja: '京王バス', en: 'Keio Bus' },
    colors: [
      { bg: '00377E', text: 'FFFFFF' } /* Primary */,
      { bg: 'C8006B', text: 'FFFFFF' } /* Secondary */,
    ],
  },

  // --- Keisei Transit Bus ---
  'kseiw:4040001028454': {
    longName: { ja: '京成バス千葉ウエスト株式会社', en: 'Keisei Transit Bus Co., Ltd.' },
    shortName: { ja: '京成千葉W', en: 'Keisei Transit Bus' },
    colors: [
      { bg: 'E82826', text: 'FFFFFF' } /* Primary */,
      { bg: '16479F', text: 'FFFFFF' } /* Secondary */,
    ],
  },

  // --- Kanto Bus ---
  'ktbus:8011201001183': {
    longName: { ja: '関東バス株式会社', en: 'Kanto Bus Corporation' },
    shortName: { ja: '関東バス', en: 'Kanto Bus' },
    colors: [
      { bg: 'E60013', text: 'FFFFFF' } /* Primary */,
      { bg: '035F8C', text: 'FFFFFF' } /* Secondary */,
    ],
  },

  // --- Toei Bus (Minkuru) ---
  'minkuru:8000020130001': {
    longName: { ja: '東京都交通局', en: 'Bureau of Transportation, Tokyo Metropolitan Government' },
    shortName: { ja: '都バス', en: 'Toei Bus' },
    colors: [{ bg: '009f40', text: 'FFFFFF' }],
  },

  // --- Tsukuba Express ---
  'mir:mir': {
    longName: { ja: '首都圏新都市鉄道株式会社', en: 'Metropolitan Intercity Railway Company' },
    shortName: { ja: 'TX', en: 'Tsukuba Express' },
    colors: [{ bg: '003B83', text: 'FFFFFF' }],
  },

  // --- Miyake Village Bus ---
  'mykbus:4000020133817': {
    longName: { ja: '三宅村', en: 'Miyake Village' },
    shortName: { ja: '三宅村営バス', en: 'Miyake Village Bus' },
    colors: [{ bg: '2E81E1', text: 'FFFFFF' }],
  },

  // --- Nagoya SRT ---
  'nsrt:3000020231002': {
    longName: { ja: '名古屋市住宅都市局', en: 'Nagoya Housing & City Planning Bureau' },
    shortName: { ja: 'SRT名古屋', en: 'Nagoya SRT' },
    colors: [{ bg: 'B7A66D', text: 'FFFFFF' }],
  },

  // --- Oshima Bus ---
  'osmbus:1010001131230': {
    longName: { ja: '大島旅客自動車株式会社', en: 'Oshima Passenger Car Co., Ltd.' },
    shortName: { ja: '大島バス', en: 'Oshima Bus' },
    colors: [{ bg: 'FDD23D', text: '0099FF' }],
  },

  // --- Seibu Kanko Bus ---
  'sbbus:3013301006265': {
    longName: { ja: '西武観光バス株式会社', en: 'Seibu Kanko Bus Co., Ltd.' },
    shortName: { ja: '西武観光バス', en: 'Seibu Kanko Bus' },
    colors: [
      { bg: '0076BB', text: 'FFFFFF' } /* Seibu Blue (primary) */,
      { bg: '0090C4', text: 'FFFFFF' } /* Seibu Light Blue */,
      { bg: '27AA6D', text: 'FFFFFF' } /* Seibu Green */,
    ],
  },

  // --- Seibu Bus ---
  'sbbus:6013301006270': {
    longName: { ja: '西武バス株式会社', en: 'Seibu Bus Co., Ltd.' },
    shortName: { ja: '西武バス', en: 'Seibu Bus' },
    colors: [
      { bg: '0076BB', text: 'FFFFFF' } /* Seibu Blue (primary) */,
      { bg: '0090C4', text: 'FFFFFF' } /* Seibu Light Blue */,
      { bg: '27AA6D', text: 'FFFFFF' } /* Seibu Green */,
    ],
  },

  // --- Sugimaru (Suginami City) ---
  'sggsm:8000020131156': {
    longName: { ja: '杉並区', en: 'Suginami City' },
    shortName: { ja: 'すぎ丸', en: 'Sugimaru' },
    colors: [{ bg: '009B63', text: 'FFFFFF' }],
  },

  // --- Toei (train/tram) ---
  'toaran:toei': {
    longName: { ja: '東京都交通局', en: 'Bureau of Transportation, Tokyo Metropolitan Government' },
    shortName: { ja: '都営交通', en: 'Toei' },
    colors: [{ bg: '009f40', text: 'FFFFFF' }],
  },

  // --- VAG Freiburg ---
  'vagfr:1': {
    longName: {
      ja: 'Freiburger Verkehrs AG',
      en: 'Freiburger Verkehrs AG',
      de: 'Freiburger Verkehrs AG',
    },
    shortName: { ja: 'VAG Freiburg', en: 'VAG Freiburg', de: 'VAG Freiburg' },
    colors: [
      { bg: 'E2001A', text: 'FFFFFF' } /* VAG Red (primary) */,
      { bg: '78B833', text: 'FFFFFF' } /* Eco Green (secondary) */,
    ],
  },

  // --- Tuniberg Express ---
  'vagfr:3': {
    longName: { ja: 'Tuniberg Express', en: 'Tuniberg Express', de: 'Tuniberg Express' },
    shortName: { ja: 'Tuniberg Express', en: 'Tuniberg Express', de: 'Tuniberg Express' },
    colors: [
      { bg: 'E2001A', text: 'FFFFFF' } /* VAG Red (primary) */,
      { bg: '78B833', text: 'FFFFFF' } /* Eco Green (secondary) */,
    ],
  },

  // --- Yurikamome ---
  'yurimo:Yurikamome': {
    longName: { ja: 'ゆりかもめ', en: 'Yurikamome' },
    shortName: { ja: 'ゆりかもめ', en: 'Yurikamome' },
    colors: [{ bg: '1662B8', text: 'FFFFFF' } /* Primary */],
  },
};
