import type { GtfsSourceDefinition } from '../../types/gtfs-resource';

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
      resourceId: 'e91e1179-9e23-4b52-904c-7251b79b8eaf',
      url: 'https://ckan.odpt.org/dataset/kyoto_municipal_transportation_kyoto_city_bus_gtfs/resource/e91e1179-9e23-4b52-904c-7251b79b8eaf',
    },
    provider: {
      name: {
        ja: { long: '京都市交通局', short: '京都市バス' },
        en: { long: 'Kyoto Municipal Transportation', short: 'Kyoto City Bus' },
      },
      url: 'https://www.city.kyoto.lg.jp/kotsu/',
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/KyotoMunicipalTransportation/Kyoto_City_Bus_GTFS.zip?date=20260309',
  },
  pipeline: {
    outDir: 'kyoto-city-bus',
    prefix: 'kcbus',
  },
};

export default kyotoCityBus;
