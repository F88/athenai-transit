import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const tamaMonorail: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tama Monorail',
    nameJa: '多摩モノレール',
    description:
      'GTFS static data for Tama Monorail operated by Tokyo Tama Intercity Monorail Co., Ltd.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tamamonorail',
      datasetUrl: 'https://ckan.odpt.org/dataset/train-tamamonorail',
      resourceUrl:
        'https://ckan.odpt.org/dataset/train-tamamonorail/resource/c72cc2a7-f1d5-41cf-9fac-5545237fd425',
      resourceId: 'c72cc2a7-f1d5-41cf-9fac-5545237fd425',
    },
    provider: {
      name: {
        ja: { long: '多摩都市モノレール株式会社', short: '多摩モノレール' },
        en: { long: 'Tokyo Tama Intercity Monorail Co., Ltd.', short: 'Tama Monorail' },
      },
      url: 'https://www.tama-monorail.co.jp/',
      colors: [{ bg: 'FF963F', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['monorail'],
    downloadUrl: 'https://api.odpt.org/api/v4/files/TamaMonorail/data/TamaMonorail-Train-GTFS.zip',
  },
  pipeline: {
    outDir: 'tama-monorail',
    prefix: 'tmm',
  },
};

export default tamaMonorail;
