import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const keioTrain: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Keio Railway',
    nameJa: '京王電鉄',
    description: 'GTFS-JP static data for Keio Railway (train) operated by Keio Corporation',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータチャレンジ限定ライセンス',
      url: 'https://developer.odpt.org/challenge_license',
    },
    notes: [
      'Preliminary survey only',
      'Provided under the Public Transport Open Data Challenge Limited License.',
      'Served from api-challenge.odpt.org, not the regular ODPT host.',
      "Requires the Challenge 2026 access token (credential 'odpt-challenge-2026'), not ODPT_ACCESS_TOKEN.",
    ],
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/keio',
      datasetUrl: 'https://ckan.odpt.org/dataset/keio_train',
      resourceUrl:
        'https://ckan.odpt.org/dataset/keio_train/resource/2f1beecf-54f7-4c1f-8735-fdce2a18ed6e',
      resourceId: '2f1beecf-54f7-4c1f-8735-fdce2a18ed6e',
    },
    provider: {
      name: {
        ja: { long: '京王電鉄株式会社', short: '京王電鉄' },
        en: { long: 'Keio Corporation', short: 'Keio' },
      },
      url: 'https://www.keio.co.jp/',
      colors: [
        { bg: '00377E', text: 'FFFFFF' } /* Primary */,
        { bg: 'C8006B', text: 'FFFFFF' } /* Secondary */,
      ],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
      credential: 'odpt-challenge-2026',
    },
    /** GtfsResource */
    routeTypes: ['rail'],
    // Route shapes generated from MLIT/KSJ railway data (no shapes.txt in GTFS).
    // 京王新線 (route 2) has no distinct KSJ line, so it is left unmapped.
    mlitShapeMapping: {
      operator: '京王電鉄',
      lineToRouteId: {
        京王線: 'kotr:1',
        井の頭線: 'kotr:3',
        相模原線: 'kotr:4',
        競馬場線: 'kotr:5',
        動物園線: 'kotr:6',
        高尾線: 'kotr:7',
        // Unmapped (no shape): kotr:2 京王新線 -- no matching KSJ line.
      },
    },
    downloadUrl: 'https://api-challenge.odpt.org/api/v4/files/Keio/data/Keio-Train-GTFS.zip',
    /**
     * Forward-looking metadata for future extensions (per-URL validity,
     * multiple versions across timetable revisions, deferred availability).
     * Not consumed by the pipeline or the app yet; retained as data only.
     */
    dataUrls: [
      {
        url: 'https://api-challenge.odpt.org/api/v4/files/Keio/data/Keio-Train-GTFS.zip',
        validity: { from: '2026-07-01', until: '2027-03-12' },
        notes: ['Available only during the Public Transport Open Data Challenge 2026.'],
      },
    ],
  },
  pipeline: {
    outDir: 'keio-train',
    // NOTE: provisional prefix -- not yet locked in.
    prefix: 'kotr',
  },
};

export default keioTrain;
