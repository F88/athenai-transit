import type { OdptJsonSourceDefinition } from '../../types/odpt-json-resource';

const yurikamomeStation: OdptJsonSourceDefinition = {
  resource: {
    nameEn: 'Yurikamome Station',
    nameJa: 'ゆりかもめ 駅情報',
    description:
      'Station data for Yurikamome line: location, multilingual names, station codes, and connecting railways',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    odptType: 'odpt:Station',
    endpointUrl: 'https://api.odpt.org/api/v4/odpt:Station?odpt:operator=odpt.Operator:Yurikamome',
    catalog: {
      type: 'odpt',
      resourceId: '48202580-e879-4284-9804-bed64a42356d',
      url: 'https://ckan.odpt.org/dataset/t_info_yurikamome/resource/48202580-e879-4284-9804-bed64a42356d',
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

export default yurikamomeStation;
