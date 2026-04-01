import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const chiyodaBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Kazaguruma (Chiyoda Community Bus)',
    nameJa: '風ぐるま (千代田区コミュニティバス)',
    description:
      'GTFS static data for Kazaguruma, the community welfare bus service in Chiyoda City, operated by Hitachi Automobile Transportation',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/hitachi_automobile_transportation',
      datasetUrl:
        'https://ckan.odpt.org/dataset/hitachi_automobile_transportation_chiyoda_alllines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/hitachi_automobile_transportation_chiyoda_alllines/resource/0dfb9750-ed72-4f5a-9368-76ad4a5adea9',
      resourceId: '0dfb9750-ed72-4f5a-9368-76ad4a5adea9',
    },
    provider: {
      name: {
        ja: { long: '日立自動車交通株式会社', short: '風ぐるま' },
        en: { long: 'Hitachi Automobile Transportation Co., Ltd.', short: 'Kazaguruma' },
      },
      colors: [{ bg: 'E94185', text: 'FFFFFF' }],
    },
    authentication: {
      required: false,
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api-public.odpt.org/api/v4/files/odpt/HitachiAutomobileTransportation/Chiyoda_ALLLINES.zip?date=20260401',
  },
  pipeline: {
    outDir: 'chiyoda-bus',
    prefix: 'kazag',
  },
};

export default chiyodaBus;
