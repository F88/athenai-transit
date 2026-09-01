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
        'https://ckan.odpt.org/dataset/iyotetsu_bus_all_lines/resource/7c438dd2-2f64-40c7-ac94-9d6e67a15e04',
      resourceId: '7c438dd2-2f64-40c7-ac94-9d6e67a15e04',
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
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/IyotetsuBus/AllLines.zip?date=20260901',
  },
  pipeline: {
    outDir: 'iyotetsu-bus',
    prefix: 'iyt2',
  },
};

export default iyotetsuBus;
