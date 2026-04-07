/**
 * Tests for get-effective-headsign.ts.
 *
 * @vitest-environment node
 */

import { describe, expect, it } from 'vitest';

import type { RouteDirection } from '../../../types/app/transit-composed';
import { getEffectiveHeadsign } from '../get-effective-headsign';
import { getHeadsignDisplayNames } from '../get-headsign-display-names';

function makeRD(tripName: string, stopName?: string): RouteDirection {
  return {
    route: {
      route_id: 'r1',
      route_short_name: 'R1',
      route_long_name: '',
      route_names: {},
      route_type: 3,
      route_color: '',
      route_text_color: '',
      agency_id: 'a1',
    },
    tripHeadsign: { name: tripName, names: {} },
    stopHeadsign: stopName != null ? { name: stopName, names: {} } : undefined,
  };
}

describe('getEffectiveHeadsign', () => {
  it('returns tripHeadsign when stopHeadsign is absent', () => {
    expect(getEffectiveHeadsign(makeRD('Terminal A'))).toBe('Terminal A');
  });

  it('returns stopHeadsign when present (GTFS override)', () => {
    expect(getEffectiveHeadsign(makeRD('Terminal A', 'Mid Stop'))).toBe('Mid Stop');
  });

  it('returns stopHeadsign when tripHeadsign is empty (keio-bus pattern)', () => {
    expect(getEffectiveHeadsign(makeRD('', 'Musashi-koganei'))).toBe('Musashi-koganei');
  });

  it('returns empty when both are empty', () => {
    expect(getEffectiveHeadsign(makeRD(''))).toBe('');
  });

  it('falls back to tripHeadsign when stopHeadsign is empty string', () => {
    // stopHeadsign with empty name — should fall back to trip
    expect(getEffectiveHeadsign(makeRD('Terminal A', ''))).toBe('Terminal A');
  });
});

/**
 * Parity tests: verify that getEffectiveHeadsign (raw key) and
 * getHeadsignDisplayNames (display resolver) select the same
 * effective headsign for all RouteDirection configurations.
 *
 * These tests guard against divergence between the grouping/filter
 * key and the displayed label.
 */
describe('getEffectiveHeadsign / getHeadsignDisplayNames parity', () => {
  const DISPLAY_LANGS = ['ja'] as const;
  const AGENCY_LANG = ['ja'] as const;

  function makeRDWithNames(
    tripName: string,
    tripNames: Record<string, string>,
    stopName?: string,
    stopNames?: Record<string, string>,
  ): RouteDirection {
    return {
      route: {
        route_id: 'r1',
        route_short_name: 'R1',
        route_long_name: '',
        route_names: {},
        route_type: 3,
        route_color: '',
        route_text_color: '',
        agency_id: 'a1',
      },
      tripHeadsign: { name: tripName, names: tripNames },
      stopHeadsign: stopName != null ? { name: stopName, names: stopNames ?? {} } : undefined,
    };
  }

  it('trip only — both return tripHeadsign', () => {
    const rd = makeRDWithNames('中野駅', { en: 'Nakano Sta.' });
    expect(getEffectiveHeadsign(rd)).toBe('中野駅');
    expect(getHeadsignDisplayNames(rd, DISPLAY_LANGS, AGENCY_LANG, 'stop').resolved.name).toBe(
      '中野駅',
    );
  });

  it('stop overrides trip — both return stopHeadsign', () => {
    const rd = makeRDWithNames('潮見駅前', {}, '木場ルート(循環)', { en: 'Kiba Route (loop)' });
    expect(getEffectiveHeadsign(rd)).toBe('木場ルート(循環)');
    expect(getHeadsignDisplayNames(rd, DISPLAY_LANGS, AGENCY_LANG, 'stop').resolved.name).toBe(
      '木場ルート(循環)',
    );
  });

  it('trip empty + stop present — both return stopHeadsign', () => {
    const rd = makeRDWithNames('', {}, '武蔵小金井駅南口', {});
    expect(getEffectiveHeadsign(rd)).toBe('武蔵小金井駅南口');
    expect(getHeadsignDisplayNames(rd, DISPLAY_LANGS, AGENCY_LANG, 'stop').resolved.name).toBe(
      '武蔵小金井駅南口',
    );
  });

  it('both empty — both return empty string', () => {
    const rd = makeRDWithNames('', {});
    expect(getEffectiveHeadsign(rd)).toBe('');
    expect(getHeadsignDisplayNames(rd, DISPLAY_LANGS, AGENCY_LANG, 'stop').resolved.name).toBe('');
  });

  it('stop empty fallback — both return tripHeadsign', () => {
    const rd = makeRDWithNames('渋谷駅前', {}, '', {});
    expect(getEffectiveHeadsign(rd)).toBe('渋谷駅前');
    expect(getHeadsignDisplayNames(rd, DISPLAY_LANGS, AGENCY_LANG, 'stop').resolved.name).toBe(
      '渋谷駅前',
    );
  });

  it('lang resolution does not break parity (same effective source)', () => {
    const rd = makeRDWithNames('出町柳駅', { en: 'Demachiyanagi Sta.' }, '北大路BT', {
      en: 'Kitaoji BT',
    });
    // Raw key uses stop (ja)
    expect(getEffectiveHeadsign(rd)).toBe('北大路BT');
    // Display resolver also uses stop, but resolved for lang=en
    const names = getHeadsignDisplayNames(rd, ['en'], AGENCY_LANG, 'stop');
    expect(names.resolvedSource).toBe('stop');
    // Both chose the same source (stop), though the displayed value differs by language
    expect(names.resolved.name).toBe('Kitaoji BT');
  });
});
