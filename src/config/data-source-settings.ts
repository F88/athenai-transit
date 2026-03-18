import type { SourceGroup } from './data-source-manager';

const settings: SourceGroup[] = [
  {
    id: 'toei-bus',
    name_ja: '都営バス',
    category: 'bus',
    prefixes: ['minkuru'],
    enabled: true,
  },
  {
    id: 'toei-train',
    name_ja: '都営電車',
    category: 'train',
    prefixes: ['toaran'],
    enabled: true,
  },
  {
    id: 'yurikamome',
    name_ja: 'ゆりかもめ',
    category: 'train',
    prefixes: ['yurimo'],
    enabled: true,
  },
  {
    id: 'kanto-bus',
    name_ja: '関東バス',
    category: 'bus',
    prefixes: ['ktbus'],
    enabled: true,
  },
  {
    id: 'keio-bus',
    name_ja: '京王バス',
    category: 'bus',
    prefixes: ['kobus'],
    enabled: true,
  },
  {
    id: 'chiyoda-bus',
    name_ja: '風ぐるま (千代田区)',
    category: 'bus',
    prefixes: ['kazag'],
    enabled: true,
  },
  {
    id: 'chuo-bus',
    name_ja: '江戸バス (中央区)',
    category: 'bus',
    prefixes: ['edobus'],
    enabled: true,
  },
  {
    id: 'suginami-gsm',
    name_ja: '杉並区グリーンスローモビリティ',
    category: 'bus',
    prefixes: ['sggsm'],
    enabled: true,
  },
  // リソース定義最終確認中
  {
    id: 'seibu-bus',
    name_ja: '西武バス',
    category: 'bus',
    prefixes: ['sbbus'],
    enabled: true,
  },
  {
    id: 'iyotetsu-bus',
    name_ja: '伊予鉄バス',
    category: 'bus',
    prefixes: ['iyt2'],
    enabled: true,
  },
  {
    id: 'kita-bus',
    name_ja: 'Kバス (北区)',
    category: 'bus',
    prefixes: ['kbus'],
    enabled: true,
  },
  {
    id: 'kyoto-city-bus',
    name_ja: '京都市バス',
    category: 'bus',
    prefixes: ['kcbus'],
    enabled: true,
  },
  {
    id: 'oshima-bus',
    name_ja: '大島バス',
    category: 'bus',
    prefixes: ['osmbus'],
    enabled: true,
  },
  {
    id: 'miyake-bus',
    name_ja: '三宅村営バス',
    category: 'bus',
    prefixes: ['mykbus'],
    enabled: true,
  },
  {
    id: 'keisei-transit-bus',
    name_ja: '京成千葉ウエスト',
    category: 'bus',
    prefixes: ['kseiw'],
    enabled: true,
  },
  {
    id: 'mir-train',
    name_ja: 'つくばエクスプレス',
    category: 'train',
    prefixes: ['mir'],
    enabled: true,
  },
];

export default settings;
