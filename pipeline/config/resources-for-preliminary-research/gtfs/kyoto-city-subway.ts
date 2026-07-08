import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const kyotoCitySubway: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Kyoto City Subway',
    nameJa: '京都市営地下鉄',
    description:
      'GTFS-JP static data for Kyoto City Subway operated by Kyoto Municipal Transportation',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    notes: [
      'Preliminary survey only',
      "Published exclusively for the '公共交通オープンデータチャレンジ2026' (Public Transportation Open Data Challenge 2026), available only during the challenge period 2026-07-01 to 2027-03-12.",
    ],
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/kyoto_municipal_transportation',
      datasetUrl:
        'https://ckan.odpt.org/dataset/kyoto_municipal_transportation_kyoto_city_subway_gtfs',
      resourceUrl:
        'https://ckan.odpt.org/dataset/kyoto_municipal_transportation_kyoto_city_subway_gtfs/resource/e5ad5273-fd1f-4c80-b5c8-cdfcde2c4bd8',
      resourceId: 'e5ad5273-fd1f-4c80-b5c8-cdfcde2c4bd8',
    },
    provider: {
      name: {
        ja: { long: '京都市交通局', short: '京都市営地下鉄' },
        en: { long: 'Kyoto Municipal Transportation', short: 'Kyoto City Subway' },
      },
      url: 'https://www.city.kyoto.lg.jp/kotsu/',
      colors: [{ bg: '138060', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },
    /** GtfsResource */
    routeTypes: ['subway'],
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/KyotoMunicipalTransportation/Kyoto_City_Subway_GTFS.zip?date=20260703',
    /**
     * Forward-looking metadata for future extensions (per-URL validity,
     * multiple versions across timetable revisions, deferred availability).
     * Not consumed by the pipeline or the app yet; retained as data only.
     */
    dataUrls: [
      {
        url: 'https://api.odpt.org/api/v4/files/odpt/KyotoMunicipalTransportation/Kyoto_City_Subway_GTFS.zip?date=20260703',
        validity: { from: '2026-07-01', until: '2027-03-12' },
        notes: ['Available only during the Public Transport Open Data Challenge 2026.'],
      },
    ],
  },
  pipeline: {
    outDir: 'kyoto-city-subway',
    prefix: 'kcsub',
  },
};

export default kyotoCitySubway;
