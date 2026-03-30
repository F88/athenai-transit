import { describe, expect, it } from 'vitest';
import { formatRouteLabel } from '../format-route-label';
import type { RouteDisplayNames } from '../get-route-display-names';
import type { InfoLevel } from '../../../types/app/settings';

/** Bus route: short name only. */
function busNames(overrides?: Partial<RouteDisplayNames>): RouteDisplayNames {
  return { name: '都01', subNames: [], shortName: '都01', longName: '', ...overrides };
}

/** Train route: long name only. */
function trainNames(overrides?: Partial<RouteDisplayNames>): RouteDisplayNames {
  return { name: '大江戸線', subNames: [], shortName: '', longName: '大江戸線', ...overrides };
}

/** Route with both names, prefer short. */
function bothNames(overrides?: Partial<RouteDisplayNames>): RouteDisplayNames {
  return { name: 'E', subNames: [], shortName: 'E', longName: '大江戸線', ...overrides };
}

describe('formatRouteLabel', () => {
  // --- simple level: name only ---

  it('returns name only at simple level (bus)', () => {
    expect(formatRouteLabel(busNames(), 'simple')).toBe('都01');
  });

  it('returns name only at simple level (train)', () => {
    expect(formatRouteLabel(trainNames(), 'simple')).toBe('大江戸線');
  });

  it('returns name only at simple level (both)', () => {
    expect(formatRouteLabel(bothNames(), 'simple')).toBe('E');
  });

  it('ignores subNames at simple level', () => {
    const names = bothNames({ subNames: ['Oedo Line'] });
    expect(formatRouteLabel(names, 'simple')).toBe('E');
  });

  // --- normal level: name + subNames ---

  it('returns name only at normal level when subNames is empty', () => {
    expect(formatRouteLabel(busNames(), 'normal')).toBe('都01');
  });

  it('appends subNames at normal level', () => {
    const names = bothNames({ subNames: ['Oedo Line'] });
    expect(formatRouteLabel(names, 'normal')).toBe('E / Oedo Line');
  });

  it('joins multiple subNames with / at normal level', () => {
    const names = bothNames({ subNames: ['Oedo Line', 'おおえどせん'] });
    expect(formatRouteLabel(names, 'normal')).toBe('E / Oedo Line / おおえどせん');
  });

  it('filters empty strings from subNames', () => {
    const names = bothNames({ subNames: ['', 'Oedo Line', ''] });
    expect(formatRouteLabel(names, 'normal')).toBe('E / Oedo Line');
  });

  // --- detailed level: same as normal ---

  it('behaves like normal at detailed level', () => {
    const names = bothNames({ subNames: ['Oedo Line'] });
    expect(formatRouteLabel(names, 'detailed')).toBe('E / Oedo Line');
  });

  // --- verbose level: same as normal (raw field dump moved to VerboseRoute) ---

  it('behaves like normal at verbose level (bus)', () => {
    expect(formatRouteLabel(busNames(), 'verbose')).toBe('都01');
  });

  it('behaves like normal at verbose level (train)', () => {
    expect(formatRouteLabel(trainNames(), 'verbose')).toBe('大江戸線');
  });

  it('behaves like normal at verbose level (both)', () => {
    expect(formatRouteLabel(bothNames(), 'verbose')).toBe('E');
  });

  it('includes subNames at verbose level', () => {
    const names = bothNames({ subNames: ['Oedo Line'] });
    expect(formatRouteLabel(names, 'verbose')).toBe('E / Oedo Line');
  });

  // --- edge case: empty name ---

  it('returns ? when name is empty', () => {
    const names: RouteDisplayNames = { name: '', subNames: [], shortName: '', longName: '' };
    expect(formatRouteLabel(names, 'simple')).toBe('?');
  });

  // --- all levels return consistent name ---

  it.each<InfoLevel>(['simple', 'normal', 'detailed', 'verbose'])(
    'always starts with name at %s level',
    (level) => {
      expect(formatRouteLabel(bothNames(), level).startsWith('E')).toBe(true);
    },
  );
});
