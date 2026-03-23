import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const kantoBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Kanto Bus',
    nameJa: '関東バス',
    description: 'GTFS static data for all routes operated by Kanto Bus Corporation',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/kanto_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/kanto_bus_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/kanto_bus_all_lines/resource/05a8cd54-0412-4921-9747-dba755d27538',
      resourceId: '05a8cd54-0412-4921-9747-dba755d27538',
    },
    provider: {
      name: {
        ja: { long: '関東バス株式会社', short: '関東バス' },
        en: { long: 'Kanto Bus Corporation', short: 'Kanto Bus' },
      },
      url: 'https://www.kanto-bus.co.jp/',
      colors: [
        { bg: 'E60013', text: 'FFFFFF' } /* Primary */,
        { bg: '035F8C', text: 'FFFFFF' } /* Secondary */,
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
      '*': 'E60013', // Kanto Bus corporate red
    },
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/KantoBus/AllLines.zip?date=20260301',
  },
  pipeline: {
    outDir: 'kanto-bus',
    prefix: 'ktbus',
  },
};

export default kantoBus;
