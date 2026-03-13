import type { SourceGroup } from './data-source-manager';

const settings: SourceGroup[] = [
  {
    id: 'toei-bus',
    name_ja: '都営バス',
    category: 'bus',
    prefixes: ['tobus'],
  },
  {
    id: 'toei-train',
    name_ja: '都営電車',
    category: 'train',
    prefixes: ['toaran'],
  },
  {
    id: 'yurikamome',
    name_ja: 'ゆりかもめ',
    category: 'train',
    prefixes: ['yrkm'],
  },
  {
    id: 'kanto-bus',
    name_ja: '関東バス',
    category: 'bus',
    prefixes: ['ktbus'],
  },
  {
    id: 'keio-bus',
    name_ja: '京王バス',
    category: 'bus',
    prefixes: ['kobus'],
  },
  {
    id: 'suginami-gsm',
    name_ja: '杉並区グリーンスローモビリティ',
    category: 'bus',
    prefixes: ['sggsm'],
  },
];

export default settings;
