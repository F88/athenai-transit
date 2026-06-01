import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const meguroCBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Meguro City Community Bus',
    nameJa: '目黒区コミュニティバス',
    description:
      'GTFS-JP static data for Meguro City Community Bus ("Sanma Bus") operated by Tokyu Bus Corporation.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tokyu_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/tokyu_bus_tokyubus_community_meguro_city',
      resourceUrl:
        'https://ckan.odpt.org/dataset/tokyu_bus_tokyubus_community_meguro_city/resource/284624d8-811c-4a76-9a47-6c74ec1f2659',
      resourceId: '284624d8-811c-4a76-9a47-6c74ec1f2659',
    },
    provider: {
      name: {
        ja: { long: '東急バス株式会社', short: '東急バス' },
        en: { long: 'Tokyu Bus Corporation', short: 'Tokyu Bus' },
      },
      url: 'https://www.tokyubus.co.jp/',
      // route_color from GTFS routes.txt (Sanma Bus purple).
      colors: [{ bg: '613964', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/TokyuBus/tokyubus_community_MeguroCity.zip?date=20260601',
  },
  pipeline: {
    outDir: 'meguro-c-bus',
    prefix: 'sanma',
  },
};

export default meguroCBus;
