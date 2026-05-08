import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const nishiTokyoBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Nishi Tokyo Bus',
    nameJa: '西東京バス',
    description:
      'GTFS static data for all routes operated by Nishi Tokyo Bus Co., Ltd. (Tama / Hachioji area)',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/nishi_tokyo_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/nishi_tokyo_bus_nt_bus',
      resourceUrl:
        'https://ckan.odpt.org/dataset/nishi_tokyo_bus_nt_bus/resource/557cfca7-c73b-4dd4-9858-488808bff051',
      resourceId: '557cfca7-c73b-4dd4-9858-488808bff051',
    },
    provider: {
      name: {
        ja: { long: '西東京バス株式会社', short: '西東京バス' },
        en: { long: 'Nishi Tokyo Bus Co., Ltd.', short: 'Nishi Tokyo Bus' },
      },
      url: 'https://www.nisitokyobus.co.jp/',
      colors: [{ bg: 'F01812', text: 'FFFFFF' } /* Primary */],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    routeColorFallbacks: {
      '*': 'F01812', // Nishi Tokyo Bus corporate red
    },
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/NishiTokyoBus/NTBus.zip?date=20260324',
  },
  pipeline: {
    outDir: 'nishi-tokyo-bus',
    prefix: 'ntbus',
  },
};

export default nishiTokyoBus;
