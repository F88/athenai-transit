import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const keioBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Keio Bus',
    nameJa: '京王バス',
    description: 'GTFS static data for all routes operated by Keio Dentetsu Bus',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/keio_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/keio_bus_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/keio_bus_all_lines/resource/d0212d4f-cc57-4fc6-9b90-6197e2d38552',
      resourceId: 'd0212d4f-cc57-4fc6-9b90-6197e2d38552',
    },
    provider: {
      name: {
        ja: { long: '京王電鉄バス株式会社', short: '京王バス' },
        en: { long: 'Keio Dentetsu Bus Co., Ltd.', short: 'Keio Bus' },
      },
      url: 'https://www.keio-bus.com/',
      colors: [
        { bg: '00377E', text: 'FFFFFF' } /* Primary */,
        { bg: 'C8006B', text: 'FFFFFF' } /* Secondary */,
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
      '*': '00377E', // Keio Bus corporate blue
    },
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/KeioBus/AllLines.zip?date=20260401',
  },
  pipeline: {
    outDir: 'keio-bus',
    prefix: 'kobus',
  },
};

export default keioBus;
