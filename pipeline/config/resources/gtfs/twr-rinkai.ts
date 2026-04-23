import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const twrRinkai: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'TWR Rinkai Line',
    nameJa: 'りんかい線',
    description:
      'GTFS static data for the Rinkai Line operated by Tokyo Waterfront Area Rapid Transit Co., Ltd.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/twr',
      datasetUrl: 'https://ckan.odpt.org/dataset/train-twr',
      resourceUrl:
        'https://ckan.odpt.org/dataset/train-twr/resource/f1953807-47da-4540-94bd-26c391e5caef',
      resourceId: 'f1953807-47da-4540-94bd-26c391e5caef',
    },
    provider: {
      name: {
        ja: { long: '東京臨海高速鉄道株式会社', short: 'りんかい線' },
        en: { long: 'Tokyo Waterfront Area Rapid Transit Co., Ltd.', short: 'TWR Rinkai Line' },
      },
      url: 'https://www.twr.co.jp/',
      colors: [{ bg: '00418E', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['rail'],
    mlitShapeMapping: {
      operator: '東京臨海高速鉄道',
      lineToRouteId: {
        臨海副都心線: 'twrr:1',
      },
    },
    downloadUrl: 'https://api.odpt.org/api/v4/files/TWR/data/TWR-Train-GTFS.zip',
  },
  pipeline: {
    outDir: 'twr-rinkai',
    prefix: 'twrr',
  },
};

export default twrRinkai;
