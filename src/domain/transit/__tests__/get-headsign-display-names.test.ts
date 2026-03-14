import { describe, expect, it } from 'vitest';
import { getHeadsignDisplayNames } from '../get-headsign-display-names';
import type { Route } from '../../../types/app/transit';
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

describe('getHeadsignDisplayNames', () => {
  // --- Headsign present: use as-is ---

  it('returns headsign when present', () => {
    const result = getHeadsignDisplayNames('新宿駅西口', makeBusRoute(), 'normal');
    expect(result.name).toBe('新宿駅西口');
  });

  it('returns headsign even when route has names', () => {
    const result = getHeadsignDisplayNames('渋谷駅', makeBothRoute(), 'normal');
    expect(result.name).toBe('渋谷駅');
  });

  // --- Headsign empty: no route fallback ---

  it('returns empty name when headsign is empty (no route fallback)', () => {
    const result = getHeadsignDisplayNames('', makeBusRoute(), 'normal');
    expect(result.name).toBe('');
  });

  it('returns empty name regardless of route names', () => {
    expect(getHeadsignDisplayNames('', makeTrainRoute(), 'normal').name).toBe('');
    expect(getHeadsignDisplayNames('', makeBothRoute(), 'normal').name).toBe('');
    expect(getHeadsignDisplayNames('', makeEmptyRoute(), 'normal').name).toBe('');
  });

  // --- subNames (currently always empty) ---

  it('returns empty subNames at all info levels', () => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    for (const level of levels) {
      const result = getHeadsignDisplayNames('新宿駅西口', makeBusRoute(), level);
      expect(result.subNames).toEqual([]);
    }
  });

  // --- infoLevel does not affect name resolution ---

  it.each<InfoLevel>(['simple', 'normal', 'detailed', 'verbose'])(
    'resolves the same name at %s level',
    (level) => {
      expect(getHeadsignDisplayNames('新宿駅西口', makeBusRoute(), level).name).toBe('新宿駅西口');
      expect(getHeadsignDisplayNames('', makeBusRoute(), level).name).toBe('');
      expect(getHeadsignDisplayNames('', makeTrainRoute(), level).name).toBe('');
    },
  );

  // --- Edge cases ---

  it('does not treat whitespace-only headsign as empty', () => {
    const result = getHeadsignDisplayNames(' ', makeBusRoute(), 'normal');
    expect(result.name).toBe(' ');
  });
});
