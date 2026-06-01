import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const itabashiRin2Bus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Rinrin-GO (Itabashi City community bus)',
    nameJa: '板橋区コミュニティバス りんりんGO',
    description:
      'GTFS-JP static data for Rinrin-GO, the Itabashi City community bus operated by Kokusai Kogyo Bus.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'municipal',
      url: 'https://www.city.itabashi.tokyo.jp/bousai/toshikeiakku/kotsu/1016224.html',
    },
    provider: {
      name: {
        ja: { long: '板橋区', short: '板橋区' },
        en: { long: 'Itabashi City', short: 'Itabashi City' },
      },
      url: 'https://www.city.itabashi.tokyo.jp/bousai/toshikeiakku/kotsu/1016224.html',
      colors: [{ bg: '045259', text: 'FFFFFF' }],
    },
    authentication: {
      required: false,
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    routeColorFallbacks: {
      // route_color is empty in source; fill with the GTFS default (FFFFFF) so it
      // pairs with the source route_text_color 000000 (black on white, max contrast).
      '*': 'FFFFFF',
    },
    downloadUrl:
      'https://www.city.itabashi.tokyo.jp/_res/projects/default_project/_page_/001/006/732/rinringo_gtfs_20260401asshuku.zip',
  },
  pipeline: {
    outDir: 'itabashi-rin2-bus',
    prefix: 'rin2',
  },
};

export default itabashiRin2Bus;
