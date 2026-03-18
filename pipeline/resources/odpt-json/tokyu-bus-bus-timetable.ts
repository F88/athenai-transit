import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';

const tokyuBusBusTimetable: OdptJsonSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tokyu Bus Timetable',
    nameJa: '東急バス バス時刻表',
    description: 'Bus timetable data for Tokyu Bus: per-trip stop times',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      resourceId: 'c18d5280-bb74-46e8-8e76-08070a41fcf5',
      url: 'https://ckan.odpt.org/dataset/tokyu_bus__b-bus_timetable/resource/c18d5280-bb74-46e8-8e76-08070a41fcf5',
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
    odptType: 'odpt:BusTimetable',
    endpointUrl:
      'https://api.odpt.org/api/v4/odpt:BusTimetable?odpt:operator=odpt.Operator:TokyuBus',
  },
  pipeline: {
    outDir: 'tokyu-bus',
    prefix: 'tkbus',
  },
};

export default tokyuBusBusTimetable;
