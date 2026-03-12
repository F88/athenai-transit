import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';

const yurikamomeStationTimetable: OdptJsonSourceDefinition = {
  resource: {
    nameEn: 'Yurikamome Station Timetable',
    nameJa: 'ゆりかもめ 駅時刻表',
    description:
      'Station timetable data for Yurikamome line: departure times by direction and calendar type',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    odptType: 'odpt:StationTimetable',
    endpointUrl:
      'https://api.odpt.org/api/v4/odpt:StationTimetable?odpt:operator=odpt.Operator:Yurikamome',
    catalog: {
      type: 'odpt',
      resourceId: '2a58c027-f00d-4075-89c4-27e4f6f5a097',
      url: 'https://ckan.odpt.org/dataset/st_timetable_yurikamome/resource/2a58c027-f00d-4075-89c4-27e4f6f5a097',
    },
    provider: {
      nameJa: 'ゆりかもめ',
      nameEn: 'Yurikamome',
      url: 'https://www.yurikamome.co.jp/',
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },
  },
  pipeline: {
    outDir: 'yurikamome',
    prefix: 'yrkm',
  },
};

export default yurikamomeStationTimetable;
