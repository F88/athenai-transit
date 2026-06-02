import type { SourceGroup } from '../types/app/source-group';

type SinglePrefixSourceGroupInput = Omit<SourceGroup, 'prefixes'> & {
  prefix: string;
};

function createSinglePrefixSourceGroup({
  prefix,
  ...group
}: SinglePrefixSourceGroupInput): SourceGroup {
  return {
    ...group,
    prefixes: [prefix],
  };
}

// /**
//  * Development-only multi-prefix examples for manual verification.
//  *
//  * These are intentionally excluded from the exported `settings` and are
//  * kept here only as local examples while editing this file.
//  */
// const _devOnlyMultiPrefixGroupExamples: SourceGroup[] = [
//   {
//     // for dev
//     id: 'test-all-x',
//     prefixes: ['none1', 'none2', 'none3'],
//     routeTypes: [3],
//     systemEnabledByDefault: true,
//     userEnabledByDefault: true,
//     name: { name: 'test-all-x', names: { ja: 'test-all-x', en: 'test-all-x' } },
//     countries: ['JP'],
//   },
//   {
//     // for dev
//     id: 'test-partial-x',
//     prefixes: ['none1', 'kazag'],
//     routeTypes: [3],
//     systemEnabledByDefault: true,
//     userEnabledByDefault: true,
//     name: { name: 'test-partial-x', names: { ja: 'test-partial-x', en: 'test-partial-x' } },
//     countries: ['JP'],
//   },
// ];
// void _devOnlyMultiPrefixGroupExamples;

/**
 * Configured source groups for the webapp.
 *
 * See {@link SourceGroup} for the design (multi-prefix, overlapping
 * groups) and a worked bundling example.
 */
const multiPrefixGroups: SourceGroup[] = [
  {
    id: 'toko',
    prefixes: [
      'minkuru', // Toei Bus
      'toaran', // Toei Train
    ],
    routeTypes: [3, 0, 2, 1],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: '📦 Toei Transport', names: { ja: '📦 東京都交通局', en: 'Toei Transport' } },
    countries: ['JP'],
  },
  {
    id: 'tokyo-23-wards-community-bus-group',
    prefixes: [
      'kazag', // Kazaguruma (Chiyoda)
      'edobus', // Edo Bus (Chuo)
      '13103b', // Chii Bus (Minato)
      'bgle', // B-GURU (Bunkyo)
      'megurin', // Megurin (Taito)
      'shinabus', // Shina Bus (Shinagawa)
      'sanma', // Sanma Bus (Meguro)
      'tamachan', // Tamachan Bus (Ota)
      '85b', // Hachiko Bus (Shibuya)
      'sggsm', // GSM (Suginami)
      'kbus', // K-bus (Kita)
      'rin2', // Rinrin-GO (Itabashi)
    ],
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Tokyo 23 Wards Community Bus Group',
      names: { ja: '📦 東京23区コミュニティバス', en: '📦 Tokyo 23 Wards Community Bus Group' },
    },
    countries: ['JP'],
  },
];

const singlePrefixStandardGroupInputs: SinglePrefixSourceGroupInput[] = [
  {
    id: 'actv-nav',
    prefix: 'actvnav',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'ACTV', names: { ja: 'ACTV', en: 'ACTV', it: 'ACTV' } },
    countries: ['IT'],
  },
  {
    id: 'iyotetsu-bus',
    prefix: 'iyt2',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Iyotetsu Bus', names: { ja: '伊予鉄バス', en: 'Iyotetsu Bus' } },
    countries: ['JP'],
  },
  {
    id: 'kanto-bus',
    prefix: 'ktbus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Kanto Bus', names: { ja: '関東バス', en: 'Kanto Bus' } },
    countries: ['JP'],
  },
  {
    id: 'kawasaki-city-bus',
    prefix: 'norufin',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Kawasaki City Bus',
      names: { ja: '川崎市バス', en: 'Kawasaki City Bus' },
    },
    countries: ['JP'],
  },
  {
    id: 'keio-bus',
    prefix: 'kobus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Keio Bus', names: { ja: '京王バス', en: 'Keio Bus' } },
    countries: ['JP'],
  },
  {
    id: 'keisei-transit-bus',
    prefix: 'kseiw',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: { name: 'Keisei Transit Bus', names: { ja: '京成千葉W', en: 'Keisei Transit Bus' } },
    countries: ['JP'],
  },
  {
    id: 'kyoto-bus',
    prefix: 'kytbus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Kyoto Bus', names: { ja: '京都バス', en: 'Kyoto Bus' } },
    countries: ['JP'],
  },
  {
    id: 'kyoto-city-bus',
    prefix: 'kcbus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Kyoto City Bus', names: { ja: '京都市バス', en: 'Kyoto City Bus' } },
    countries: ['JP'],
  },
  {
    id: 'mir-train',
    prefix: 'mir',
    routeTypes: [2],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Tsukuba Express', names: { ja: 'TX', en: 'Tsukuba Express' } },
    countries: ['JP'],
  },
  {
    id: 'tokyometro',
    prefix: 'tome',
    routeTypes: [1],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Tokyo Metro', names: { ja: '東京メトロ', en: 'Tokyo Metro' } },
    countries: ['JP'],
  },
  {
    id: 'twr-rinkai',
    prefix: 'twrr',
    routeTypes: [1, 2],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'TWR Rinkai Line',
      names: { ja: 'りんかい線', en: 'TWR Rinkai Line' },
    },
    countries: ['JP'],
  },
  {
    id: 'vag-freiburg',
    prefix: 'vagfr',
    routeTypes: [3, 0],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'VAG Freiburg',
      names: { ja: 'VAG Freiburg', en: 'VAG Freiburg', de: 'VAG Freiburg' },
    },
    countries: ['DE'],
  },
  {
    id: 'yokohama-municipal-bus',
    prefix: 'yhb',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Yokohama Municipal Bus',
      names: { ja: '横浜市営バス', en: 'Yokohama Municipal Bus' },
    },
    countries: ['JP'],
  },
  {
    id: 'yokohama-municipal-subway',
    prefix: 'yht',
    routeTypes: [1],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Yokohama Municipal Subway',
      names: { ja: '横浜市営地下鉄', en: 'Yokohama Municipal Subway' },
    },
    countries: ['JP'],
  },
  {
    id: 'yurikamome',
    prefix: 'yurimo',
    routeTypes: [2],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Yurikamome', names: { ja: 'ゆりかもめ', en: 'Yurikamome' } },
    countries: ['JP'],
  },
  {
    id: 'miyake-bus',
    prefix: 'mykbus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Miyake Village Bus', names: { ja: '三宅村営バス', en: 'Miyake Village Bus' } },
    countries: ['JP'],
  },
  {
    id: 'nagoya-srt',
    prefix: 'nsrt',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: { name: 'Nagoya SRT', names: { ja: 'SRT名古屋', en: 'Nagoya SRT' } },
    countries: ['JP'],
  },
  {
    id: 'nishi-tokyo-bus',
    prefix: 'ntbus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Nishi Tokyo Bus', names: { ja: '西東京バス', en: 'Nishi Tokyo Bus' } },
    countries: ['JP'],
  },
  {
    id: 'odakyu-bus',
    prefix: 'od9bus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: { name: 'Odakyu Bus', names: { ja: '小田急バス', en: 'Odakyu Bus' } },
    countries: ['JP'],
  },
  {
    id: 'oshima-bus',
    prefix: 'osmbus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Oshima Bus', names: { ja: '大島バス', en: 'Oshima Bus' } },
    countries: ['JP'],
  },
  {
    id: 'rinko-bus',
    prefix: 'rintan',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Rinko Bus',
      names: { ja: '臨港バス', en: 'Rinko Bus' },
    },
    countries: ['JP'],
  },
  {
    id: 'seibu-bus',
    prefix: 'sbbus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Seibu Bus', names: { ja: '西武バス', en: 'Seibu Bus' } },
    countries: ['JP'],
  },
  {
    id: 'tama-monorail',
    prefix: 'tmm',
    routeTypes: [12],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Tama Monorail', names: { ja: '多摩モノレール', en: 'Tama Monorail' } },
    countries: ['JP'],
  },
  {
    id: 'toei-bus',
    prefix: 'minkuru',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Toei Bus', names: { ja: '都バス', en: 'Toei Bus' } },
    countries: ['JP'],
  },
  {
    id: 'toei-train',
    prefix: 'toaran',
    routeTypes: [0, 2, 1],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: { name: 'Toei Train', names: { ja: '都営交通(鉄道)', en: 'Toei Train' } },
    countries: ['JP'],
  },
];

/**
 * Standalone Tokyo 23 wards community bus operators.
 *
 * These are kept separate from the general single-prefix list because they
 * form a recognizable local cluster and are easier to review together.
 */
const singlePrefixTokyo23WardCommunityBusGroupInputs: SinglePrefixSourceGroupInput[] = [
  {
    id: 'bunkyo-c-bus',
    prefix: 'bgle',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'B-GURU',
      names: { ja: 'Bーぐる (文京区)', en: 'B-GURU (Bunkyo)' },
    },
    countries: ['JP'],
  },
  {
    id: 'chii-bus',
    prefix: '13103b',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    // userEnabledByDefault: false,
    name: {
      name: 'Chii Bus',
      // names: { ja: 'ちぃばす', en: 'Chii Bus (Minato)' },
      names: { ja: 'ちぃばす (港区)', en: 'Chii Bus (Minato)' },
    },
    countries: ['JP'],
  },
  {
    id: 'chiyoda-bus',
    prefix: 'kazag',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Kazaguruma',
      // names: { ja: '風ぐるま', en: 'Kazaguruma (Chiyoda)' },
      names: { ja: '風ぐるま (千代田区)', en: 'Kazaguruma (Chiyoda)' },
    },
    countries: ['JP'],
  },
  {
    id: 'chuo-bus',
    prefix: 'edobus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Edo Bus',
      // names: { ja: '江戸バス', en: 'Edo Bus (Chuo)' },
      names: { ja: '江戸バス (中央区)', en: 'Edo Bus (Chuo)' },
    },
    countries: ['JP'],
  },
  {
    id: 'hachiko-bus',
    prefix: '85b',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    // userEnabledByDefault: false,
    name: {
      name: 'Hachiko Bus',
      // names: { ja: 'ハチ公バス', en: 'Hachiko Bus' },
      names: { ja: 'ハチ公バス (渋谷区)', en: 'Hachiko Bus (Shibuya)' },
    },
    countries: ['JP'],
  },
  {
    id: 'itabashi-rin2-bus',
    prefix: 'rin2',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Rinrin-GO',
      names: { ja: 'りんりんGO (板橋区)', en: 'Rinrin-GO (Itabashi)' },
    },
    countries: ['JP'],
  },
  {
    id: 'kita-bus',
    prefix: 'kbus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'K-bus',
      // names: { ja: 'Kバス', en: 'K-bus' },
      names: { ja: 'Kバス (北区)', en: 'K-bus (Kita)' },
    },
    countries: ['JP'],
  },
  {
    id: 'meguro-c-bus',
    prefix: 'sanma',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Sanma Bus',
      names: { ja: 'さんまバス (目黒区)', en: 'Sanma Bus (Meguro)' },
    },
    countries: ['JP'],
  },
  {
    id: 'ota-c-bus',
    prefix: 'tamachan',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Tamachan Bus',
      names: { ja: 'たまちゃんバス (大田区)', en: 'Tamachan Bus (Ota)' },
    },
    countries: ['JP'],
  },
  {
    id: 'shinagawa-c-bus',
    prefix: 'shinabus',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Shina Bus',
      names: { ja: 'しなバス (品川区)', en: 'Shina Bus (Shinagawa)' },
    },
    countries: ['JP'],
  },
  {
    id: 'suginami-gsm',
    prefix: 'sggsm',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'GSM',
      // names: { ja: 'グリスロ', en: 'GSM (Suginami)' },
      names: { ja: 'グリスロ (杉並区)', en: 'GSM (Suginami)' },
    },
    countries: ['JP'],
  },
  {
    id: 'taito-c-bus',
    prefix: 'megurin',
    routeTypes: [3],
    systemEnabledByDefault: true,
    userEnabledByDefault: false,
    name: {
      name: 'Megurin',
      names: { ja: 'めぐりん (台東区)', en: 'Megurin (Taito)' },
    },
    countries: ['JP'],
  },
];

/**
 * Standalone water transport operators.
 *
 * These are single-prefix ship / ferry groups, separated from the general
 * single-prefix list because the domain is cohesive and easier to scan on
 * its own.
 */
const singlePrefixWaterTransportGroupInputs: SinglePrefixSourceGroupInput[] = [
  {
    id: 'hankyu-ferry',
    prefix: 'han9fry',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Hankyu Ferry',
      names: { ja: '阪九フェリー', en: 'Hankyu Ferry' },
    },
    countries: ['JP'],
  },
  {
    id: 'itsukishima-kisen',
    prefix: 'itkfry',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Itsukishima Kisen',
      names: { ja: '斎島汽船', en: 'Itsukishima Kisen' },
    },
    countries: ['JP'],
  },
  {
    id: 'kagoshima-maritime-bureau',
    prefix: 'kcmb',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Sakurajima Ferry',
      names: { ja: '桜島フェリー', en: 'Sakurajima Ferry' },
    },
    countries: ['JP'],
  },
  {
    id: 'meimon-taiyo-ferry',
    prefix: 'mtfry',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Meimon Taiyo Ferry',
      names: { ja: '名門大洋フェリー', en: 'Meimon Taiyo Ferry' },
    },
    countries: ['JP'],
  },
  {
    id: 'okushiri-ferry',
    prefix: 'oksrif',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Okushiri Island Ferry',
      names: { ja: '奥尻島フェリー', en: 'Okushiri Island Ferry' },
    },
    countries: ['JP'],
  },
  {
    id: 'orange-ferry',
    prefix: 'orgfry',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Orange Ferry',
      names: { ja: 'オレンジフェリー', en: 'Orange Ferry' },
    },
    countries: ['JP'],
  },
  {
    id: 'sanwa-shosen',
    prefix: 'snws',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Sanwa Shosen',
      names: { ja: '三和商船', en: 'Sanwa Shosen' },
    },
    countries: ['JP'],
  },
  {
    id: 'tokai-kisen',
    prefix: 'tkksn',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Tokai Kisen',
      names: { ja: '東海汽船', en: 'Tokai Kisen' },
    },
    countries: ['JP'],
  },
  {
    id: 'tokyo-cruise-ship',
    prefix: 'tcship',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Tokyo Cruise',
      names: { ja: '水上バス', en: 'Tokyo Cruise' },
    },
    countries: ['JP'],
  },
  {
    id: 'uwajima-unyu',
    prefix: 'uwjmfry',
    routeTypes: [4],
    systemEnabledByDefault: true,
    userEnabledByDefault: true,
    name: {
      name: 'Uwajima Unyu Ferries',
      names: { ja: '宇和島運輸フェリー', en: 'Uwajima Unyu Ferries' },
    },
    countries: ['JP'],
  },
];

const settings: SourceGroup[] = [
  ...multiPrefixGroups,
  ...singlePrefixStandardGroupInputs.map(createSinglePrefixSourceGroup),
  ...singlePrefixTokyo23WardCommunityBusGroupInputs.map(createSinglePrefixSourceGroup),
  ...singlePrefixWaterTransportGroupInputs.map(createSinglePrefixSourceGroup),
];

export default settings;
