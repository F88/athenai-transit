import { describe, it, expect } from 'vitest';
import { mergeSourcesV2 } from '..';
import type { SourceDataV2 } from '../../../datasources/transit-data-source-v2';

function createFeedLangFixture(): SourceDataV2 {
  return {
    prefix: 'itfeed',
    data: {
      bundle_version: 3,
      kind: 'data',
      stops: {
        v: 2,
        data: [{ v: 2, i: 'itfeed:s1', n: 'Stazione Centrale', a: 45.0, o: 9.0, l: 0 }],
      },
      routes: {
        v: 2,
        data: [
          {
            v: 2,
            i: 'itfeed:r1',
            s: 'L1',
            l: 'Linea 1',
            t: 3,
            c: '',
            tc: '',
            ai: 'itfeed:ag1',
          },
        ],
      },
      agency: {
        v: 2,
        data: [
          {
            v: 2,
            i: 'itfeed:ag1',
            n: 'Compagnia Trasporti',
            u: 'https://example.com',
            tz: 'Europe/Rome',
            l: 'en',
          },
        ],
      },
      calendar: { v: 1, data: { services: [], exceptions: [] } },
      feedInfo: {
        v: 1,
        data: { pn: 'Test', pu: 'https://example.com', l: 'it', s: '', e: '', v: '' },
      },
      timetable: { v: 2, data: {} },
      tripPatterns: {
        v: 2,
        data: {
          tp1: {
            v: 2,
            r: 'itfeed:r1',
            h: 'Stazione Centrale',
            stops: [{ id: 'itfeed:s1' }],
          },
        },
      },
      translations: {
        v: 1,
        data: {
          agency_names: {
            'itfeed:ag1': { en: 'English Transit Co.' },
          },
          route_long_names: {
            'itfeed:r1': { en: 'Line 1' },
          },
          route_short_names: {},
          stop_names: {
            'itfeed:s1': { en: 'Central Station' },
          },
          trip_headsigns: {
            'Stazione Centrale': { en: 'Central Station' },
          },
          stop_headsigns: {},
        },
      },
      lookup: { v: 2, data: {} },
    },
  };
}

describe('mergeSourcesV2 i18n pre-compilation', () => {
  it('injects headsign base value under feed_lang, not agency_lang', () => {
    const merged = mergeSourcesV2([createFeedLangFixture()]);
    const translations = merged.headsignTranslations.get('itfeed');
    expect(translations!.trip_headsigns['Stazione Centrale']).toEqual({
      it: 'Stazione Centrale',
      en: 'Central Station',
    });
  });

  it('injects stop_names base value under feed_lang', () => {
    const merged = mergeSourcesV2([createFeedLangFixture()]);
    const stop = merged.stops.find((item) => item.stop_id === 'itfeed:s1');
    expect(stop!.stop_names).toEqual({
      it: 'Stazione Centrale',
      en: 'Central Station',
    });
  });

  it('injects route_long_names base value under feed_lang', () => {
    const merged = mergeSourcesV2([createFeedLangFixture()]);
    const route = merged.routeMap.get('itfeed:r1');
    expect(route!.route_long_names).toEqual({
      it: 'Linea 1',
      en: 'Line 1',
    });
  });

  it('injects route_short_names base value under feed_lang', () => {
    const merged = mergeSourcesV2([createFeedLangFixture()]);
    const route = merged.routeMap.get('itfeed:r1');
    expect(route!.route_short_names).toEqual({ it: 'L1' });
  });

  it('merges route_short_names translations from pipeline into Route', () => {
    const source = createFeedLangFixture();
    source.data.translations.data.route_short_names = {
      'itfeed:r1': { en: 'L1 Express' },
    };

    const merged = mergeSourcesV2([source]);
    const route = merged.routeMap.get('itfeed:r1');
    expect(route!.route_short_names).toEqual({
      it: 'L1',
      en: 'L1 Express',
    });
    expect(route!.route_long_names).toEqual({
      it: 'Linea 1',
      en: 'Line 1',
    });
  });

  it('injects agency_names base value under feed_lang, not agency_lang', () => {
    const merged = mergeSourcesV2([createFeedLangFixture()]);
    const agency = merged.agencyMap.get('itfeed:ag1');
    expect(agency!.agency_names).toEqual({
      en: 'English Transit Co.',
      it: 'Compagnia Trasporti',
    });
  });

  it('uses empty names when agency has no entry in agency-attributes', () => {
    const merged = mergeSourcesV2([createFeedLangFixture()]);
    const agency = merged.agencyMap.get('itfeed:ag1');
    expect(agency!.agency_short_names).toEqual({});
    expect(agency!.agency_long_names).toEqual({});
    expect(agency!.agency_short_name).toBe('');
    expect(agency!.agency_long_name).toBe('');
  });
});
