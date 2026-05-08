import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const meimonTaiyoFerry: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Meimon Taiyo Ferry',
    nameJa: '名門大洋フェリー',
    description:
      'GTFS-JP static data for Meimon Taiyo Ferry (City Line) connecting Osaka Nanko Port and Shin-Moji Port (Kitakyushu).',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/meimon_taiyo_ferry',
      datasetUrl: 'https://ckan.odpt.org/dataset/meimon_taiyo_ferry_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/meimon_taiyo_ferry_all_lines/resource/af0e0550-8e8e-48da-8fca-274b091cccb7',
      resourceId: 'af0e0550-8e8e-48da-8fca-274b091cccb7',
    },
    provider: {
      name: {
        ja: { long: '株式会社名門大洋フェリー', short: '名門大洋フェリー' },
        en: { long: 'Meimon Taiyo Ferry Co., Ltd.', short: 'Meimon Taiyo Ferry' },
      },
      url: 'https://www.cityline.co.jp/',
      colors: [{ bg: '011B6A', text: 'FFFFFF' } /* Primary */],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['ferry'],
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published — feeds are rotated
    // every 3 months.
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/MeimonTaiyoFerry/AllLines.zip?date=20260401',
  },
  pipeline: {
    outDir: 'meimon-taiyo-ferry',
    prefix: 'mtfry',
  },
};

export default meimonTaiyoFerry;
