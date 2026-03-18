import type { GtfsSourceDefinition } from '../../types/gtfs-resource';

const seibuBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Seibu Bus',
    nameJa: '西武バス',
    description: 'GTFS static data for all routes operated by Seibu Bus Corporation',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      resourceId: '8a2d63ed-6023-42bf-ae34-1796c56f607f',
      url: 'https://ckan.odpt.org/dataset/seibu_bus__b-bus_gtfs/resource/8a2d63ed-6023-42bf-ae34-1796c56f607f',
    },
    provider: {
      name: {
        ja: { long: '西武バス株式会社', short: '西武バス' },
        en: { long: 'Seibu Bus Co., Ltd.', short: 'Seibu Bus' },
      },
      url: 'https://www.seibubus.co.jp/',
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api.odpt.org/api/v4/files/SeibuBus/data/SeibuBus-GTFS.zip',
  },
  pipeline: {
    outDir: 'seibu-bus',
    prefix: 'sbbus',
  },
};

export default seibuBus;
