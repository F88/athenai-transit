import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const sanwaShosen: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'Sanwa Shosen',
    nameJa: '三和商船',
    description:
      'GTFS-JP static data for ferry services between Ushibuka Port (Kumamoto) and Kuranomoto Port (Kagoshima) operated by SANWASHOSEN Co.,Ltd.',
    dataFormat: { type: 'GTFS/GTFS-JP' },
    license: {
      name: '公共交通オープンデータ基本ライセンス',
      url: 'https://developer.odpt.org/terms/data_basic_license.html',
    },
    catalog: {
      type: 'odpt',
      organizationUrl: 'https://ckan.odpt.org/organization/sanwa_merchant_vessel',
      datasetUrl: 'https://ckan.odpt.org/dataset/sanwa_merchant_vessel_all_lines',
      resourceUrl:
        'https://ckan.odpt.org/dataset/sanwa_merchant_vessel_all_lines/resource/099eb941-9f04-40b2-9a3a-0b4808cc30b1',
      resourceId: '099eb941-9f04-40b2-9a3a-0b4808cc30b1',
    },
    provider: {
      name: {
        ja: { long: '三和商船株式会社', short: '三和商船' },
        en: { long: 'SANWASHOSEN Co.,Ltd.', short: 'Sanwa Shosen' },
      },
      url: 'https://ezax.co.jp/',
      colors: [{ bg: '0844A6', text: 'FFFFFF' } /* Primary */],
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
      'https://api.odpt.org/api/v4/files/odpt/SanwaMerchantVessel/AllLines.zip?date=20260105',
  },
  pipeline: {
    outDir: 'sanwa-shosen',
    prefix: 'snws',
  },
};

export default sanwaShosen;
