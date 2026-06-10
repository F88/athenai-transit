import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const hankyuFerry: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Hankyu Ferry',
    nameJa: '阪九フェリー',
    description:
      'GTFS-JP static data for Hankyu Ferry connecting Kobe / Izumi-Otsu (Kansai) and Shin-Moji (Kitakyushu).',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/hankyu_ferry',
      datasetUrl: 'https://ckan.odpt.org/dataset/hankyu_ferry_schedul_hankyu',
      resourceUrl:
        'https://ckan.odpt.org/dataset/hankyu_ferry_schedul_hankyu/resource/96223965-11e6-4b52-9662-9413a0f32f52',
      resourceId: '96223965-11e6-4b52-9662-9413a0f32f52',
    },
    provider: {
      name: {
        ja: { long: '阪九フェリー株式会社', short: '阪九フェリー' },
        en: { long: 'Hankyu Ferry Co., Ltd.', short: 'Hankyu Ferry' },
      },
      url: 'https://www.han9f.co.jp/',
      colors: [{ bg: 'E53C3C', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['ferry'],
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/HankyuFerry/schedul_hankyu.zip?date=20260610',
  },
  pipeline: {
    outDir: 'hankyu-ferry',
    prefix: 'han9fry',
  },
};

export default hankyuFerry;
