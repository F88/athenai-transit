import type { GtfsSourceDefinition } from '../../types/gtfs-resource';

const suginamiGsm: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Suginami City Green Slow Mobility',
    nameJa: '杉並区グリーンスローモビリティ',
    description: 'GTFS static data for Green Slow Mobility service in Suginami City, Tokyo',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'odpt',
      resourceId: 'bdf054b4-8fe9-4673-a69f-6ac7e56e73aa',
      url: 'https://ckan.odpt.org/dataset/tokyo_suginami_city_green_slow_mobility/resource/bdf054b4-8fe9-4673-a69f-6ac7e56e73aa',
    },
    provider: {
      name: {
        ja: { long: '杉並区', short: 'すぎ丸' },
        en: { long: 'Suginami City', short: 'Sugimaru' },
      },
      url: 'https://www.city.suginami.tokyo.jp/',
      colors: [{ bg: '009B63', text: 'FFFFFF' }],
    },
    authentication: {
      required: false,
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api-public.odpt.org/api/v4/files/odpt/TokyoSuginamiCity/GreenSlowMobility.zip?date=20250524',
  },
  pipeline: {
    outDir: 'suginami-gsm',
    prefix: 'sggsm',
  },
};

export default suginamiGsm;
