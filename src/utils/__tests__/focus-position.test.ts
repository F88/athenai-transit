import { describe, expect, it } from 'vitest';
import { resolveFocusPosition } from '../focus-position';
import type { LatLng } from '../../types/app/map';
import { makeStop } from '../../__tests__/helpers';

describe('resolveFocusPosition', () => {
  const radiusStops = [
    { stop: makeStop('n1', 35.68, 139.76), distance: 100, agencies: [], routes: [] },
  ];
  const inBoundStops = [{ stop: makeStop('ib1', 35.69, 139.77), agencies: [], routes: [] }];

  it('returns directFocusPosition when set', () => {
    const search: LatLng = { lat: 35.7, lng: 139.78 };
    expect(resolveFocusPosition(search, 'n1', radiusStops, inBoundStops)).toBe(search);
  });

  it('returns null when no stop is selected and no search focus', () => {
    expect(resolveFocusPosition(null, null, radiusStops, inBoundStops)).toBeNull();
  });

  it('resolves position from radiusStops', () => {
    const result = resolveFocusPosition(null, 'n1', radiusStops, inBoundStops);
    expect(result).toEqual({ lat: 35.68, lng: 139.76 });
  });

  it('falls back to inBoundStops when not found in radiusStops', () => {
    const result = resolveFocusPosition(null, 'ib1', radiusStops, inBoundStops);
    expect(result).toEqual({ lat: 35.69, lng: 139.77 });
  });

  it('returns null when selectedStopId is not found in either list', () => {
    expect(resolveFocusPosition(null, 'unknown', radiusStops, inBoundStops)).toBeNull();
  });

  it('prioritizes directFocusPosition over selectedStopId', () => {
    const search: LatLng = { lat: 0, lng: 0 };
    const result = resolveFocusPosition(search, 'n1', radiusStops, inBoundStops);
    expect(result).toEqual({ lat: 0, lng: 0 });
  });
});
