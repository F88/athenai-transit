import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const odakyuBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Odakyu Bus',
    nameJa: '小田急バス',
    description:
      'GTFS-JP static data for Odakyu Bus Co., Ltd., serving the western Tokyo and Kanagawa suburban areas (Shinjuku, Kichijoji, Chofu, Mitaka, Azamino, etc.).',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/odakyu_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/odakyu_bus_aii_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/odakyu_bus_aii_lines/resource/e9018a39-8339-4e07-ad96-2fce988dac7b',
      resourceId: 'e9018a39-8339-4e07-ad96-2fce988dac7b',
    },
    provider: {
      name: {
        ja: { long: '小田急バス株式会社', short: '小田急バス' },
        en: { long: 'Odakyu Bus Co., Ltd.', short: 'Odakyu Bus' },
      },
      url: 'https://www.odakyubus.co.jp/',
      colors: [
        { bg: '009BE1', text: 'FFFFFF' } /* Primary */,
        { bg: '0082CD', text: 'FFFFFF' } /* Secondary */,
      ],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    routeColorFallbacks: {
      '*': '009BE1', // Odakyu Bus primary blue
    },
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/OdakyuBus/AIILines.zip?date=20260319',
  },
  pipeline: {
    outDir: 'odakyu-bus',
    prefix: 'od9bus',
  },
};

export default odakyuBus;
