import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';

const yurikamomeRailway: OdptJsonSourceDefinition = {
  resource: {
    nameEn: 'Yurikamome Railway',
    nameJa: 'ゆりかもめ 路線情報',
    description:
      'Railway data for Yurikamome line: station order, line code, color, and multilingual route names',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    odptType: 'odpt:Railway',
    endpointUrl: 'https://api.odpt.org/api/v4/odpt:Railway?odpt:operator=odpt.Operator:Yurikamome',
    mlitShapeMapping: {
      operator: 'ゆりかもめ',
      lineToRouteId: { 東京臨海新交通臨海線: 'yrkm:U' },
    },
    catalog: {
      type: 'odpt',
      resourceId: '0806342a-8baa-4a8b-8566-af97a0e02821',
      url: 'https://ckan.odpt.org/dataset/r_route-yurikamome/resource/0806342a-8baa-4a8b-8566-af97a0e02821',
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

export default yurikamomeRailway;
