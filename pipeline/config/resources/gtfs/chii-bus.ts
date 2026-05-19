import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const chiiBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Chii Bus (Minato Community Bus)',
    nameJa: 'ちぃばす (港区コミュニティバス)',
    description:
      'GTFS-JP static data for Chii Bus, the community bus service operated by Minato City.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    // The CKAN resource page does not specify a per-dataset license, but the
    // portal-wide terms (https://opendata.city.minato.tokyo.jp/about) state
    // that content can also be used under CC BY 4.0.
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'municipal',
      url: 'https://opendata.city.minato.tokyo.jp/dataset/chiibus_gtfs/resource/3c9c61ee-c11f-4195-b81f-54ec088417e6',
    },
    provider: {
      name: {
        ja: { long: 'ちぃばす', short: 'ちぃばす' },
        en: { long: 'Chii Bus', short: 'Chii Bus' },
      },
      url: 'https://www.city.minato.tokyo.jp/',
      colors: [
        { bg: '9B2663', text: 'FFFFFF' } /* Primary */,
        { bg: '2C5FD4', text: 'FFFFFF' } /* Secondary */,
      ],
    },
    authentication: {
      required: false,
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl: 'https://gtfs-jp.buskita.com/fxc/gtfs.zip',
  },
  pipeline: {
    outDir: 'chii-bus',
    prefix: '13103b',
  },
};

export default chiiBus;
