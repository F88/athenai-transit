import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const kagoshimaCityMaritimeBureau: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Sakurajima Ferry',
    nameJa: '桜島フェリー',
    description:
      'GTFS-JP static data for the Sakurajima Ferry connecting Kagoshima Port and Sakurajima Port across Kagoshima Bay, operated by the Kagoshima City Maritime Bureau.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/kagoshima_city_maritime_bureau',
      datasetUrl: 'https://ckan.odpt.org/dataset/kagoshima_city_maritime_bureau_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/kagoshima_city_maritime_bureau_all_lines/resource/2cf53e9c-e2e3-40e4-bf6f-bef08b33fa4c',
      resourceId: '2cf53e9c-e2e3-40e4-bf6f-bef08b33fa4c',
    },
    provider: {
      name: {
        ja: { long: '鹿児島市船舶局', short: '鹿児島市船舶局' },
        en: {
          long: 'Kagoshima City Maritime Bureau',
          short: 'Kagoshima City Maritime Bureau',
        },
      },
      url: 'https://www.city.kagoshima.lg.jp/sakurajima-ferry/',
      colors: [{ bg: 'C21B7E', text: 'FFFFFF' } /* Primary */],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['ferry'],
    routeColorFallbacks: {
      '*': 'C21B7E',
    },
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/KagoshimaCityMaritimeBureau/AllLines.zip?date=20251010',
  },
  pipeline: {
    outDir: 'kagoshima-maritime-bureau',
    prefix: 'kcmb',
  },
};

export default kagoshimaCityMaritimeBureau;
