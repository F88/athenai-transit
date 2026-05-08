import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const tokyoMetro: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tokyo Metro',
    nameJa: '東京メトロ',
    description:
      'GTFS static data for all subway lines operated by Tokyo Metro Co., Ltd. (Ginza, Marunouchi, Hibiya, Tozai, Chiyoda, Yurakucho, Hanzomon, Namboku, Fukutoshin)',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tokyometro',
      datasetUrl: 'https://ckan.odpt.org/dataset/train-tokyometro',
      resourceUrl:
        'https://ckan.odpt.org/dataset/train-tokyometro/resource/d4f11962-1c5a-4316-9a16-7fb229c227ea',
      resourceId: 'd4f11962-1c5a-4316-9a16-7fb229c227ea',
    },
    provider: {
      name: {
        ja: { long: '東京地下鉄株式会社', short: '東京メトロ' },
        en: { long: 'Tokyo Metro Co., Ltd.', short: 'Tokyo Metro' },
      },
      url: 'https://www.tokyometro.jp/',
      colors: [
        { bg: '00A3D9', text: 'FFFFFF' } /* Primary */,
        { bg: '00467E', text: 'FFFFFF' } /* Secondary */,
      ],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['subway'],
    mlitShapeMapping: {
      operator: '東京地下鉄',
      lineToRouteId: {
        '3号線銀座線': 'tome:1',
        '4号線丸ノ内線': 'tome:2',
        '4号線丸ノ内線分岐線': 'tome:2',
        '2号線日比谷線': 'tome:3',
        '5号線東西線': 'tome:4',
        '9号線千代田線': 'tome:5',
        '8号線有楽町線': 'tome:6',
        '11号線半蔵門線': 'tome:7',
        '7号線南北線': 'tome:8',
        '13号線副都心線': 'tome:9',
      },
    },
    downloadUrl: 'https://api.odpt.org/api/v4/files/TokyoMetro/data/TokyoMetro-Train-GTFS.zip',
  },
  pipeline: {
    outDir: 'tokyometro',
    prefix: 'tome',
  },
};

export default tokyoMetro;
