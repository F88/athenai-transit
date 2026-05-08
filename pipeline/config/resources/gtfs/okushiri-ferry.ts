import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const okushiriFerry: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Okushiri Island Ferry',
    nameJa: '奥尻島フェリー',
    description:
      'GTFS-JP static data for the Okushiri-Esashi ferry route operated by Okushiri Island Ferry Co., Ltd. between Esashi Port (mainland Hokkaido) and Okushiri Port (Okushiri Island).',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/okushiri_island_ferry',
      datasetUrl: 'https://ckan.odpt.org/dataset/okushiri_island_ferry_okushiri_esashi_ferry_route',
      resourceUrl:
        'https://ckan.odpt.org/dataset/okushiri_island_ferry_okushiri_esashi_ferry_route/resource/f96ce088-80f8-4124-985c-08799ccd3490',
      resourceId: 'f96ce088-80f8-4124-985c-08799ccd3490',
    },
    provider: {
      name: {
        ja: { long: 'オクシリアイランドフェリー株式会社', short: 'オクシリアイランドフェリー' },
        en: { long: 'Okushiri Island Ferry Co., Ltd.', short: 'Okushiri Island Ferry' },
      },
      url: 'https://heartlandferry.jp/',
      colors: [{ bg: '00AFCC', text: 'FFFFFF' } /* Primary */],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['ferry'],
    // The date parameter is required and must match a published version on CKAN.
    // Note the file name ends with `Okushiri_Esashi_Ferry_Route.zip`, not the
    // typical `AllLines.zip`, because the dataset is scoped to a single route.
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/OkushiriIslandFerry/Okushiri_Esashi_Ferry_Route.zip?date=20260101',
  },
  pipeline: {
    outDir: 'okushiri-ferry',
    prefix: 'oksrif',
  },
};

export default okushiriFerry;
