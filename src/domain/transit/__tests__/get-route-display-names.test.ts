import { describe, expect, it } from 'vitest';
import { getRouteDisplayNames } from '../get-route-display-names';
import type { Route } from '../../../types/app/transit';
import type { InfoLevel } from '../../../types/app/settings';

/** Bus route: short name only. */
function makeBusRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'R_BUS',
    route_short_name: '都01',
    route_long_name: '',
    route_type: 3,
    route_color: 'F1B34E',
    route_text_color: 'FFFFFF',
    ...overrides,
  };
}

/** Train route: long name only. */
function makeTrainRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'R_TRAIN',
    route_short_name: '',
    route_long_name: '大江戸線',
    route_type: 1,
    route_color: 'B6007A',
    route_text_color: 'FFFFFF',
    ...overrides,
  };
}

/** Route with both names. */
function makeBothRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'R_BOTH',
    route_short_name: 'E',
    route_long_name: '大江戸線',
    route_type: 1,
    route_color: 'B6007A',
    route_text_color: 'FFFFFF',
    ...overrides,
  };
}

/** Route with neither name. */
function makeEmptyRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'R_EMPTY',
    route_short_name: '',
    route_long_name: '',
    route_type: 3,
    route_color: '',
    route_text_color: '',
    ...overrides,
  };
}

describe('getRouteDisplayNames', () => {
  // --- Bus: short name only ---

  it('uses shortName as name for bus route (prefer short)', () => {
    const result = getRouteDisplayNames(makeBusRoute(), 'normal');
    expect(result.name).toBe('都01');
    expect(result.shortName).toBe('都01');
    expect(result.longName).toBe('');
  });

  it('falls back to shortName for bus route even with prefer long', () => {
    const result = getRouteDisplayNames(makeBusRoute(), 'normal', 'long');
    expect(result.name).toBe('都01');
  });

  // --- Train: long name only ---

  it('uses longName as name for train route (prefer short, fallback)', () => {
    const result = getRouteDisplayNames(makeTrainRoute(), 'normal');
    expect(result.name).toBe('大江戸線');
    expect(result.shortName).toBe('');
    expect(result.longName).toBe('大江戸線');
  });

  it('uses longName as name for train route (prefer long)', () => {
    const result = getRouteDisplayNames(makeTrainRoute(), 'normal', 'long');
    expect(result.name).toBe('大江戸線');
  });

  // --- Both names ---

  it('prefers shortName when both exist (default prefer)', () => {
    const result = getRouteDisplayNames(makeBothRoute(), 'normal');
    expect(result.name).toBe('E');
    expect(result.shortName).toBe('E');
    expect(result.longName).toBe('大江戸線');
  });

  it('prefers longName when both exist (prefer long)', () => {
    const result = getRouteDisplayNames(makeBothRoute(), 'normal', 'long');
    expect(result.name).toBe('大江戸線');
    expect(result.shortName).toBe('E');
    expect(result.longName).toBe('大江戸線');
  });

  // --- Neither name: route_id fallback ---

  it('falls back to route_id when both names are empty (prefer short)', () => {
    const result = getRouteDisplayNames(makeEmptyRoute(), 'normal');
    expect(result.name).toBe('R_EMPTY');
  });

  it('falls back to route_id when both names are empty (prefer long)', () => {
    const result = getRouteDisplayNames(makeEmptyRoute(), 'normal', 'long');
    expect(result.name).toBe('R_EMPTY');
  });

  // --- subNames (currently always empty) ---

  it('returns empty subNames at all info levels', () => {
    const levels: InfoLevel[] = ['simple', 'normal', 'detailed', 'verbose'];
    for (const level of levels) {
      const result = getRouteDisplayNames(makeBothRoute(), level);
      expect(result.subNames).toEqual([]);
    }
  });

  // --- infoLevel does not affect name resolution ---

  it.each<InfoLevel>(['simple', 'normal', 'detailed', 'verbose'])(
    'resolves the same name at %s level',
    (level) => {
      expect(getRouteDisplayNames(makeBothRoute(), level).name).toBe('E');
      expect(getRouteDisplayNames(makeTrainRoute(), level).name).toBe('大江戸線');
      expect(getRouteDisplayNames(makeBusRoute(), level).name).toBe('都01');
    },
  );

  // --- raw values always returned ---

  it('always returns raw shortName and longName regardless of infoLevel', () => {
    const result = getRouteDisplayNames(makeBothRoute(), 'simple');
    expect(result.shortName).toBe('E');
    expect(result.longName).toBe('大江戸線');
  });

  // --- immutability ---

  it('does not mutate the input route object', () => {
    const route = makeBothRoute();
    const original = JSON.parse(JSON.stringify(route)) as Route;
    getRouteDisplayNames(route, 'normal', 'long', 'en');
    expect(route).toEqual(original);
  });
});
