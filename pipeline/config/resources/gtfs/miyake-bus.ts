import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const miyakeBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Miyake Village Bus',
    nameJa: '三宅村営バス',
    description: 'GTFS static data for Miyake Village community bus on Miyakejima island',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/miyake_vill',
      datasetUrl: 'https://ckan.odpt.org/dataset/miyake_vill_all_line',
      resourceUrl:
        'https://ckan.odpt.org/dataset/miyake_vill_all_line/resource/f526db08-21ea-452c-b6ed-ea5758b3c44a',
      resourceId: 'f526db08-21ea-452c-b6ed-ea5758b3c44a',
    },
    provider: {
      name: {
        ja: { long: '三宅村', short: '三宅村営バス' },
        en: { long: 'Miyake Village', short: 'Miyake Village Bus' },
      },
    },
    authentication: { required: false },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api-public.odpt.org/api/v4/files/odpt/MiyakeVill/AllLine.zip?date=20250929',
  },
  pipeline: {
    outDir: 'miyake-bus',
    prefix: 'mykbus',
  },
};

export default miyakeBus;
