import { describe, expect, it } from 'vitest';
import { makeStop, makeStopMeta } from '../../../__tests__/helpers';
import { findVisibleStopMetaById } from '../stop-meta-lookup';
import { buildHistoryNavigationPayload } from '../stop-navigation';
import type { StopHistoryEntry } from '../stop-history';

describe('findNavigableStopMeta', () => {
  it('prefers radius stops before in-bound stops', () => {
    const radiusMeta = makeStopMeta('A');
    const inBoundMeta = makeStopMeta('A');

    const result = findVisibleStopMetaById('A', [radiusMeta], [inBoundMeta]);

    expect(result).toBe(radiusMeta);
  });

  it('returns an in-bound stop when radius stops do not contain the id', () => {
    const inBoundMeta = makeStopMeta('B');

    const result = findVisibleStopMetaById('B', [], [inBoundMeta]);

    expect(result).toBe(inBoundMeta);
  });

  it('returns null when the stop is not present', () => {
    expect(findVisibleStopMetaById('missing', [], [])).toBeNull();
  });

  it('returns the first matching radius stop when the same stop id appears multiple times', () => {
    const firstRadiusMeta = makeStopMeta('A');
    const secondRadiusMeta = makeStopMeta('A');

    const result = findVisibleStopMetaById('A', [firstRadiusMeta, secondRadiusMeta], []);

    expect(result).toBe(firstRadiusMeta);
  });

  it('does not mutate the input stop lists', () => {
    const radiusMeta = makeStopMeta('A');
    const inBoundMeta = makeStopMeta('B');
    const radiusStops = [radiusMeta];
    const inBoundStops = [inBoundMeta];

    findVisibleStopMetaById('A', radiusStops, inBoundStops);

    expect(radiusStops).toEqual([radiusMeta]);
    expect(inBoundStops).toEqual([inBoundMeta]);
  });
});

describe('buildHistoryNavigationPayload', () => {
  it('returns stop and snapshot from current stop metadata when available', () => {
    const entry: StopHistoryEntry = {
      snapshot: {
        stopId: 'A',
        name: 'Snapshot A',
        lat: 35,
        lon: 139,
        routeTypes: [3],
        agencyNames: ['Agency A'],
        platformCode: '1',
      },
      selectedAt: 1000,
    };
    const stopMeta = makeStopMeta(makeStop('A', 36, 140));
    stopMeta.routes = [];

    const result = buildHistoryNavigationPayload(entry, new Map(), ['ja'], () => stopMeta);

    expect(result).toEqual({
      stop: stopMeta.stop,
      snapshot: {
        stopId: 'A',
        name: 'Stop A',
        lat: 36,
        lon: 140,
        routeTypes: [-1],
        agencyNames: [],
        platformCode: undefined,
      },
    });
  });

  it('returns stop and snapshot from the stored history entry when current metadata is unavailable', () => {
    const entry: StopHistoryEntry = {
      snapshot: {
        stopId: 'A',
        name: 'Snapshot A',
        lat: 35,
        lon: 139,
        routeTypes: [3],
        agencyNames: ['Agency A'],
        platformCode: '1',
      },
      selectedAt: 1000,
    };

    const result = buildHistoryNavigationPayload(entry, new Map(), ['ja'], () => null);

    expect(result).toEqual({
      stop: {
        stop_id: 'A',
        stop_name: 'Snapshot A',
        stop_names: {},
        stop_lat: 35,
        stop_lon: 139,
        location_type: 0,
        agency_id: '',
        platform_code: '1',
      },
      snapshot: {
        stopId: 'A',
        name: 'Snapshot A',
        lat: 35,
        lon: 139,
        routeTypes: [3],
        agencyNames: ['Agency A'],
        platformCode: '1',
      },
    });
  });

  it('returns null when the stored history entry cannot rebuild a stop', () => {
    const result = buildHistoryNavigationPayload(
      {
        snapshot: {
          stopId: 'A',
          name: 'Snapshot A',
          lat: null,
          lon: null,
          routeTypes: [3],
          agencyNames: [],
        },
        selectedAt: 1000,
      },
      new Map(),
      ['ja'],
      () => null,
    );

    expect(result).toBeNull();
  });
});
