import { describe, expect, it } from 'vitest';
import { makeRoute, makeStop, makeStopMeta } from '../../../__tests__/helpers';
import type { AppRouteTypeValue } from '../../../types/app/transit';
import { findVisibleStopMetaById, lookupStopMetaFromMap } from '../stop-meta-lookup';
import {
  buildHistoryNavigationPayload,
  buildSelectionSnapshotFromMeta,
  buildSelectionSnapshotFromStop,
} from '../stop-navigation';
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

describe('lookupStopMetaFromMap', () => {
  it('returns the matching StopWithMeta when the id is present', () => {
    const meta = makeStopMeta('A');
    const map = new Map([['A', meta]]);

    expect(lookupStopMetaFromMap('A', map)).toBe(meta);
  });

  it('returns null when the id is absent', () => {
    const map = new Map([['A', makeStopMeta('A')]]);

    expect(lookupStopMetaFromMap('missing', map)).toBeNull();
  });

  it('returns null for an empty map', () => {
    expect(lookupStopMetaFromMap('A', new Map())).toBeNull();
  });

  it('does not mutate the input map', () => {
    const meta = makeStopMeta('A');
    const map = new Map([['A', meta]]);

    lookupStopMetaFromMap('A', map);

    expect(map.size).toBe(1);
    expect(map.get('A')).toBe(meta);
  });
});

describe('buildSelectionSnapshotFromMeta', () => {
  it('falls back to the unknown sentinel when routeTypeMap has no entry and meta.routes is empty', () => {
    const stopMeta = makeStopMeta(makeStop('A', 35, 139));
    stopMeta.routes = [];

    const snapshot = buildSelectionSnapshotFromMeta(stopMeta, new Map(), ['ja']);

    expect(snapshot).toEqual({
      stopId: 'A',
      name: 'Stop A',
      lat: 35,
      lon: 139,
      // Empty routes + no map entry collapses to the unknown sentinel
      // because the policy is 'include-unknown'.
      routeTypes: [-1],
      agencyNames: [],
      platformCode: undefined,
    });
  });

  it('uses routeTypes from the routeTypeMap when present', () => {
    const stopMeta = makeStopMeta(makeStop('A', 35, 139));
    stopMeta.routes = [];
    const routeTypeMap = new Map<string, AppRouteTypeValue[]>([['A', [3, 1]]]);

    const snapshot = buildSelectionSnapshotFromMeta(stopMeta, routeTypeMap, ['ja']);

    expect(snapshot.routeTypes).toEqual([3, 1]);
    expect(snapshot.stopId).toBe('A');
  });

  it('derives routeTypes from meta.routes (deduped and ascending) when routeTypeMap has no entry', () => {
    const stopMeta = makeStopMeta(makeStop('A', 35, 139));
    stopMeta.routes = [makeRoute('r1', 3), makeRoute('r2', 1), makeRoute('r3', 3)];

    const snapshot = buildSelectionSnapshotFromMeta(stopMeta, new Map(), ['ja']);

    expect(snapshot.routeTypes).toEqual([1, 3]);
    expect(snapshot.stopId).toBe('A');
  });
});

describe('buildSelectionSnapshotFromStop', () => {
  it('builds a snapshot with empty agencyNames when no live meta is available', () => {
    const stop = makeStop('B', 36, 140);
    const routeTypeMap = new Map<string, AppRouteTypeValue[]>([['B', [2]]]);

    const snapshot = buildSelectionSnapshotFromStop(stop, routeTypeMap, ['ja']);

    expect(snapshot).toEqual({
      stopId: 'B',
      name: 'Stop B',
      lat: 36,
      lon: 140,
      routeTypes: [2],
      agencyNames: [],
      platformCode: undefined,
    });
  });

  it('collapses to unknown sentinel when the routeTypeMap has no entry', () => {
    const stop = makeStop('C', 0, 0);

    const snapshot = buildSelectionSnapshotFromStop(stop, new Map(), ['ja']);

    expect(snapshot.routeTypes).toEqual([-1]);
    expect(snapshot.agencyNames).toEqual([]);
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
