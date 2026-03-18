import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';

const tokyuBusBusstopTimetable: OdptJsonSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tokyu Bus Stop Timetable',
    nameJa: '東急バス バス停時刻表',
    description: 'Bus stop timetable data for Tokyu Bus: departure times per stop/direction/calendar',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      resourceId: 'ae5f723f-00ea-44ea-8f16-1018854e8eaf',
      url: 'https://ckan.odpt.org/dataset/tokyu_bus__b-busstop_timetable/resource/ae5f723f-00ea-44ea-8f16-1018854e8eaf',
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
    odptType: 'odpt:BusstopPoleTimetable',
    endpointUrl:
      'https://api.odpt.org/api/v4/odpt:BusstopPoleTimetable?odpt:operator=odpt.Operator:TokyuBus',
  },
  pipeline: {
    outDir: 'tokyu-bus',
    prefix: 'tkbus',
  },
};

export default tokyuBusBusstopTimetable;
