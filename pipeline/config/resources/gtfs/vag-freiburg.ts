import type { GtfsSourceDefinition } from '../../../src/types/gtfs-resource';

const vagFreiburg: GtfsSourceDefinition = {
  resource: {
    /** BaseResource */
    nameEn: 'VAG Freiburg',
    nameJa: 'VAG Freiburg',
    description:
      'GTFS static data for bus and tram services in Freiburg operated by Freiburger Verkehrs AG and Tuniberg Express',
    dataFormat: { type: 'GTFS' },
    license: {
      name: 'Datenlizenz Deutschland - Namensnennung - Version 2.0',
      url: 'https://www.govdata.de/dl-de/by-2-0',
    },
    catalog: {
      type: 'municipal',
      url: 'https://www.vag-freiburg.de/service-infos/downloads/gtfs-daten',
    },
    provider: {
      name: {
        ja: { long: 'Freiburger Verkehrs AG', short: 'VAG Freiburg' },
        en: { long: 'Freiburger Verkehrs AG', short: 'VAG Freiburg' },
        de: { long: 'Freiburger Verkehrs AG', short: 'VAG Freiburg' },
      },
      url: 'https://www.vag-freiburg.de/',
      colors: [
        { bg: 'E2001A', text: 'FFFFFF' } /* VAG Red (primary) */,
        { bg: '78B833', text: 'FFFFFF' } /* Eco Green (secondary) */,
      ],
    },
    authentication: {
      required: false,
    },

    /** GtfsResource */
    routeTypes: ['tram', 'bus'],
    downloadUrl: 'https://www.vag-freiburg.de/fileadmin/gtfs/VAGFR.zip',
  },
  pipeline: {
    outDir: 'vag-freiburg',
    prefix: 'vagfr',
  },
};

export default vagFreiburg;
