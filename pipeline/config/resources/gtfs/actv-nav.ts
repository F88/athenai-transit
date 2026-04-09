import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const actvNav: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'ACTV Navigazione',
    nameJa: 'ACTV Navigazione',
    description:
      'GTFS static data for vaporetto (water bus) ferry services in Venice operated by ACTV S.p.A.',
    dataFormat: { type: 'GTFS' },
    license: {
      name: 'CC BY 4.0',
      url: 'https://creativecommons.org/licenses/by/4.0/',
    },
    catalog: {
      type: 'municipal',
      url: 'https://dati.venezia.it/?q=content/actv-general-transit-feed-specification-gtfs',
    },
    provider: {
      name: {
        ja: { long: 'Azienda Veneziana della Mobilità', short: 'ACTV' },
        en: { long: 'Azienda Veneziana della Mobilità', short: 'ACTV' },
        it: { long: 'Azienda Veneziana della Mobilità', short: 'ACTV' },
      },
      url: 'http://www.actv.it/',
      colors: [{ bg: '009FE3', text: 'FFFFFF' } /* ACTV Blue */],
    },
    authentication: {
      required: false,
    },

    /** GtfsResource */
    routeTypes: ['ferry'],
    downloadUrl:
      'https://actv.avmspa.it/sites/default/files/attachments/opendata/navigazione/actv_nav.zip',
  },
  pipeline: {
    outDir: 'actv-nav',
    prefix: 'actvnav',
  },
};

export default actvNav;
