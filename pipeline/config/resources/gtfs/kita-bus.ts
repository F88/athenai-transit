import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const kitaBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Kita City Community Bus K-bus',
    nameJa: '北区コミュニティバス Kバス',
    description:
      'GTFS static data for Kita City Community Bus "K-bus" operated by Hitachi Automobile Transportation',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'odpt',
      resourceId: 'b551e2d8-0ae1-4fb4-9a4d-aa8de7f3095c',
      url: 'https://ckan.odpt.org/dataset/hitachi_automobile_transportation_kita_all_lines/resource/b551e2d8-0ae1-4fb4-9a4d-aa8de7f3095c',
    },
    provider: {
      name: {
        ja: { long: '日立自動車交通株式会社', short: 'Kバス' },
        en: { long: 'Hitachi Automobile Transportation Co., Ltd.', short: 'K-bus' },
      },
      url: 'https://www.hitachi-gr.com/',
    },
    authentication: { required: false },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api-public.odpt.org/api/v4/files/odpt/HitachiAutomobileTransportation/KitaAllLines.zip?date=20251220',
  },
  pipeline: {
    outDir: 'kita-bus',
    prefix: 'kbus',
  },
};

export default kitaBus;
