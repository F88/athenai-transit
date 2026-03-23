import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const oshimaBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Oshima Bus',
    nameJa: '大島バス',
    description: 'GTFS static data for Oshima Bus on Izu Oshima island',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/oshima_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/oshima_bus_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/oshima_bus_all_lines/resource/ef2e0472-f50f-4a8e-b4b4-df9002dd219a',
      resourceId: 'ef2e0472-f50f-4a8e-b4b4-df9002dd219a',
    },
    provider: {
      name: {
        ja: { long: '大島旅客自動車株式会社', short: '大島バス' },
        en: { long: 'Oshima Passenger Car Co., Ltd.', short: 'Oshima Bus' },
      },
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/OshimaBus/AllLines.zip?date=20260328',
  },
  pipeline: {
    outDir: 'oshima-bus',
    prefix: 'osmbus',
  },
};

export default oshimaBus;
