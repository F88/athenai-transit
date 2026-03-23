import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const mirTrain: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tsukuba Express',
    nameJa: 'つくばエクスプレス',
    description:
      'GTFS static data for Tsukuba Express operated by Metropolitan Intercity Railway Company',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/mir',
      datasetUrl: 'https://ckan.odpt.org/dataset/train-mir',
      resourceUrl:
        'https://ckan.odpt.org/dataset/train-mir/resource/663ebc8f-6c0c-4151-b966-f97f5d9b148c',
      resourceId: '663ebc8f-6c0c-4151-b966-f97f5d9b148c',
    },
    provider: {
      name: {
        ja: { long: '首都圏新都市鉄道株式会社', short: 'TX' },
        en: { long: 'Metropolitan Intercity Railway Company', short: 'Tsukuba Express' },
      },
      url: 'https://www.mir.co.jp/',
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['rail'],
    mlitShapeMapping: {
      operator: '首都圏新都市鉄道',
      lineToRouteId: {
        常磐新線: 'mir:1',
      },
    },
    downloadUrl: 'https://api.odpt.org/api/v4/files/MIR/data/MIR-Train-GTFS.zip',
  },
  pipeline: {
    outDir: 'mir-train',
    prefix: 'mir',
  },
};

export default mirTrain;
