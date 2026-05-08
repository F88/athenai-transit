import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const itsukishimaKisen: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Itsukishima Kisen',
    nameJa: '斎島汽船',
    description:
      'GTFS-JP static data for Itsukishima Kisen, a small ferry operator serving the islands of Sai-jima (Itsukishima), Toyo-shima, Mikado, and Kubi off Kure City, Hiroshima.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/itsukishima_kisen',
      datasetUrl: 'https://ckan.odpt.org/dataset/itsukishima_kisen_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/itsukishima_kisen_all_lines/resource/4c61a823-c0b9-4262-8226-9ddf6b77d886',
      resourceId: '4c61a823-c0b9-4262-8226-9ddf6b77d886',
    },
    provider: {
      name: {
        ja: { long: '斎島汽船株式会社', short: '斎島汽船' },
        en: { long: 'Itsukishima Kisen Co., Ltd.', short: 'Itsukishima Kisen' },
      },
      url: 'https://www.city.kure.lg.jp/soshiki/28/koutu.html',
      colors: [{ bg: '000000', text: 'FFFFFF' } /* Primary */],
    },
    authentication: {
      required: true,
      method: 'acl:consumerKey query parameter',
      registrationUrl: 'https://developer.odpt.org/',
    },

    /** GtfsResource */
    routeTypes: ['ferry'],
    // The date parameter is required and must match a published version on CKAN.
    // Update this value when a new version is published.
    downloadUrl:
      'https://api.odpt.org/api/v4/files/odpt/ItsukishimaKisen/AllLines.zip?date=20251001',
  },
  pipeline: {
    outDir: 'itsukishima-kisen',
    prefix: 'itkfry',
  },
};

export default itsukishimaKisen;
