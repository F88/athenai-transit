import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

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
      organizationUrl: 'https://ckan.odpt.org/organization/tokyo_suginami_city',
      datasetUrl: 'https://ckan.odpt.org/dataset/tokyo_suginami_city_green_slow_mobility',
      resourceUrl:
        'https://ckan.odpt.org/dataset/tokyo_suginami_city_green_slow_mobility/resource/239b299c-37b0-477d-9b25-7fc4a5efca0d',
      resourceId: '239b299c-37b0-477d-9b25-7fc4a5efca0d',
    },
    provider: {
      name: {
        ja: { long: '杉並区', short: '杉並区' },
        en: { long: 'Suginami City', short: 'Suginami City' },
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
      'https://api-public.odpt.org/api/v4/files/odpt/TokyoSuginamiCity/GreenSlowMobility.zip?date=20260601',
  },
  pipeline: {
    outDir: 'suginami-gsm',
    prefix: 'sggsm',
  },
};

export default suginamiGsm;
