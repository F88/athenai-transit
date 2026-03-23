import type { OdptJsonSourceDefinition } from '../../../src/types/odpt-json-resource';

const yurikamomeStation: OdptJsonSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Yurikamome Station',
    nameJa: 'ゆりかもめ 駅情報',
    description:
      'Station data for Yurikamome line: location, multilingual names, station codes, and connecting railways',
    dataFormat: { type: 'ODPT-JSON' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/yurikamome',
      datasetUrl: 'https://ckan.odpt.org/dataset/r_station-yurikamome',
      resourceUrl:
        'https://ckan.odpt.org/dataset/r_station-yurikamome/resource/8815e3f7-0ec7-4f8c-b5c8-e406e3354419',
      resourceId: '8815e3f7-0ec7-4f8c-b5c8-e406e3354419',
    },
    provider: {
      name: {
        ja: { long: 'ゆりかもめ', short: 'ゆりかもめ' },
        en: { long: 'Yurikamome', short: 'Yurikamome' },
      },
      url: 'https://www.yurikamome.co.jp/',
      colors: [{ bg: '1662B8', text: 'FFFFFF' } /* Primary */],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** OdptJsonResource */
    odptType: 'odpt:Station',
    endpointUrl: 'https://api.odpt.org/api/v4/odpt:Station?odpt:operator=odpt.Operator:Yurikamome',
  },
  pipeline: {
    outDir: 'yurikamome',
    prefix: 'yurimo',
  },
};

export default yurikamomeStation;
