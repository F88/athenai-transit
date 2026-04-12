import { describe, expect, it } from 'vitest';
import { collectPresentRouteTypes } from '../collect-present-route-types';
import { makeStop, makeStopWithContext } from '../../../__tests__/helpers';
import type { AppRouteTypeValue } from '../../../types/app/transit';
import type { StopWithContext } from '../../../types/app/transit-composed';

const ORDER: AppRouteTypeValue[] = [3, 1, 0, 2];

function withRouteTypes(swc: StopWithContext, routeTypes: AppRouteTypeValue[]): StopWithContext {
  return { ...swc, routeTypes };
}

describe('collectPresentRouteTypes', () => {
  it('collects unique route types present across stops', () => {
    const stops: StopWithContext[] = [
      withRouteTypes(makeStopWithContext(makeStop('s1'), ['r1']), [3]),
      withRouteTypes(makeStopWithContext(makeStop('s2'), ['r2']), [1]),
      withRouteTypes(makeStopWithContext(makeStop('s3'), ['r3']), [3]),
    ];
    const result = collectPresentRouteTypes(stops, ORDER);
    expect(result).toEqual([3, 1]);
  });

  it('preserves caller order for known types', () => {
    const stops: StopWithContext[] = [
      withRouteTypes(makeStopWithContext(makeStop('s1'), ['r1']), [2, 0, 3]),
    ];
    const result = collectPresentRouteTypes(stops, ORDER);
    expect(result).toEqual([3, 0, 2]);
  });

  it('uses routeTypeOrder rather than stop encounter order for known types', () => {
    const stops: StopWithContext[] = [
      withRouteTypes(makeStopWithContext(makeStop('s1'), ['r1']), [2]),
      withRouteTypes(makeStopWithContext(makeStop('s2'), ['r2']), [0]),
      withRouteTypes(makeStopWithContext(makeStop('s3'), ['r3']), [3]),
    ];
    const result = collectPresentRouteTypes(stops, ORDER);
    expect(result).toEqual([3, 0, 2]);
  });

  it('ignores duplicate values in routeTypeOrder after the first match', () => {
    const stops: StopWithContext[] = [
      withRouteTypes(makeStopWithContext(makeStop('s1'), ['r1']), [3, 1, 2]),
    ];
    const result = collectPresentRouteTypes(stops, [3, 1, 3, 2, 1]);
    expect(result).toEqual([3, 1, 2]);
  });

  it('appends extras (not in order list) after known types, sorted numerically', () => {
    const stops: StopWithContext[] = [
      withRouteTypes(makeStopWithContext(makeStop('s1'), ['r1']), [3, 11, 4]),
    ];
    const result = collectPresentRouteTypes(stops, ORDER);
    expect(result).toEqual([3, 4, 11]);
  });

  it('treats all present types as extras when routeTypeOrder is empty', () => {
    const stops: StopWithContext[] = [
      withRouteTypes(makeStopWithContext(makeStop('s1'), ['r1']), [11, 3, 4]),
      withRouteTypes(makeStopWithContext(makeStop('s2'), ['r2']), [4, 12]),
    ];
    const result = collectPresentRouteTypes(stops, []);
    expect(result).toEqual([3, 4, 11, 12]);
  });

  it('returns empty array when no stops', () => {
    expect(collectPresentRouteTypes([], ORDER)).toEqual([]);
  });

  it('returns empty array when stops have no route types', () => {
    const stops: StopWithContext[] = [withRouteTypes(makeStopWithContext(makeStop('s1'), []), [])];
    expect(collectPresentRouteTypes(stops, ORDER)).toEqual([]);
  });

  it('deduplicates across stops', () => {
    const stops: StopWithContext[] = [
      withRouteTypes(makeStopWithContext(makeStop('s1'), ['r1']), [3, 1]),
      withRouteTypes(makeStopWithContext(makeStop('s2'), ['r2']), [3, 1]),
    ];
    const result = collectPresentRouteTypes(stops, ORDER);
    expect(result).toEqual([3, 1]);
  });

  it('deduplicates extras across stops before sorting them numerically', () => {
    const stops: StopWithContext[] = [
      withRouteTypes(makeStopWithContext(makeStop('s1'), ['r1']), [11, 4]),
      withRouteTypes(makeStopWithContext(makeStop('s2'), ['r2']), [4, 11, 12]),
    ];
    const result = collectPresentRouteTypes(stops, ORDER);
    expect(result).toEqual([4, 11, 12]);
  });
});
