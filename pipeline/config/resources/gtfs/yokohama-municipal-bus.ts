import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const yokohamaMunicipalBus: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Yokohama Municipal Bus',
    nameJa: '横浜市営バス',
    description:
      'GTFS-JP static data for Yokohama Municipal Bus (operated by the Transportation Bureau, City of Yokohama). 149 routes / 2,516 stops covering the entire Yokohama City area.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/yokohama_municipal',
      datasetUrl: 'https://ckan.odpt.org/dataset/yokohama_municipal_bus',
      resourceUrl:
        'https://ckan.odpt.org/dataset/yokohama_municipal_bus/resource/dcef4dad-fa17-48cc-a789-a7fc708b49e4',
      resourceId: 'dcef4dad-fa17-48cc-a789-a7fc708b49e4',
    },
    provider: {
      name: {
        ja: { long: '横浜市交通局', short: '横浜市営バス' },
        en: { long: 'Yokohama City Transportation Bureau', short: 'Yokohama Municipal Bus' },
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
    routeTypes: ['bus'],
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl: 'https://api.odpt.org/api/v4/files/odpt/YokohamaMunicipal/Bus.zip?date=20260328',
  },
  pipeline: {
    outDir: 'yokohama-municipal-bus',
    prefix: 'yhb',
  },
};

export default yokohamaMunicipalBus;
