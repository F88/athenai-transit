import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const kyotoBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Kyoto Bus',
    nameJa: '京都バス',
    description:
      'GTFS-JP static data for Kyoto Bus Co., Ltd., a private operator complementing Kyoto City Bus on routes around Kyoto City suburbs (Ohara, Iwakura, Arashiyama, Takano, etc.).',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/kyoto_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/kyoto_bus_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/kyoto_bus_all_lines/resource/de92909b-8d02-4007-b89d-d9a0d9e78650',
      resourceId: 'de92909b-8d02-4007-b89d-d9a0d9e78650',
    },
    provider: {
      name: {
        ja: { long: '京都バス株式会社', short: '京都バス' },
        en: { long: 'KyotoBus Co., Ltd.', short: 'Kyoto Bus' },
      },
      url: 'https://www.kyotobus.jp/',
      colors: [{ bg: '99211F', text: 'FFFFFF' } /* Primary */],
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
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/KyotoBus/AllLines.zip?date=20260507',
  },
  pipeline: {
    outDir: 'kyoto-bus',
    prefix: 'kytbus',
  },
};

export default kyotoBus;
