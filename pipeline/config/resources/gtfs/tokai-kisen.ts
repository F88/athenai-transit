import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const tokaiKisen: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tokai Kisen',
    nameJa: '東海汽船',
    description:
      'GTFS-JP static data for ferry services to the Izu Islands and Ogasawara (Bonin) Islands operated by Tokai Kisen Co.,Ltd.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tokai_kisen',
      datasetUrl: 'https://ckan.odpt.org/dataset/tokai_kisen_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/tokai_kisen_all_lines/resource/30516ce5-9fcc-4bc3-ac9b-baa3e6f531ee',
      resourceId: '30516ce5-9fcc-4bc3-ac9b-baa3e6f531ee',
    },
    provider: {
      name: {
        ja: { long: '東海汽船株式会社', short: '東海汽船' },
        en: { long: 'Tokai Kisen Co.,Ltd.', short: 'Tokai Kisen' },
      },
      url: 'https://www.tokaikisen.co.jp/',
      colors: [
        { bg: '294DA5', text: 'FFFFFF' } /* Primary */,
        { bg: 'E60013', text: 'FFFFFF' } /* Secondary */,
      ],
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
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/TokaiKisen/AllLines.zip?date=20260401',
    // All 15 routes have empty route_color in the source GTFS — fallback applied.
    routeColorFallbacks: {
      '*': '294DA5',
    },
  },
  pipeline: {
    outDir: 'tokai-kisen',
    prefix: 'tkksn',
  },
};

export default tokaiKisen;
