import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const rinkoBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Kawasaki Tsurumi Rinko Bus',
    nameJa: '川崎鶴見臨港バス',
    description:
      'GTFS-JP static data for all routes operated by Kawasaki Tsurumi Rinko Bus Co., Ltd.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/kawasaki_tsurumi_rinko_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/kawasaki_tsurumi_rinko_bus_allrinko',
      resourceUrl:
        'https://ckan.odpt.org/dataset/kawasaki_tsurumi_rinko_bus_allrinko/resource/5f074130-2fa6-4eec-a379-36d3a2530d59',
      resourceId: '5f074130-2fa6-4eec-a379-36d3a2530d59',
    },
    provider: {
      name: {
        ja: { long: '川崎鶴見臨港バス株式会社', short: '臨港バス' },
        en: { long: 'Kawasaki Tsurumi Rinko Bus Co., Ltd.', short: 'Rinko Bus' },
      },
      url: 'https://www.rinkobus.co.jp/',
      colors: [
        { bg: '017BBC', text: 'FFFFFF' } /* Primary */,
        { bg: 'DA0A16', text: 'FFFFFF' } /* Secondary */,
      ],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/KawasakiTsurumiRinkoBus/allrinko.zip?date=20260523',
  },
  pipeline: {
    outDir: 'rinko-bus',
    prefix: 'rintan',
  },
};

export default rinkoBus;
