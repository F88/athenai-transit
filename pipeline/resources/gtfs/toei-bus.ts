import type { GtfsSourceDefinition } from '../../types/gtfs-resource';

const toeiBus: GtfsSourceDefinition = {
  resource: {
    nameEn: 'Toei Bus',
    nameJa: '都営バス',
    description:
      'GTFS static data for Toei Bus operated by Bureau of Transportation, Tokyo Metropolitan Government',
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    dataFormat: { type: 'GTFS/GTFS-JP', jpVersion: '3.0' },
    routeTypes: ['bus'],
    downloadUrl: 'https://api-public.odpt.org/api/v4/files/Toei/data/ToeiBus-GTFS.zip',
    catalog: {
      type: 'odpt',
      resourceId: '171a583d-4bf3-4f71-ae57-16f2140babda',
      url: 'https://ckan.odpt.org/dataset/b_bus_gtfs_jp-toei/resource/171a583d-4bf3-4f71-ae57-16f2140babda',
    },
    provider: {
      nameJa: '東京都交通局',
      nameEn: 'Bureau of Transportation, Tokyo Metropolitan Government',
      url: 'https://www.kotsu.metro.tokyo.jp/bus/',
    },
    // GTFS ZIP files on api-public.odpt.org are publicly accessible without a token.
    // Only the JSON API (download-odpt-json) requires authentication.
    authentication: { required: false },
  },
  pipeline: {
    outDir: 'toei-bus',
    prefix: 'minkuru',
  },
};

export default toeiBus;
