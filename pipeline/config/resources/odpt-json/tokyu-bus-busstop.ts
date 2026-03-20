import type { OdptJsonSourceDefinition } from '../../../src/types/odpt-json-resource';

const tokyuBusBusstop: OdptJsonSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tokyu Bus Stops',
    nameJa: '東急バス バス停情報',
    description: 'Bus stop (pole) data for Tokyu Bus: location, names',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      resourceId: 'b7bea0ff-dae5-49d2-845a-d4158ed1e99e',
      url: 'https://ckan.odpt.org/dataset/tokyu_bus__b-busstop/resource/b7bea0ff-dae5-49d2-845a-d4158ed1e99e',
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
    odptType: 'odpt:BusstopPole',
    endpointUrl:
      'https://api.odpt.org/api/v4/odpt:BusstopPole?odpt:operator=odpt.Operator:TokyuBus',
  },
  pipeline: {
    outDir: 'tokyu-bus',
    prefix: 'tkbus',
  },
};

export default tokyuBusBusstop;
