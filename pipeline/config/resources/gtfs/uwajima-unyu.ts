import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const uwajimaUnyu: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Uwajima Unyu Ferries',
    nameJa: '宇和島運輸フェリー',
    description:
      'GTFS-JP static data for Uwajima Unyu Ferries connecting Yawatahama Port (Ehime) with Beppu Port and Usuki Port (Oita) across the Bungo Channel.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/uwajima_unyu',
      datasetUrl: 'https://ckan.odpt.org/dataset/uwajima_unyu_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/uwajima_unyu_all_lines/resource/d2ada078-e357-40f5-8c0c-eae269c3d59b',
      resourceId: 'd2ada078-e357-40f5-8c0c-eae269c3d59b',
    },
    provider: {
      name: {
        ja: { long: '宇和島運輸株式会社', short: '宇和島運輸フェリー' },
        en: { long: 'Uwajima Unyu Co., Ltd.', short: 'Uwajima Unyu Ferries' },
      },
      url: 'https://www.uwajimaunyu.co.jp/',
      colors: [{ bg: '534436', text: 'FFFFFF' } /* Primary */],
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
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/UwajimaUnyu/AllLines.zip?date=20260701',
  },
  pipeline: {
    outDir: 'uwajima-unyu',
    prefix: 'uwjmfry',
  },
};

export default uwajimaUnyu;
