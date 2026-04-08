import { describe, expect, it } from 'vitest';
import { getHeadsignDisplayNames } from '../get-headsign-display-names';
import type { Route } from '../../../types/app/transit';
import type { RouteDirection } from '../../../types/app/transit-composed';

/** Bus route: short name only (e.g. Keio Bus, Kanto Bus). */
function makeBusRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'kobus:1021',
    route_short_name: '渋63',
    route_short_names: {},
    route_long_name: '',
    route_long_names: {},
    route_type: 3,
    route_color: '00377E',
    route_text_color: 'FFFFFF',
    agency_id: '',
    ...overrides,
  };
}

/** Train route: long name only. */
function makeTrainRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'toaran:E',
    route_short_name: '',
    route_short_names: {},
    route_long_name: '大江戸線',
    route_long_names: {},
    route_type: 1,
    route_color: 'B6007A',
    route_text_color: 'FFFFFF',
    agency_id: '',
    ...overrides,
  };
}

/** Route with both short and long names. */
function makeBothRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'toaran:E',
    route_short_name: 'E',
    route_short_names: {},
    route_long_name: '大江戸線',
    route_long_names: {},
    route_type: 1,
    route_color: 'B6007A',
    route_text_color: 'FFFFFF',
    agency_id: '',
    ...overrides,
  };
}

/** Route with no names at all. */
function makeEmptyRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'test:999',
    route_short_name: '',
    route_short_names: {},
    route_long_name: '',
    route_long_names: {},
    route_type: 3,
    route_color: '',
    route_text_color: '',
    agency_id: '',
    ...overrides,
  };
}

/** Create a RouteDirection with sensible defaults. */
function makeRouteDirection(
  overrides?: Partial<RouteDirection> & {
    headsign?: string;
    headsign_names?: Record<string, string>;
  },
): RouteDirection {
  const { headsign, headsign_names, tripHeadsign, stopHeadsign, route, direction } =
    overrides ?? {};
  return {
    route: route ?? makeBusRoute(),
    tripHeadsign: tripHeadsign ?? {
      name: headsign ?? '新宿駅西口',
      names: headsign_names ?? {},
    },
    stopHeadsign,
    direction,
  };
}

const DEFAULT_DISPLAY_LANGS = ['ja'] as const;
const DEFAULT_AGENCY_LANG = ['ja'];

describe('getHeadsignDisplayNames', () => {
  // --- Headsign present: use as-is ---

  it('returns headsign when present', () => {
    const result = getHeadsignDisplayNames(
      makeRouteDirection(),
      DEFAULT_DISPLAY_LANGS,
      DEFAULT_AGENCY_LANG,
      'stop',
    );
    expect(result.resolved.name).toBe('新宿駅西口');
    expect(result.resolvedSource).toBe('trip');
  });

  it('returns headsign even when route has names', () => {
    const rd = makeRouteDirection({ route: makeBothRoute(), headsign: '渋谷駅' });
    const result = getHeadsignDisplayNames(rd, DEFAULT_DISPLAY_LANGS, DEFAULT_AGENCY_LANG, 'stop');
    expect(result.resolved.name).toBe('渋谷駅');
  });

  // --- Headsign empty: no route fallback ---

  it('returns empty name when headsign is empty (no route fallback)', () => {
    const rd = makeRouteDirection({ headsign: '' });
    const result = getHeadsignDisplayNames(rd, DEFAULT_DISPLAY_LANGS, DEFAULT_AGENCY_LANG, 'stop');
    expect(result.resolved.name).toBe('');
  });

  it('returns empty name regardless of route names', () => {
    expect(
      getHeadsignDisplayNames(
        makeRouteDirection({ route: makeTrainRoute(), headsign: '' }),
        DEFAULT_DISPLAY_LANGS,
        DEFAULT_AGENCY_LANG,
        'stop',
      ).resolved.name,
    ).toBe('');
    expect(
      getHeadsignDisplayNames(
        makeRouteDirection({ route: makeBothRoute(), headsign: '' }),
        DEFAULT_DISPLAY_LANGS,
        DEFAULT_AGENCY_LANG,
        'stop',
      ).resolved.name,
    ).toBe('');
    expect(
      getHeadsignDisplayNames(
        makeRouteDirection({ route: makeEmptyRoute(), headsign: '' }),
        DEFAULT_DISPLAY_LANGS,
        DEFAULT_AGENCY_LANG,
        'stop',
      ).resolved.name,
    ).toBe('');
  });

  // --- subNames with headsign_names translations ---

  it('returns subNames from headsign_names', () => {
    const rd = makeRouteDirection({
      headsign: '新橋駅前',
      headsign_names: {
        ja: '新橋駅前',
        'ja-Hrkt': 'しんばしえきまえ',
        en: 'Shimbashi Sta.',
      },
    });
    const result = getHeadsignDisplayNames(rd, DEFAULT_DISPLAY_LANGS, DEFAULT_AGENCY_LANG, 'stop');
    expect(result.resolved.name).toBe('新橋駅前');
    // ja value matches name, so excluded. ja-Hrkt and en are included.
    expect(result.resolved.subNames).toContain('しんばしえきまえ');
    expect(result.resolved.subNames).toContain('Shimbashi Sta.');
    expect(result.resolved.subNames).not.toContain('新橋駅前');
    expect(result.resolved.subNames).toHaveLength(2);
  });

  it('returns empty subNames when headsign_names is empty', () => {
    const rd = makeRouteDirection({ headsign_names: {} });
    const result = getHeadsignDisplayNames(rd, DEFAULT_DISPLAY_LANGS, DEFAULT_AGENCY_LANG, 'stop');
    expect(result.resolved.subNames).toEqual([]);
  });

  it('excludes duplicate values in subNames', () => {
    const rd = makeRouteDirection({
      headsign: '渋谷駅',
      headsign_names: {
        ja: '渋谷駅',
        'ja-Hrkt': '渋谷駅', // same as name — should be excluded
        en: 'Shibuya Sta.',
      },
    });
    const result = getHeadsignDisplayNames(rd, DEFAULT_DISPLAY_LANGS, DEFAULT_AGENCY_LANG, 'stop');
    expect(result.resolved.subNames).toEqual(['Shibuya Sta.']);
  });

  // --- lang resolution ---

  it('resolves name for specified lang', () => {
    const rd = makeRouteDirection({
      headsign: '東京駅',
      headsign_names: { en: 'Tokyo Sta.', ja: '東京駅' },
    });
    const result = getHeadsignDisplayNames(rd, ['en'], DEFAULT_AGENCY_LANG, 'stop');
    expect(result.resolved.name).toBe('Tokyo Sta.');
  });

  // --- Edge cases ---

  it('does not treat whitespace-only headsign as empty', () => {
    const rd = makeRouteDirection({ headsign: ' ' });
    const result = getHeadsignDisplayNames(rd, DEFAULT_DISPLAY_LANGS, DEFAULT_AGENCY_LANG, 'stop');
    expect(result.resolved.name).toBe(' ');
  });

  it('returns subNames with translations', () => {
    const rd = makeRouteDirection({
      headsign: '東京駅',
      headsign_names: { en: 'Tokyo Sta.' },
    });
    const result = getHeadsignDisplayNames(rd, DEFAULT_DISPLAY_LANGS, DEFAULT_AGENCY_LANG, 'stop');
    expect(result.resolved.subNames).toEqual(['Tokyo Sta.']);
  });

  // --- tripName / stopName fields ---

  it('returns tripName as ResolvedDisplayNames', () => {
    const rd = makeRouteDirection({
      headsign: '新宿駅西口',
      headsign_names: { en: 'Shinjuku Sta. West' },
    });
    const result = getHeadsignDisplayNames(rd, DEFAULT_DISPLAY_LANGS, DEFAULT_AGENCY_LANG, 'stop');
    expect(result.tripName.name).toBe('新宿駅西口');
    expect(result.tripName.subNames).toEqual(['Shinjuku Sta. West']);
    expect(result.stopName).toBeUndefined();
  });

  // --- stop_headsign (stopHeadsign present) ---

  describe('stop_headsign override', () => {
    const kyotoRd = makeRouteDirection({
      tripHeadsign: { name: 'A経由B', names: { en: 'B via A', de: 'B über A' } },
      stopHeadsign: { name: 'B', names: { en: 'B-en', de: 'B-de' } },
    });

    it('returns stopName and tripName as ResolvedDisplayNames', () => {
      const result = getHeadsignDisplayNames(
        kyotoRd,
        DEFAULT_DISPLAY_LANGS,
        DEFAULT_AGENCY_LANG,
        'stop',
      );
      expect(result.stopName).toBeDefined();
      expect(result.stopName!.name).toBe('B');
      expect(result.tripName.name).toBe('A経由B');
    });

    it('effective name is stop_headsign by default (prefer=stop)', () => {
      const result = getHeadsignDisplayNames(
        kyotoRd,
        DEFAULT_DISPLAY_LANGS,
        DEFAULT_AGENCY_LANG,
        'stop',
      );
      expect(result.resolved.name).toBe('B');
      expect(result.resolvedSource).toBe('stop');
    });

    it('effective name is trip_headsign when prefer=trip', () => {
      const result = getHeadsignDisplayNames(
        kyotoRd,
        DEFAULT_DISPLAY_LANGS,
        DEFAULT_AGENCY_LANG,
        'trip',
      );
      expect(result.resolved.name).toBe('A経由B');
      expect(result.resolvedSource).toBe('trip');
    });

    it('resolves tripName and stopName for lang=en', () => {
      const result = getHeadsignDisplayNames(kyotoRd, ['en'], DEFAULT_AGENCY_LANG, 'stop');
      expect(result.resolved.name).toBe('B-en');
      expect(result.tripName.name).toBe('B via A');
      expect(result.stopName!.name).toBe('B-en');
    });

    it('subNames contain only effective entity translations (no mixing)', () => {
      const result = getHeadsignDisplayNames(
        kyotoRd,
        DEFAULT_DISPLAY_LANGS,
        DEFAULT_AGENCY_LANG,
        'stop',
      );
      // effective = stopName. subNames are stopHeadsign translations only.
      expect(result.resolved.subNames).toContain('B-en');
      expect(result.resolved.subNames).toContain('B-de');
      expect(result.resolved.subNames).not.toContain('B'); // matches name
      expect(result.resolved.subNames).not.toContain('A経由B'); // tripName is separate
      expect(result.resolved.subNames).toHaveLength(2);
    });

    it('subNames for lang=en exclude resolved name', () => {
      const result = getHeadsignDisplayNames(kyotoRd, ['en'], DEFAULT_AGENCY_LANG, 'stop');
      expect(result.resolved.subNames).toContain('B-de');
      expect(result.resolved.subNames).not.toContain('B-en'); // matches name
      expect(result.resolved.subNames).not.toContain('B via A'); // tripName is separate
      expect(result.resolved.subNames).toHaveLength(2); // B-de + origin "B"
    });

    it('fallback: prefer=stop with no stopHeadsign uses tripHeadsign', () => {
      const rd = makeRouteDirection({
        tripHeadsign: { name: 'X', names: {} },
      });
      const result = getHeadsignDisplayNames(
        rd,
        DEFAULT_DISPLAY_LANGS,
        DEFAULT_AGENCY_LANG,
        'stop',
      );
      expect(result.resolved.name).toBe('X');
      expect(result.resolvedSource).toBe('trip');
      expect(result.stopName).toBeUndefined();
    });

    it('fallback: prefer=trip with empty tripHeadsign uses stopHeadsign', () => {
      const rd = makeRouteDirection({
        tripHeadsign: { name: '', names: {} },
        stopHeadsign: { name: 'Y', names: {} },
      });
      const result = getHeadsignDisplayNames(
        rd,
        DEFAULT_DISPLAY_LANGS,
        DEFAULT_AGENCY_LANG,
        'trip',
      );
      expect(result.resolved.name).toBe('Y');
      expect(result.resolvedSource).toBe('stop');
    });
  });
});
