import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const tobuTrain: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Tobu Railway',
    nameJa: '東武鉄道',
    description: 'GTFS-JP static data for Tobu Railway (train) operated by Tobu Railway Co., Ltd.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    // NOTE: provisional -- one of data_challenge_license.html / data_challenge2026_license.html.
    license: {
      name: '公共交通オープンデータチャレンジ限定ライセンス',
      url: 'https://developer.odpt.org/terms/data_challenge_license.html',
    },
    notes: [
      'Provided under the Public Transport Open Data Challenge Limited License.',
      'Served from api-challenge.odpt.org, not the regular ODPT host.',
      "Requires the Challenge 2026 access token (credential 'odpt-challenge-2026'), not ODPT_ACCESS_TOKEN.",
    ],
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/tobu',
      datasetUrl: 'https://ckan.odpt.org/dataset/tobu_train',
      resourceUrl:
        'https://ckan.odpt.org/dataset/tobu_train/resource/444851f8-a7b8-43ba-a17d-6d3ce8035006',
      resourceId: '444851f8-a7b8-43ba-a17d-6d3ce8035006',
    },
    provider: {
      name: {
        ja: { long: '東武鉄道株式会社', short: '東武鉄道' },
        en: { long: 'Tobu Railway Co., Ltd.', short: 'Tobu Railway' },
      },
      url: 'https://www.tobu.co.jp/',
      colors: [{ bg: '00458F', text: 'FFFFFF' }],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
      credential: 'odpt-challenge-2026',
    },
    /** GtfsResource */
    routeTypes: ['rail'],
    downloadUrl: 'https://api-challenge.odpt.org/api/v4/files/Tobu/data/Tobu-Train-GTFS.zip',
    /**
     * Forward-looking metadata for future extensions (per-URL validity,
     * multiple versions across timetable revisions, deferred availability).
     * Not consumed by the pipeline or the app yet; retained as data only.
     */
    dataUrls: [
      {
        url: 'https://api-challenge.odpt.org/api/v4/files/Tobu/data/Tobu-Train-GTFS.zip',
        validity: { from: '2026-07-01', until: '2027-03-12' },
        notes: ['Available only during the Public Transport Open Data Challenge 2026.'],
      },
    ],
  },
  pipeline: {
    outDir: 'tobu-train',
    // NOTE: provisional prefix -- not yet locked in.
    prefix: 'tobutr',
  },
};

export default tobuTrain;
