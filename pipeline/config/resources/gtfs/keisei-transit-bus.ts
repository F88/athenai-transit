import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const keiseiTransitBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Keisei Transit Bus (Chiba West)',
    nameJa: '京成バス千葉ウエスト',
    description:
      'GTFS static data for all routes operated by Keisei Transit Bus Co., Ltd. (Chiba West area)',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/keisei_transit_bus',
      datasetUrl: 'https://ckan.odpt.org/dataset/keisei_transit_bus_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/keisei_transit_bus_all_lines/resource/af855ba1-374e-4157-a80d-211a5c425d29',
      resourceId: 'af855ba1-374e-4157-a80d-211a5c425d29',
    },
    provider: {
      name: {
        ja: { long: '京成バス千葉ウエスト株式会社', short: '京成千葉W' },
        en: { long: 'Keisei Transit Bus Co., Ltd.', short: 'Keisei Transit Bus' },
      },
      url: 'https://bus.shinkeisei.co.jp/',
      colors: [
        { bg: 'E82826', text: 'FFFFFF' } /* Primary */,
        { bg: '16479F', text: 'FFFFFF' } /* Secondary */,
      ],
    },
    authentication: { required: false },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api-public.odpt.org/api/v4/files/odpt/KeiseiTransitBus/AllLines.zip?date=20260401',
  },
  pipeline: {
    outDir: 'keisei-transit-bus',
    prefix: 'kseiw',
  },
};

export default keiseiTransitBus;
