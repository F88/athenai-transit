import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const iyotetsuBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Iyotetsu Bus',
    nameJa: '伊予鉄バス',
    description: 'GTFS static data for all routes operated by Iyotetsu Bus Co., Ltd.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/iyotetsu_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/iyotetsu_bus_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/iyotetsu_bus_all_lines/resource/1bae89cb-dfa7-4a21-b739-c9fa9960940e',
      resourceId: '1bae89cb-dfa7-4a21-b739-c9fa9960940e',
    },
    provider: {
      name: {
        ja: { long: '伊予鉄バス株式会社', short: '伊予鉄バス' },
        en: { long: 'Iyotetsu Bus Co., Ltd.', short: 'Iyotetsu Bus' },
      },
      url: 'https://www.iyotetsu.co.jp/',
      colors: [{ bg: 'EB6100', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/IyotetsuBus/AllLines.zip?date=20260330',
  },
  pipeline: {
    outDir: 'iyotetsu-bus',
    prefix: 'iyt2',
  },
};

export default iyotetsuBus;
