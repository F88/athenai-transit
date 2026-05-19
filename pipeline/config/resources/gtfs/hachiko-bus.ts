import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const hachikoBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Hachiko Bus',
    nameJa: 'ハチ公バス',
    description:
      'GTFS-JP static data for Hachiko Bus, the community bus service operated by Shibuya City.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'municipal',
      url: 'https://city-shibuya-data.opendata.arcgis.com/content/185d0dbc980443b8b60e135349e2ae5e/about',
    },
    provider: {
      name: {
        ja: { long: 'ハチ公バス', short: 'ハチ公バス' },
        en: { long: 'Hachiko Bus', short: 'Hachiko Bus' },
      },
      url: 'https://www.city.shibuya.tokyo.jp/kurashi/kotsu/hachiko/',
      colors: [{ bg: '000000', text: 'FFFFFF' }],
    },
    authentication: {
      required: false,
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://www.arcgis.com/sharing/rest/content/items/185d0dbc980443b8b60e135349e2ae5e/data',
  },
  pipeline: {
    outDir: 'hachiko-bus',
    prefix: '85b',
  },
};

export default hachikoBus;
