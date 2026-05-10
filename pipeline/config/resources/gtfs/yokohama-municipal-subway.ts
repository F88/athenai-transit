import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const yokohamaMunicipalSubway: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Yokohama Municipal Subway',
    nameJa: '横浜市営地下鉄',
    description:
      'GTFS-JP static data for Yokohama Municipal Subway (operated by the Transportation Bureau, City of Yokohama). Covers Blue Line (Shonandai-Azamino) and Green Line (Nakayama-Hiyoshi).',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/yokohama_municipal',
      datasetUrl: 'https://ckan.odpt.org/dataset/yokohama_municipal_train',
      resourceUrl:
        'https://ckan.odpt.org/dataset/yokohama_municipal_train/resource/27ed8a34-c89f-4c5c-98af-5950f04183e2',
      resourceId: '27ed8a34-c89f-4c5c-98af-5950f04183e2',
    },
    provider: {
      name: {
        ja: { long: '横浜市交通局', short: '横浜市営地下鉄' },
        en: { long: 'Yokohama City Transportation Bureau', short: 'Yokohama Municipal Subway' },
      },
      url: 'https://www.city.yokohama.lg.jp/kotsu/',
      colors: [
        { bg: '1B1464', text: 'FFFFFF' } /* Primary (Yokohama corporate navy) */,
        { bg: '0166B2', text: 'FFFFFF' } /* Secondary */,
      ],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['subway'],
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/YokohamaMunicipal/Train.zip?date=20251226',
  },
  pipeline: {
    outDir: 'yokohama-municipal-subway',
    prefix: 'yht',
  },
};

export default yokohamaMunicipalSubway;
