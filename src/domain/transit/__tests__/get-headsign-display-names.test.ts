import { describe, expect, it } from 'vitest';
import { getHeadsignDisplayNames } from '../get-headsign-display-names';
import type { Route } from '../../../types/app/transit';
import type { RouteDirection } from '../../../types/app/transit-composed';
import type { InfoLevel } from '../../../types/app/settings';

/** Bus route: short name only (e.g. Keio Bus, Kanto Bus). */
function makeBusRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'kobus:1021',
    route_short_name: '渋63',
    route_long_name: '',
    route_names: {},
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
    route_long_name: '大江戸線',
    route_names: {},
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
    route_long_name: '大江戸線',
    route_names: {},
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
    route_long_name: '',
    route_names: {},
    route_type: 3,
    route_color: '',
    route_text_color: '',
    agency_id: '',
    ...overrides,
  };
}

/** Create a RouteDirection with sensible defaults. */
function makeRouteDirection(overrides?: Partial<RouteDirection>): RouteDirection {
  return {
    route: makeBusRoute(),
    headsign: '新宿駅西口',
    headsign_names: {},
    ...overrides,
  };
}

describe('getHeadsignDisplayNames', () => {
  // --- Headsign present: use as-is ---

  it('returns headsign when present', () => {
    const result = getHeadsignDisplayNames(makeRouteDirection(), 'normal');
    expect(result.name).toBe('新宿駅西口');
  });

  it('returns headsign even when route has names', () => {
    const rd = makeRouteDirection({ route: makeBothRoute(), headsign: '渋谷駅' });
    const result = getHeadsignDisplayNames(rd, 'normal');
    expect(result.name).toBe('渋谷駅');
  });

  // --- Headsign empty: no route fallback ---

  it('returns empty name when headsign is empty (no route fallback)', () => {
    const rd = makeRouteDirection({ headsign: '' });
    const result = getHeadsignDisplayNames(rd, 'normal');
    expect(result.name).toBe('');
  });

  it('returns empty name regardless of route names', () => {
    expect(
      getHeadsignDisplayNames(
        makeRouteDirection({ route: makeTrainRoute(), headsign: '' }),
        'normal',
      ).name,
    ).toBe('');
    expect(
      getHeadsignDisplayNames(
        makeRouteDirection({ route: makeBothRoute(), headsign: '' }),
        'normal',
      ).name,
    ).toBe('');
    expect(
      getHeadsignDisplayNames(
        makeRouteDirection({ route: makeEmptyRoute(), headsign: '' }),
        'normal',
      ).name,
    ).toBe('');
  });

  // --- subNames with headsign_names translations ---

  it('returns subNames from headsign_names at normal+ level', () => {
    const rd = makeRouteDirection({
      headsign: '新橋駅前',
      headsign_names: {
        ja: '新橋駅前',
        'ja-Hrkt': 'しんばしえきまえ',
        en: 'Shimbashi Sta.',
      },
    });
    const result = getHeadsignDisplayNames(rd, 'normal');
    expect(result.name).toBe('新橋駅前');
    // ja value matches name, so excluded. ja-Hrkt and en are included.
    expect(result.subNames).toContain('しんばしえきまえ');
    expect(result.subNames).toContain('Shimbashi Sta.');
    expect(result.subNames).not.toContain('新橋駅前');
  });

  it('returns empty subNames when headsign_names is empty', () => {
    const rd = makeRouteDirection({ headsign_names: {} });
    const result = getHeadsignDisplayNames(rd, 'normal');
    expect(result.subNames).toEqual([]);
  });

  it('returns empty subNames at simple level even with headsign_names', () => {
    const rd = makeRouteDirection({
      headsign_names: { 'ja-Hrkt': 'しんじゅくえきにしぐち', en: 'Shinjuku Sta. West' },
    });
    const result = getHeadsignDisplayNames(rd, 'simple');
    expect(result.subNames).toEqual([]);
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
    const result = getHeadsignDisplayNames(rd, 'normal');
    expect(result.subNames).toEqual(['Shibuya Sta.']);
  });

  // --- infoLevel does not affect name resolution ---

  it.each<InfoLevel>(['simple', 'normal', 'detailed', 'verbose'])(
    'resolves the same name at %s level',
    (level) => {
      expect(getHeadsignDisplayNames(makeRouteDirection(), level).name).toBe('新宿駅西口');
      expect(getHeadsignDisplayNames(makeRouteDirection({ headsign: '' }), level).name).toBe('');
      expect(
        getHeadsignDisplayNames(
          makeRouteDirection({ route: makeTrainRoute(), headsign: '' }),
          level,
        ).name,
      ).toBe('');
    },
  );

  // --- Edge cases ---

  it('does not treat whitespace-only headsign as empty', () => {
    const rd = makeRouteDirection({ headsign: ' ' });
    const result = getHeadsignDisplayNames(rd, 'normal');
    expect(result.name).toBe(' ');
  });

  it('returns subNames at detailed and verbose levels', () => {
    const rd = makeRouteDirection({
      headsign: '東京駅',
      headsign_names: { en: 'Tokyo Sta.' },
    });
    expect(getHeadsignDisplayNames(rd, 'detailed').subNames).toEqual(['Tokyo Sta.']);
    expect(getHeadsignDisplayNames(rd, 'verbose').subNames).toEqual(['Tokyo Sta.']);
  });
});
