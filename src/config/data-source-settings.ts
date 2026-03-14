import type { SourceGroup } from './data-source-manager';

const settings: SourceGroup[] = [
  {
    id: 'toei-bus',
    name_ja: '都営バス',
    category: 'bus',
    prefixes: ['tobus'],
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
    prefixes: ['yrkm'],
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
    id: 'suginami-gsm',
    name_ja: '杉並区グリーンスローモビリティ',
    category: 'bus',
    prefixes: ['sggsm'],
    enabled: true,
  },
];

export default settings;
