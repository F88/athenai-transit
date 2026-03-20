import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';

const tokyuBusBusroute: OdptJsonSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tokyu Bus Routes',
    nameJa: '東急バス バス路線情報',
    description: 'Bus route pattern data for Tokyu Bus',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      resourceId: 'a3088ab9-671f-4eff-be93-5ff5d8d8341c',
      url: 'https://ckan.odpt.org/dataset/tokyu_bus__b-busroute/resource/a3088ab9-671f-4eff-be93-5ff5d8d8341c',
    },
    provider: {
      name: {
        ja: { long: '東急バス株式会社', short: '東急バス' },
        en: { long: 'Tokyu Bus Corporation', short: 'Tokyu Bus' },
      },
      url: 'https://www.tokyubus.co.jp/',
      colors: [{ bg: 'E60012', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** OdptJsonResource */
    odptType: 'odpt:BusroutePattern',
    endpointUrl:
      'https://api.odpt.org/api/v4/odpt:BusroutePattern?odpt:operator=odpt.Operator:TokyuBus',
  },
  pipeline: {
    outDir: 'tokyu-bus',
    prefix: 'tkbus',
  },
};

export default tokyuBusBusroute;
