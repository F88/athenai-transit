import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const toeiTrain: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Toei Train',
    nameJa: '都営電車',
    description:
      'Toei Subway (Asakusa, Mita, Shinjuku, Oedo lines), Tokyo Sakura Tram (Arakawa Line), and Nippori-Toneri Liner',
    dataFormat: { type: 'GTFS/GTFS-JP', jpVersion: '3.0' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'odpt',
      resourceId: '35b68908-4558-47ae-bfa5-867e58544a1a',
      url: 'https://ckan.odpt.org/dataset/train-toei/resource/35b68908-4558-47ae-bfa5-867e58544a1a',
    },
    provider: {
      name: {
        ja: { long: '東京都交通局', short: '都営交通' },
        en: { long: 'Bureau of Transportation, Tokyo Metropolitan Government', short: 'Toei' },
      },
      url: 'https://www.kotsu.metro.tokyo.jp/',
      colors: [{ bg: '009f40', text: 'FFFFFF' }],
    },
    // GTFS ZIP files on api-public.odpt.org are publicly accessible without a token.
    // Only the JSON API (download-odpt-json) requires authentication.
    authentication: { required: false },

    /** GtfsResource */
    routeTypes: ['tram', 'subway', 'monorail'],
    routeColorFallbacks: {
      '5': 'C93896', // Nippori-Toneri Liner
      '6': '6CA782', // Tokyo Sakura Tram (Arakawa Line)
    },
    mlitShapeMapping: {
      operator: '東京都',
      lineToRouteId: {
        '1号線浅草線': 'toaran:1',
        '6号線三田線': 'toaran:2',
        '10号線新宿線': 'toaran:3',
        '12号線大江戸線': 'toaran:4',
        '日暮里・舎人ライナー': 'toaran:5',
        荒川線: 'toaran:6',
      },
    },
    downloadUrl: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip',
  },
  pipeline: {
    outDir: 'toei-train',
    prefix: 'toaran',
  },
};

export default toeiTrain;
