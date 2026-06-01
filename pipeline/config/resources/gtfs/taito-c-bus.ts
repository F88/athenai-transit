import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const taitoCBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Taito City Circular Route Bus "Megurin"',
    nameJa: '台東区循環バス「めぐりん」',
    description:
      'GTFS-JP static data for "Megurin", the circular community bus service in Taito City, Tokyo',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tokyo_taito_city',
      datasetUrl: 'https://ckan.odpt.org/dataset/tokyo_taito_city_megurin_ccby40',
      resourceUrl:
        'https://ckan.odpt.org/dataset/tokyo_taito_city_megurin_ccby40/resource/6e882760-6ee0-4cb3-b3de-88c0c1819367',
      resourceId: '6e882760-6ee0-4cb3-b3de-88c0c1819367',
    },
    provider: {
      name: {
        ja: { long: '台東区', short: '台東区' },
        en: { long: 'Taito City Office', short: 'Taito City Office' },
      },
      url: 'https://www.city.taito.lg.jp/kenchiku/kotsu/megurin/index.html',
      colors: [{ bg: '8B0202', text: 'FFFFFF' }],
    },
    authentication: {
      required: false,
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api-public.odpt.org/api/v4/files/odpt/TokyoTaitoCity/megurinCCBY40.zip?date=20251028',
  },
  pipeline: {
    outDir: 'taito-c-bus',
    prefix: 'megurin',
  },
};

export default taitoCBus;
