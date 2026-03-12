import type { GtfsSourceDefinition } from '../../types/gtfs-resource';

const toeiTrain: GtfsSourceDefinition = {
  resource: {
    nameEn: 'Toei Train',
    nameJa: '都営電車',
    description:
      'Toei Subway (Asakusa, Mita, Shinjuku, Oedo lines), Tokyo Sakura Tram (Arakawa Line), and Nippori-Toneri Liner',
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    dataFormat: { type: 'GTFS/GTFS-JP', jpVersion: '3.0' },
    routeTypes: ['tram', 'subway', 'monorail'],
    downloadUrl: 'https://api-public.odpt.org/api/v4/files/Toei/data/Toei-Train-GTFS.zip',
    catalog: {
      type: 'odpt',
      resourceId: '35b68908-4558-47ae-bfa5-867e58544a1a',
      url: 'https://ckan.odpt.org/dataset/train-toei/resource/35b68908-4558-47ae-bfa5-867e58544a1a',
    },
    provider: {
      nameJa: '東京都交通局',
      nameEn: 'Bureau of Transportation, Tokyo Metropolitan Government',
      url: 'https://www.kotsu.metro.tokyo.jp/',
    },
    // GTFS ZIP files on api-public.odpt.org are publicly accessible without a token.
    // Only the JSON API (download-odpt-json) requires authentication.
    authentication: { required: false },
  },
  pipeline: {
    outDir: 'toei-train',
    prefix: 'toaran',
  },
};

export default toeiTrain;
