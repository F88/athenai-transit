import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';

const yurikamomeRailway: OdptJsonSourceDefinition = {
  resource: {
    nameEn: 'Yurikamome Railway',
    nameJa: 'ゆりかもめ 路線情報',
    description:
      'Railway data for Yurikamome line: station order, line code, color, and multilingual route names',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    odptType: 'odpt:Railway',
    endpointUrl: 'https://api.odpt.org/api/v4/odpt:Railway?odpt:operator=odpt.Operator:Yurikamome',
    mlitShapeMapping: {
      operator: 'ゆりかもめ',
      lineToRouteId: { 東京臨海新交通臨海線: 'yrkm:U' },
    },
    catalog: {
      type: 'odpt',
      resourceId: 'b3ab2e69-0e60-48e7-9e05-69c7c1e57e1e',
      url: 'https://ckan.odpt.org/dataset/r_info_yurikamome/resource/b3ab2e69-0e60-48e7-9e05-69c7c1e57e1e',
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
