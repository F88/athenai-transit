import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const shinagawaCBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Shinagawa City Community Bus',
    nameJa: '品川区コミュニティバス',
    description:
      'GTFS-JP static data for Shinagawa City Community Bus ("Shina Bus") operated by Tokyu Bus Corporation.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tokyu_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/tokyu_bus_tokyubus_community_shinagawa_city',
      resourceUrl:
        'https://ckan.odpt.org/dataset/tokyu_bus_tokyubus_community_shinagawa_city/resource/1113ba55-9ef4-456b-847f-cf270015930d',
      resourceId: '1113ba55-9ef4-456b-847f-cf270015930d',
    },
    provider: {
      name: {
        ja: { long: '東急バス株式会社', short: '東急バス' },
        en: { long: 'Tokyu Bus Corporation', short: 'Tokyu Bus' },
      },
      url: 'https://www.tokyubus.co.jp/',
      colors: [{ bg: '4653A1', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    // GTFS routes.txt has empty `route_color`. Fall back to the Shina Bus
    // brand color so polylines render with the operator's brand colour.
    routeColorFallbacks: {
      '*': '4653A1',
    },
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/TokyuBus/tokyubus_community_ShinagawaCity.zip?date=20260212',
  },
  pipeline: {
    outDir: 'shinagawa-c-bus',
    prefix: 'shinabus',
  },
};

export default shinagawaCBus;
