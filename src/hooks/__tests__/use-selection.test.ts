import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useSelection, type UseSelectionParams } from '../use-selection';
import type { RouteShape } from '../../types/app/map';
import type { AppRouteTypeValue } from '../../types/app/transit';
import { makeStop, makeStopMeta, makeRoute, makeStopWithContext } from '../../__tests__/helpers';

function makeParams(overrides: Partial<UseSelectionParams> = {}): UseSelectionParams {
  return {
    routeTypeMap: new Map(),
    nearbyDepartures: [],
    routeShapes: [],
    radiusStops: [],
    inBoundStops: [],
    ...overrides,
  };
}

describe('useSelection', () => {
  describe('initial state', () => {
    it('has no selection by default', () => {
      const { result } = renderHook(() => useSelection(makeParams()));

      expect(result.current.selectedStopId).toBeNull();
      expect(result.current.selectionInfo).toBeNull();
      expect(result.current.focusPosition).toBeNull();
    });
  });

  describe('selectStop', () => {
    it('sets selectedStopId and selectionInfo', () => {
      const stop = makeStop('A');
      const routeTypeMap = new Map<string, AppRouteTypeValue[]>([['A', [1]]]);
      const { result } = renderHook(() => useSelection(makeParams({ routeTypeMap })));

      act(() => {
        result.current.selectStop(stop);
      });

      expect(result.current.selectedStopId).toBe('A');
      expect(result.current.selectionInfo?.type).toBe('stop');
      if (result.current.selectionInfo?.type === 'stop') {
        expect(result.current.selectionInfo.routeTypes).toEqual([1]);
      }
    });

    it('extracts routeIds from departure data', () => {
      const stop = makeStop('A');
      const departures = [makeStopWithContext(stop, ['R1', 'R2'])];
      const { result } = renderHook(() =>
        useSelection(makeParams({ nearbyDepartures: departures })),
      );

      act(() => {
        result.current.selectStop(stop);
      });

      if (result.current.selectionInfo?.type === 'stop') {
        expect(result.current.selectionInfo.routeIds).toEqual(new Set(['R1', 'R2']));
      }
    });
  });

  describe('selectStopById', () => {
    it('looks up stop from departure context', () => {
      const stop = makeStop('B');
      const departures = [makeStopWithContext(stop, ['R3'])];
      const { result } = renderHook(() =>
        useSelection(makeParams({ nearbyDepartures: departures })),
      );

      act(() => {
        result.current.selectStopById('B');
      });

      expect(result.current.selectedStopId).toBe('B');
      expect(result.current.selectionInfo?.type).toBe('stop');
    });
  });

  describe('deselectStop', () => {
    it('clears selection', () => {
      const stop = makeStop('A');
      const { result } = renderHook(() => useSelection(makeParams()));

      act(() => {
        result.current.selectStop(stop);
      });
      expect(result.current.selectedStopId).toBe('A');

      act(() => {
        result.current.deselectStop();
      });

      expect(result.current.selectedStopId).toBeNull();
      expect(result.current.selectionInfo).toBeNull();
    });
  });

  describe('selectRouteShape', () => {
    it('selects a route shape and clears stop selection', () => {
      const route = makeRoute('R1');
      const shape: RouteShape = {
        routeId: 'R1',
        routeType: 3,
        color: '#000000',
        route,
        points: [[35, 139]],
      };
      const { result } = renderHook(() => useSelection(makeParams({ routeShapes: [shape] })));

      act(() => {
        result.current.selectStop(makeStop('A'));
      });

      act(() => {
        result.current.selectRouteShape('R1');
      });

      expect(result.current.selectedStopId).toBeNull();
      expect(result.current.selectionInfo?.type).toBe('route');
      if (result.current.selectionInfo?.type === 'route') {
        expect(result.current.selectionInfo.route.route_id).toBe('R1');
        expect(result.current.selectionInfo.routeIds).toEqual(new Set(['R1']));
      }
    });

    it('clears selectionInfo when shape has no route', () => {
      const shape: RouteShape = {
        routeId: 'R1',
        routeType: 3,
        color: '#000000',
        route: null,
        points: [[35, 139]],
      };
      const { result } = renderHook(() => useSelection(makeParams({ routeShapes: [shape] })));

      act(() => {
        result.current.selectRouteShape('R1');
      });

      expect(result.current.selectionInfo).toBeNull();
    });
  });

  describe('focusStop', () => {
    it('sets focus position and selects the stop', () => {
      const stop = makeStop('S1', 35.5, 139.5);
      const { result } = renderHook(() => useSelection(makeParams()));

      act(() => {
        result.current.focusStop(stop);
      });

      expect(result.current.selectedStopId).toBe('S1');
      expect(result.current.focusPosition).toEqual({
        lat: 35.5,
        lng: 139.5,
      });
    });
  });

  describe('clearFocus', () => {
    it('clears search focus position', () => {
      const stop = makeStop('S1', 35.5, 139.5);
      const { result } = renderHook(() => useSelection(makeParams()));

      act(() => {
        result.current.focusStop(stop);
      });
      expect(result.current.focusPosition).not.toBeNull();

      act(() => {
        result.current.clearFocus();
      });

      // Focus falls back to stop position if stop is in radiusStops/inBoundStops
      // Since neither list contains the stop, focusPosition is null
      expect(result.current.focusPosition).toBeNull();
    });
  });

  describe('enrichment', () => {
    it('enriches selectionInfo with routeIds when they arrive later', () => {
      const stop = makeStop('A');
      const { result, rerender } = renderHook(({ params }) => useSelection(params), {
        initialProps: { params: makeParams() },
      });

      // Select stop with no departures yet
      act(() => {
        result.current.selectStop(stop);
      });
      expect(result.current.selectionInfo?.routeIds.size).toBe(0);

      // Departures arrive
      const departures = [makeStopWithContext(stop, ['R1', 'R2'])];
      rerender({
        params: makeParams({ nearbyDepartures: departures }),
      });

      expect(result.current.selectionInfo?.routeIds).toEqual(new Set(['R1', 'R2']));
    });
  });

  describe('focusPosition', () => {
    it('resolves from radiusStops when stop is selected', () => {
      const stop = makeStop('A', 35.1, 139.1);
      const { result } = renderHook(() =>
        useSelection(makeParams({ radiusStops: [makeStopMeta(stop)] })),
      );

      act(() => {
        result.current.selectStop(stop);
      });

      expect(result.current.focusPosition).toEqual({
        lat: 35.1,
        lng: 139.1,
      });
    });

    it('resolves from inBoundStops when not in radiusStops', () => {
      const stop = makeStop('A', 35.2, 139.2);
      const { result } = renderHook(() =>
        useSelection(makeParams({ inBoundStops: [{ stop, agencies: [], routes: [] }] })),
      );

      act(() => {
        result.current.selectStop(stop);
      });

      expect(result.current.focusPosition).toEqual({
        lat: 35.2,
        lng: 139.2,
      });
    });

    it('directFocusPosition takes priority over stop position', () => {
      const stop = makeStop('A', 35.0, 139.0);
      const { result } = renderHook(() =>
        useSelection(makeParams({ radiusStops: [makeStopMeta(stop)] })),
      );

      act(() => {
        result.current.focusStop(stop);
      });

      // directFocusPosition is derived from the stop's lat/lon
      expect(result.current.focusPosition).toEqual({
        lat: 35.0,
        lng: 139.0,
      });
    });

    it('returns null when selected stop is not in any stop list', () => {
      const stop = makeStop('Z', 35.0, 139.0);
      const { result } = renderHook(
        () => useSelection(makeParams()), // no radiusStops or inBoundStops
      );

      act(() => {
        result.current.selectStop(stop);
      });

      expect(result.current.selectedStopId).toBe('Z');
      expect(result.current.focusPosition).toBeNull();
    });
  });

  describe('selectStop edge cases', () => {
    it('defaults routeTypes to [-1] when stop is not in routeTypeMap', () => {
      const stop = makeStop('UNKNOWN');
      const { result } = renderHook(() => useSelection(makeParams({ routeTypeMap: new Map() })));

      act(() => {
        result.current.selectStop(stop);
      });

      if (result.current.selectionInfo?.type === 'stop') {
        expect(result.current.selectionInfo.routeTypes).toEqual([-1]);
      }
    });

    it('replaces route selection with stop selection', () => {
      const route = makeRoute('R1');
      const shape: RouteShape = {
        routeId: 'R1',
        routeType: 3,
        color: '#000000',
        route,
        points: [[35, 139]],
      };
      const stop = makeStop('A');
      const { result } = renderHook(() => useSelection(makeParams({ routeShapes: [shape] })));

      act(() => {
        result.current.selectRouteShape('R1');
      });
      expect(result.current.selectionInfo?.type).toBe('route');

      act(() => {
        result.current.selectStop(stop);
      });
      expect(result.current.selectionInfo?.type).toBe('stop');
      expect(result.current.selectedStopId).toBe('A');
    });
  });

  describe('selectStopById edge cases', () => {
    it('clears selection when stop is not in departures', () => {
      const stop = makeStop('A');
      const departures = [makeStopWithContext(stop, ['R1'])];
      const { result } = renderHook(() =>
        useSelection(makeParams({ nearbyDepartures: departures })),
      );

      // First select a valid stop
      act(() => {
        result.current.selectStopById('A');
      });
      expect(result.current.selectedStopId).toBe('A');

      // Select a missing stop — should clear everything
      act(() => {
        result.current.selectStopById('MISSING');
      });

      expect(result.current.selectedStopId).toBeNull();
      expect(result.current.selectionInfo).toBeNull();
    });

    it('uses routeTypes from departure context', () => {
      const stop = makeStop('A');
      const ctx = makeStopWithContext(stop, ['R1'], [1]);
      const { result } = renderHook(() => useSelection(makeParams({ nearbyDepartures: [ctx] })));

      act(() => {
        result.current.selectStopById('A');
      });

      if (result.current.selectionInfo?.type === 'stop') {
        expect(result.current.selectionInfo.routeTypes).toEqual([1]);
      }
    });
  });

  describe('selectRouteShape edge cases', () => {
    it('clears selectionInfo for unknown routeId', () => {
      const { result } = renderHook(() => useSelection(makeParams({ routeShapes: [] })));

      act(() => {
        result.current.selectRouteShape('NONEXISTENT');
      });

      expect(result.current.selectedStopId).toBeNull();
      expect(result.current.selectionInfo).toBeNull();
    });
  });

  describe('clearFocus edge cases', () => {
    it('falls back to stop position when stop is in radiusStops', () => {
      const stop = makeStop('A', 35.5, 139.5);
      const { result } = renderHook(() =>
        useSelection(makeParams({ radiusStops: [makeStopMeta(stop)] })),
      );

      act(() => {
        result.current.focusStop(stop);
      });
      // directFocusPosition is set
      expect(result.current.focusPosition).toEqual({
        lat: 35.5,
        lng: 139.5,
      });

      act(() => {
        result.current.clearFocus();
      });

      // Falls back to stop position from radiusStops
      expect(result.current.focusPosition).toEqual({
        lat: 35.5,
        lng: 139.5,
      });
    });
  });

  describe('enrichment edge cases', () => {
    it('skips enrichment for route selection type', () => {
      const route = makeRoute('R1');
      const shape: RouteShape = {
        routeId: 'R1',
        routeType: 3,
        color: '#000000',
        route,
        points: [[35, 139]],
      };
      const { result } = renderHook(() => useSelection(makeParams({ routeShapes: [shape] })));

      act(() => {
        result.current.selectRouteShape('R1');
      });

      // Route selection should not be enriched
      expect(result.current.selectionInfo?.type).toBe('route');
      expect(result.current.selectionInfo?.routeIds).toEqual(new Set(['R1']));
    });

    it('skips enrichment when routeIds are already populated', () => {
      const stop = makeStop('A');
      const departures = [makeStopWithContext(stop, ['R1'])];
      const { result, rerender } = renderHook(({ params }) => useSelection(params), {
        initialProps: {
          params: makeParams({ nearbyDepartures: departures }),
        },
      });

      // Select stop — routeIds are already populated from departures
      act(() => {
        result.current.selectStop(stop);
      });
      expect(result.current.selectionInfo?.routeIds).toEqual(new Set(['R1']));

      // Rerender with additional departures — existing routeIds should remain
      const moreDepartures = [makeStopWithContext(stop, ['R1', 'R2'])];
      rerender({
        params: makeParams({ nearbyDepartures: moreDepartures }),
      });

      // Should NOT be enriched because routeIds.size > 0
      expect(result.current.selectionInfo?.routeIds).toEqual(new Set(['R1']));
    });
  });

  describe('directFocusPosition clearing', () => {
    it('selectStop clears directFocusPosition', () => {
      const searchStop = makeStop('S1', 35.5, 139.5);
      const mapStop = makeStop('M1', 35.1, 139.1);
      const { result } = renderHook(() =>
        useSelection(makeParams({ radiusStops: [makeStopMeta(mapStop)] })),
      );

      act(() => {
        result.current.focusStop(searchStop);
      });
      expect(result.current.focusPosition).toEqual({ lat: 35.5, lng: 139.5 });

      act(() => {
        result.current.selectStop(mapStop);
      });
      // Should use map stop position, not search position
      expect(result.current.focusPosition).toEqual({ lat: 35.1, lng: 139.1 });
    });

    it('deselectStop clears directFocusPosition', () => {
      const stop = makeStop('S1', 35.5, 139.5);
      const { result } = renderHook(() => useSelection(makeParams()));

      act(() => {
        result.current.focusStop(stop);
      });
      expect(result.current.focusPosition).not.toBeNull();

      act(() => {
        result.current.deselectStop();
      });
      expect(result.current.focusPosition).toBeNull();
    });
  });

  describe('deselectStop edge cases', () => {
    it('clears focusPosition when deselecting', () => {
      const stop = makeStop('A', 35.0, 139.0);
      const { result } = renderHook(() =>
        useSelection(makeParams({ radiusStops: [makeStopMeta(stop)] })),
      );

      act(() => {
        result.current.selectStop(stop);
      });
      expect(result.current.focusPosition).not.toBeNull();

      act(() => {
        result.current.deselectStop();
      });

      expect(result.current.focusPosition).toBeNull();
    });

    it('is idempotent when nothing is selected', () => {
      const { result } = renderHook(() => useSelection(makeParams()));

      act(() => {
        result.current.deselectStop();
      });

      expect(result.current.selectedStopId).toBeNull();
      expect(result.current.selectionInfo).toBeNull();
      expect(result.current.focusPosition).toBeNull();
    });
  });
});
