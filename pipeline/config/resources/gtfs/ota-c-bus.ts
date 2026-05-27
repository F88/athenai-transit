import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const otaCBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Ota City Community Bus',
    nameJa: '大田区コミュニティバス',
    description:
      'GTFS-JP static data for Ota City Community Bus ("Tamachan Bus") operated by Tokyu Bus Corporation.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tokyu_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/tokyu_bus_tokyubus_community_ota_city',
      resourceUrl:
        'https://ckan.odpt.org/dataset/tokyu_bus_tokyubus_community_ota_city/resource/7cb51359-c845-49b8-9458-5741fcc97f1f',
      resourceId: '7cb51359-c845-49b8-9458-5741fcc97f1f',
    },
    provider: {
      name: {
        ja: { long: '東急バス株式会社', short: '東急バス' },
        en: { long: 'Tokyu Bus Corporation', short: 'Tokyu Bus' },
      },
      url: 'https://www.tokyubus.co.jp/',
      // Tamachan Bus brand: white body with dark blue lettering.
      colors: [{ bg: 'FFFFFF', text: '1D2A75' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    // GTFS routes.txt has empty `route_color`. shapes.txt is not bundled
    // so no polyline is drawn; the fallback only colors the route badge.
    // The white value matches the actual bus body colour.
    routeColorFallbacks: {
      '*': 'FFFFFF',
    },
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/TokyuBus/tokyubus_community_OtaCity.zip?date=20260212',
  },
  pipeline: {
    outDir: 'ota-c-bus',
    prefix: 'tamachan',
  },
};

export default otaCBus;
