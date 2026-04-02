import { describe, expect, it } from 'vitest';
import { makeRoute, makeStop, makeStopMeta } from '../../../__tests__/helpers';
import { buildMapSelectionLayers } from '../map-selection-layers';
import type { RouteShape } from '../../../types/app/map';
import type { RouteType } from '../../../types/app/transit';
import type { SelectionInfo } from '../selection';

function makeShape(routeId: string, routeType: RouteType): RouteShape {
  return {
    routeId,
    routeType,
    color: '#000000',
    route: null,
    points: [[35.68, 139.76]],
  };
}

describe('buildMapSelectionLayers', () => {
  it('hides unselected route shapes for stop selection', () => {
    const selectionInfo: SelectionInfo = {
      type: 'stop',
      stop: makeStop('s1'),
      routeTypes: [3],
      routeIds: new Set(['bus-1']),
    };

    const result = buildMapSelectionLayers({
      inBoundStops: [],
      radiusStops: [],
      routeStops: [],
      routeShapes: [makeShape('bus-1', 3), makeShape('bus-2', 3), makeShape('subway-1', 1)],
      routeTypeMap: new Map(),
      visibleStopTypes: new Set([3]),
      visibleRouteShapes: new Set([1, 3]),
      selectionInfo,
    });

    expect(result.selectedRouteIds).toEqual(new Set(['bus-1']));
    expect(result.visibleShapes.map((shape) => shape.routeId)).toEqual(['bus-1']);
  });

  it('excludes route stops from nearby and far stop layers', () => {
    const nearA = makeStopMeta(makeStop('near-a'), 100);
    const nearB = makeStopMeta(makeStop('near-b'), 200);
    const farC = makeStopMeta(makeStop('far-c'), 300);
    const routeStop = makeStopMeta(makeStop('near-b'), 50);
    routeStop.routes = [makeRoute('r1', 3)];

    const result = buildMapSelectionLayers({
      inBoundStops: [nearA, nearB, farC],
      radiusStops: [nearA, nearB],
      routeStops: [routeStop],
      routeShapes: [],
      routeTypeMap: new Map([
        ['near-a', [3]],
        ['near-b', [3]],
        ['far-c', [3]],
      ]),
      visibleStopTypes: new Set([3]),
      visibleRouteShapes: new Set(),
      selectionInfo: null,
    });

    expect(result.filteredNearbyStops.map((stop) => stop.stop_id)).toEqual(['near-a']);
    expect(result.filteredFarStops.map((stop) => stop.stop_id)).toEqual(['far-c']);
    expect(result.routeStopMarkers.map((stop) => stop.stop_id)).toEqual(['near-b']);
  });

  it('deduplicates and sorts route types for route stop markers', () => {
    const routeStop = makeStopMeta(makeStop('route-stop'));
    routeStop.routes = [makeRoute('r1', 3), makeRoute('r2', 1), makeRoute('r3', 3), makeRoute('r4', 0)];

    const result = buildMapSelectionLayers({
      inBoundStops: [],
      radiusStops: [],
      routeStops: [routeStop],
      routeShapes: [],
      routeTypeMap: new Map(),
      visibleStopTypes: new Set([0, 1, 3]),
      visibleRouteShapes: new Set(),
      selectionInfo: null,
    });

    expect(result.routeStopsRouteTypeMap.get('route-stop')).toEqual([0, 1, 3]);
  });
});
