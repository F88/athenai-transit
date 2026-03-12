import { describe, expect, it } from 'vitest';
import { translateRouteName } from '../translate-route-name';
import type { Route } from '../../../../types/app/transit';

/** Minimal Route fixture for name translation tests. */
function makeRoute(overrides?: Partial<Route>): Route {
  return {
    route_id: 'R001',
    route_short_name: '都01',
    route_long_name: '渋谷駅前-新橋駅前',
    route_type: 3,
    route_color: 'F1B34E',
    route_text_color: 'FFFFFF',
    ...overrides,
  };
}

describe('translateRouteName', () => {
  it('returns both short and long names', () => {
    const result = translateRouteName(makeRoute());
    expect(result.shortName).toBe('都01');
    expect(result.longName).toBe('渋谷駅前-新橋駅前');
  });

  it('returns empty shortName when route has no short name (train)', () => {
    const route = makeRoute({ route_short_name: '', route_long_name: '大江戸線' });
    const result = translateRouteName(route);
    expect(result.shortName).toBe('');
    expect(result.longName).toBe('大江戸線');
  });

  it('returns empty longName when route has no long name (bus)', () => {
    const route = makeRoute({ route_short_name: '都01', route_long_name: '' });
    const result = translateRouteName(route);
    expect(result.shortName).toBe('都01');
    expect(result.longName).toBe('');
  });

  it('returns both empty when route has neither name', () => {
    const route = makeRoute({ route_short_name: '', route_long_name: '' });
    const result = translateRouteName(route);
    expect(result.shortName).toBe('');
    expect(result.longName).toBe('');
  });

  it('ignores lang parameter (no translations yet)', () => {
    const result = translateRouteName(makeRoute(), 'en');
    expect(result.shortName).toBe('都01');
    expect(result.longName).toBe('渋谷駅前-新橋駅前');
  });

  it('ignores undefined lang parameter', () => {
    const result = translateRouteName(makeRoute(), undefined);
    expect(result.shortName).toBe('都01');
    expect(result.longName).toBe('渋谷駅前-新橋駅前');
  });

  it('does not mutate the input route object', () => {
    const route = makeRoute();
    const original = JSON.parse(JSON.stringify(route)) as Route;
    translateRouteName(route, 'en');
    expect(route).toEqual(original);
  });
});
