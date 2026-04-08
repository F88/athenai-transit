import { describe, expect, it } from 'vitest';
import { DEFAULT_AGENCY_LANG } from '../../../config/transit-defaults';
import { getRouteDisplayNames } from '../get-route-display-names';
import type { Route } from '../../../types/app/transit';

const DEFAULT_DISPLAY_LANGS: readonly string[] = ['ja'];

/** Bus route: short name only. */
function makeBusRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'R_BUS',
    route_short_name: '都01',
    route_short_names: {},
    route_long_name: '',
    route_long_names: {},
    route_type: 3,
    route_color: 'F1B34E',
    route_text_color: 'FFFFFF',
    agency_id: '',
    ...overrides,
  };
}

/** Train route: long name only. */
function makeTrainRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'R_TRAIN',
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

/** Route with both names. */
function makeBothRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'R_BOTH',
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

/** Route with neither name. */
function makeEmptyRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'R_EMPTY',
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

describe('getRouteDisplayNames', () => {
  // --- Bus: short name only ---

  it('uses shortName as name for bus route (prefer short)', () => {
    const result = getRouteDisplayNames(makeBusRoute(), DEFAULT_DISPLAY_LANGS, DEFAULT_AGENCY_LANG);
    expect(result.resolved.name).toBe('都01');
    expect(result.resolvedSource).toBe('short');
    expect(result.shortName).toEqual({ name: '都01', subNames: [] });
    expect(result.longName).toEqual({ name: '', subNames: [] });
  });

  it('falls back to shortName for bus route even with prefer long', () => {
    const result = getRouteDisplayNames(
      makeBusRoute(),
      DEFAULT_DISPLAY_LANGS,
      DEFAULT_AGENCY_LANG,
      'long',
    );
    expect(result.resolved.name).toBe('都01');
    expect(result.resolvedSource).toBe('short');
  });

  // --- Train: long name only ---

  it('uses longName as name for train route (prefer short, fallback)', () => {
    const result = getRouteDisplayNames(
      makeTrainRoute(),
      DEFAULT_DISPLAY_LANGS,
      DEFAULT_AGENCY_LANG,
    );
    expect(result.resolved.name).toBe('大江戸線');
    expect(result.resolvedSource).toBe('long');
    expect(result.shortName).toEqual({ name: '', subNames: [] });
    expect(result.longName).toEqual({ name: '大江戸線', subNames: [] });
  });

  it('uses longName as name for train route (prefer long)', () => {
    const result = getRouteDisplayNames(
      makeTrainRoute(),
      DEFAULT_DISPLAY_LANGS,
      DEFAULT_AGENCY_LANG,
      'long',
    );
    expect(result.resolved.name).toBe('大江戸線');
    expect(result.resolvedSource).toBe('long');
  });

  // --- Both names ---

  it('prefers shortName when both exist (default prefer)', () => {
    const result = getRouteDisplayNames(
      makeBothRoute(),
      DEFAULT_DISPLAY_LANGS,
      DEFAULT_AGENCY_LANG,
    );
    expect(result.resolved.name).toBe('E');
    expect(result.resolvedSource).toBe('short');
    expect(result.shortName).toEqual({ name: 'E', subNames: [] });
    expect(result.longName).toEqual({ name: '大江戸線', subNames: [] });
    expect(result.resolved.subNames).toEqual([]);
  });

  it('prefers longName when both exist (prefer long)', () => {
    const result = getRouteDisplayNames(
      makeBothRoute(),
      DEFAULT_DISPLAY_LANGS,
      DEFAULT_AGENCY_LANG,
      'long',
    );
    expect(result.resolved.name).toBe('大江戸線');
    expect(result.resolvedSource).toBe('long');
    expect(result.shortName).toEqual({ name: 'E', subNames: [] });
    expect(result.longName).toEqual({ name: '大江戸線', subNames: [] });
    expect(result.resolved.subNames).toEqual([]);
  });

  // --- Neither name: route_id fallback ---

  it('falls back to route_id when both names are empty (prefer short)', () => {
    const result = getRouteDisplayNames(
      makeEmptyRoute(),
      DEFAULT_DISPLAY_LANGS,
      DEFAULT_AGENCY_LANG,
    );
    expect(result.resolved.name).toBe('R_EMPTY');
    expect(result.resolvedSource).toBe('short');
  });

  it('falls back to route_id when both names are empty (prefer long)', () => {
    const result = getRouteDisplayNames(
      makeEmptyRoute(),
      DEFAULT_DISPLAY_LANGS,
      DEFAULT_AGENCY_LANG,
      'long',
    );
    expect(result.resolved.name).toBe('R_EMPTY');
    expect(result.resolvedSource).toBe('long');
  });

  // --- i18n per source ---

  it('resolves longName translations with source-local subNames', () => {
    const result = getRouteDisplayNames(
      makeBothRoute({ route_long_names: { en: 'Oedo Line', 'ja-Hrkt': 'おおえどせん' } }),
      ['en'],
      DEFAULT_AGENCY_LANG,
    );
    expect(result.resolved.name).toBe('E');
    expect(result.resolvedSource).toBe('short');
    expect(result.longName).toEqual({ name: 'Oedo Line', subNames: ['おおえどせん', '大江戸線'] });
    expect(result.resolved.subNames).toEqual([]);
  });

  it('resolves shortName translations with source-local subNames', () => {
    const result = getRouteDisplayNames(
      makeBothRoute({ route_short_names: { en: 'Express E', ko: '급행 E' } }),
      ['en'],
      DEFAULT_AGENCY_LANG,
      'long',
    );
    expect(result.resolved.name).toBe('大江戸線');
    expect(result.resolvedSource).toBe('long');
    expect(result.shortName).toEqual({ name: 'Express E', subNames: ['급행 E', 'E'] });
    expect(result.resolved.subNames).toEqual([]);
  });

  it('keeps short and long subNames separate', () => {
    const result = getRouteDisplayNames(
      makeBothRoute({
        route_short_names: { en: 'Shared' },
        route_long_names: { en: 'Shared', ko: '별도 긴 이름' },
      }),
      ['en'],
      DEFAULT_AGENCY_LANG,
      'long',
    );
    expect(result.resolved.name).toBe('Shared');
    expect(result.resolvedSource).toBe('long');
    expect(result.shortName).toEqual({ name: 'Shared', subNames: ['E'] });
    expect(result.longName).toEqual({ name: 'Shared', subNames: ['별도 긴 이름', '大江戸線'] });
  });

  // --- resolved values always returned ---

  it('always returns resolved shortName and longName', () => {
    const result = getRouteDisplayNames(
      makeBothRoute({ route_long_names: { en: 'Oedo Line' } }),
      ['en'],
      DEFAULT_AGENCY_LANG,
    );
    expect(result.shortName.name).toBe('E');
    expect(result.longName.name).toBe('Oedo Line');
  });

  // --- immutability ---

  it('does not mutate the input route object', () => {
    const route = makeBothRoute();
    const original = JSON.parse(JSON.stringify(route)) as Route;
    getRouteDisplayNames(route, ['en'], DEFAULT_AGENCY_LANG, 'long');
    expect(route).toEqual(original);
  });
});
