import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';

const yurikamomeStationTimetable: OdptJsonSourceDefinition = {
  resource: {
    nameEn: 'Yurikamome Station Timetable',
    nameJa: 'ゆりかもめ 駅時刻表',
    description:
      'Station timetable data for Yurikamome line: departure times by direction and calendar type',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    odptType: 'odpt:StationTimetable',
    endpointUrl:
      'https://api.odpt.org/api/v4/odpt:StationTimetable?odpt:operator=odpt.Operator:Yurikamome',
    catalog: {
      type: 'odpt',
      resourceId: 'd83a1b77-6d9f-494e-b63c-be082fea6c56',
      url: 'https://ckan.odpt.org/dataset/r_station_timetable-yurikamome/resource/d83a1b77-6d9f-494e-b63c-be082fea6c56',
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
