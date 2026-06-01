import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const bunkyoCBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Bunkyo Community Bus (B-GURU)',
    nameJa: '文京区コミュニティバス (Bーぐる)',
    description:
      'GTFS-JP static data for B-guru, the community bus service in Bunkyo City, operated by Hitachi Automobile Transportation',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/hitachi_automobile_transportation',
      datasetUrl: 'https://ckan.odpt.org/dataset/hitachi_automobile_transportation_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/hitachi_automobile_transportation_all_lines/resource/95ec7d40-73d9-4003-8d39-898421f5b689',
      resourceId: '95ec7d40-73d9-4003-8d39-898421f5b689',
    },
    provider: {
      name: {
        ja: { long: '日立自動車交通株式会社', short: '日立自動車交通株式会社' },
        en: {
          long: 'Hitachi Automobile Transportation Co., Ltd.',
          short: 'Hitachi Automobile Transportation Co., Ltd.',
        },
      },
      url: 'https://www.hitachi-gr.com/b-guru',
      colors: [{ bg: '15705E', text: 'FFFFFF' }],
    },
    authentication: {
      required: false,
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api-public.odpt.org/api/v4/files/odpt/HitachiAutomobileTransportation/AllLines.zip?date=20260401',
  },
  pipeline: {
    outDir: 'bunkyo-c-bus',
    prefix: 'bgle',
  },
};

export default bunkyoCBus;
