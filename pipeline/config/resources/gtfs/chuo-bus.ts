import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const chuoBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Edo Bus (Chuo City Community Bus)',
    nameJa: '江戸バス (中央区コミュニティバス)',
    description: 'GTFS static data for Edo Bus, the community bus service in Chuo City, Tokyo',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tokyo_chuo_city',
      datasetUrl: 'https://ckan.odpt.org/dataset/tokyo_chuo_city_alldata',
      resourceUrl:
        'https://ckan.odpt.org/dataset/tokyo_chuo_city_alldata/resource/6674c46b-d4aa-44a6-a427-0862df7b7189',
      resourceId: '6674c46b-d4aa-44a6-a427-0862df7b7189',
    },
    provider: {
      name: {
        ja: { long: '中央区役所', short: '江戸バス' },
        en: { long: 'Chuo City Office', short: 'Edo Bus' },
      },
      colors: [{ bg: '1A3282', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['bus'],
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/TokyoChuoCity/Alldata.zip?date=20250108',
  },
  pipeline: {
    outDir: 'chuo-bus',
    prefix: 'edobus',
  },
};

export default chuoBus;
