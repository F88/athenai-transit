import { describe, expect, it } from 'vitest';
import { excludeStopsByIds, filterStopsByType } from '../stop-filter';
import { makeStopMeta } from '../../../__tests__/helpers';
import type { RouteType } from '../../../types/app/transit';

describe('filterStopsByType', () => {
  const stops = [makeStopMeta('a'), makeStopMeta('b'), makeStopMeta('c')];
  const routeTypeMap = new Map<string, RouteType[]>([
    ['a', [3]],
    ['b', [1]],
    ['c', [0]],
  ]);

  it('returns only stops whose route type is visible', () => {
    const result = filterStopsByType(stops, routeTypeMap, new Set([1]));
    expect(result.map((s) => s.stop.stop_id)).toEqual(['b']);
  });

  it('returns multiple matching stops', () => {
    const result = filterStopsByType(stops, routeTypeMap, new Set([0, 3]));
    expect(result.map((s) => s.stop.stop_id)).toEqual(['a', 'c']);
  });

  it('returns empty array when no types match', () => {
    const result = filterStopsByType(stops, routeTypeMap, new Set([2]));
    expect(result).toEqual([]);
  });

  it('defaults to route_type [3] for stops not in routeTypeMap', () => {
    const unknownStop = makeStopMeta('unknown');
    const result = filterStopsByType([unknownStop], new Map(), new Set([3]));
    expect(result.map((s) => s.stop.stop_id)).toEqual(['unknown']);
  });

  it('excludes unknown stops when bus type is not visible', () => {
    const unknownStop = makeStopMeta('unknown');
    const result = filterStopsByType([unknownStop], new Map(), new Set([1]));
    expect(result).toEqual([]);
  });

  it('includes stop when at least one route type is visible', () => {
    const multiTypeMap = new Map<string, RouteType[]>([['a', [1, 3]]]);
    const result = filterStopsByType([makeStopMeta('a')], multiTypeMap, new Set([3]));
    expect(result.map((s) => s.stop.stop_id)).toEqual(['a']);
  });
});

describe('excludeStopsByIds', () => {
  const stops = [makeStopMeta('a'), makeStopMeta('b'), makeStopMeta('c')];

  it('excludes stops with matching IDs', () => {
    const result = excludeStopsByIds(stops, new Set(['a', 'c']));
    expect(result.map((s) => s.stop.stop_id)).toEqual(['b']);
  });

  it('returns all stops when no IDs match', () => {
    const result = excludeStopsByIds(stops, new Set(['x']));
    expect(result.map((s) => s.stop.stop_id)).toEqual(['a', 'b', 'c']);
  });

  it('returns empty array when all IDs are excluded', () => {
    const result = excludeStopsByIds(stops, new Set(['a', 'b', 'c']));
    expect(result).toEqual([]);
  });

  it('handles empty input', () => {
    const result = excludeStopsByIds([], new Set(['a']));
    expect(result).toEqual([]);
  });
});
