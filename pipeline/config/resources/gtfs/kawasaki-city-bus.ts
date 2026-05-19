import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const kawasakiCityBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Kawasaki City Bus',
    nameJa: '川崎市バス',
    description:
      'GTFS-JP static data for Kawasaki Municipal Bus (operated by the Transportation Bureau, City of Kawasaki).',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/transportation_bureau_city_of_kawasaki',
      datasetUrl: 'https://ckan.odpt.org/dataset/transportation_bureau_city_of_kawasaki_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/transportation_bureau_city_of_kawasaki_all_lines/resource/1c11d79e-2553-4e05-9312-b756397827b5',
      resourceId: '1c11d79e-2553-4e05-9312-b756397827b5',
    },
    provider: {
      name: {
        ja: { long: '川崎市交通局', short: '川崎市バス' },
        en: { long: 'Kawasaki City Transportation Bureau', short: 'Kawasaki City Bus' },
      },
      url: 'https://www.city.kawasaki.jp/820/',
      colors: [
        { bg: '8AC4F5', text: 'FFFFFF' } /* Primary */,
        { bg: '1B69BF', text: 'FFFFFF' } /* Secondary */,
      ],
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
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/TransportationBureau_CityOfKawasaki/AllLines.zip?date=20260428',
  },
  pipeline: {
    outDir: 'kawasaki-city-bus',
    prefix: 'norufin',
  },
};

export default kawasakiCityBus;
