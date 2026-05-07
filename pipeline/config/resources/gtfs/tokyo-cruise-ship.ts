import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const tokyoCruiseShip: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tokyo Cruise Ship',
    nameJa: '東京都観光汽船',
    description:
      'GTFS static data for Suijobus (water bus) services on the Sumida River and Tokyo Bay operated by Tokyo Cruise Ship Co., Ltd.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tokyo_cruise_ship',
      datasetUrl: 'https://ckan.odpt.org/dataset/tokyo_cruise_ship_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/tokyo_cruise_ship_all_lines/resource/c96fa688-113d-4681-bcd9-43b21cad0cc3',
      resourceId: 'c96fa688-113d-4681-bcd9-43b21cad0cc3',
    },
    provider: {
      name: {
        ja: { long: '東京都観光汽船株式会社', short: '水上バス' },
        en: { long: 'Tokyo Cruise Ship Co., Ltd.', short: 'Tokyo Cruise' },
      },
      url: 'https://www.suijobus.co.jp/',
      colors: [{ bg: '0072CF', text: 'FFFFFF' } /* Primary */],
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
      'https://api.odpt.org/api/v4/files/odpt/TokyoCruiseShip/AllLines.zip?date=20250402',
  },
  pipeline: {
    outDir: 'tokyo-cruise-ship',
    prefix: 'tcship',
  },
};

export default tokyoCruiseShip;
