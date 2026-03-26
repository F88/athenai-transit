import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const kyotoCityBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Kyoto City Bus',
    nameJa: '京都市営バス',
    description: 'GTFS static data for Kyoto City Bus operated by Kyoto Municipal Transportation',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/kyoto_municipal_transportation',
      datasetUrl:
        'https://ckan.odpt.org/dataset/kyoto_municipal_transportation_kyoto_city_bus_gtfs',
      resourceUrl:
        'https://ckan.odpt.org/dataset/kyoto_municipal_transportation_kyoto_city_bus_gtfs/resource/398a854f-ce53-4e02-87df-9723e6ed7046',
      resourceId: '398a854f-ce53-4e02-87df-9723e6ed7046',
    },
    provider: {
      name: {
        ja: { long: '京都市交通局', short: '京都市バス' },
        en: { long: 'Kyoto Municipal Transportation', short: 'Kyoto City Bus' },
      },
      url: 'https://www.city.kyoto.lg.jp/kotsu/',
      colors: [{ bg: '138060', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/KyotoMunicipalTransportation/Kyoto_City_Bus_GTFS.zip?date=20260323',
  },
  pipeline: {
    outDir: 'kyoto-city-bus',
    prefix: 'kcbus',
  },
};

export default kyotoCityBus;
