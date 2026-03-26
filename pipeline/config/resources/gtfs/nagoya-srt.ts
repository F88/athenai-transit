import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const nagoyaSrt: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Nagoya SRT',
    nameJa: 'SRT名古屋',
    description: 'GTFS static data for Nagoya Smart Roadway Transit (SRT) operated by Nagoya City',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/nagoya_housing_city_planning_bureau',
      datasetUrl:
        'https://ckan.odpt.org/dataset/nagoya_housing_city_planning_bureau_nagoya_srt_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/nagoya_housing_city_planning_bureau_nagoya_srt_all_lines/resource/f9a0da8a-5474-4d59-9396-86978efd1418',
      resourceId: 'f9a0da8a-5474-4d59-9396-86978efd1418',
    },
    provider: {
      name: {
        ja: { long: '名古屋市住宅都市局', short: 'SRT名古屋' },
        en: { long: 'Nagoya Housing & City Planning Bureau', short: 'Nagoya SRT' },
      },
      url: 'https://www.srt.city.nagoya.jp/',
      colors: [{ bg: 'B7A66D', text: 'FFFFFF' }],
    },
    authentication: { required: false },

    /** GtfsResource */
    routeTypes: ['bus'],
    downloadUrl:
      'https://api-public.odpt.org/api/v4/files/odpt/NagoyaHousingCityPlanningBureau/NagoyaSRT_AllLines.zip?date=20260213',
  },
  pipeline: {
    outDir: 'nagoya-srt',
    prefix: 'nsrt',
  },
};

export default nagoyaSrt;
