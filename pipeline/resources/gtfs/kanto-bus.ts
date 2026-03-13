import type { GtfsSourceDefinition } from '../../types/gtfs-resource';

const kantoBus: GtfsSourceDefinition = {
  resource: {
    nameEn: 'Kanto Bus',
    nameJa: '関東バス',
    description: 'GTFS static data for all routes operated by Kanto Bus Corporation',
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    dataFormat: { type: 'GTFS/GTFS-JP' },
    routeTypes: ['bus'],
    routeColorFallbacks: {
      '*': 'D7251D', // Kanto Bus corporate red
    },
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/KantoBus/AllLines.zip?date=20260301',
    catalog: {
      type: 'odpt',
      resourceId: '05a8cd54-0412-4921-9747-dba755d27538',
      url: 'https://ckan.odpt.org/dataset/kanto_bus_all_lines/resource/05a8cd54-0412-4921-9747-dba755d27538',
    },
    provider: {
      nameJa: '関東バス株式会社',
      nameEn: 'Kanto Bus Corporation',
      url: 'https://www.kanto-bus.co.jp/',
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },
  },
  pipeline: {
    outDir: 'kanto-bus',
    prefix: 'ktbus',
  },
};

export default kantoBus;
