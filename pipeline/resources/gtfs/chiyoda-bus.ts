import type { GtfsSourceDefinition } from '../../types/gtfs-resource';

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
      resourceId: 'ab65587e-18cb-49ae-9b1b-fa319cdc149a',
      url: 'https://ckan.odpt.org/dataset/hitachi_automobile_transportation_chiyoda_alllines/resource/ab65587e-18cb-49ae-9b1b-fa319cdc149a',
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
      'https://api-public.odpt.org/api/v4/files/odpt/HitachiAutomobileTransportation/Chiyoda_ALLLINES.zip?date=20250601',
  },
  pipeline: {
    outDir: 'chiyoda-bus',
    prefix: 'kazag',
  },
};

export default chiyodaBus;
