import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const orangeFerry: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Orange Ferry',
    nameJa: 'オレンジフェリー',
    description:
      'GTFS-JP static data for Orange Ferry (operated by Shikoku Kaihatsu Ferry Co., Ltd.) connecting ports in Ehime / Osaka / Kobe / Oita: Toyo–Osaka, Niihama–Kobe, and Yawatahama–Usuki routes.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/orange_ferry',
      datasetUrl: 'https://ckan.odpt.org/dataset/orange_ferry_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/orange_ferry_all_lines/resource/2115e2d4-dc0e-4dbf-b825-14f1da5bd841',
      resourceId: '2115e2d4-dc0e-4dbf-b825-14f1da5bd841',
    },
    provider: {
      name: {
        ja: { long: '四国開発フェリー株式会社', short: 'オレンジフェリー' },
        en: { long: 'Shikoku Kaihatsu Ferry Co., Ltd.', short: 'Orange Ferry' },
      },
      url: 'https://www.orange-ferry.co.jp/',
      colors: [{ bg: 'EC5B24', text: 'FFFFFF' } /* Primary */],
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
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/OrangeFerry/AllLines.zip?date=20250517',
  },
  pipeline: {
    outDir: 'orange-ferry',
    prefix: 'orgfry',
  },
};

export default orangeFerry;
