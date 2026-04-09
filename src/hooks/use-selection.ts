import { useCallback, useMemo, useState } from 'react';
import type { LatLng, RouteShape } from '../types/app/map';
import type { AppRouteTypeValue, Stop } from '../types/app/transit';
import type { StopWithContext, StopWithMeta } from '../types/app/transit-composed';

import { resolveFocusPosition } from '../domain/map/focus-position';
import type { SelectionInfo } from '../domain/map/selection';
import { extractRouteIdsForStop } from '../domain/map/selection';
import { resolveStopRouteTypes } from '../domain/transit/resolve-stop-route-types';
import { useStableLatLng } from './use-stable-lat-lng';
import { createLogger } from '../lib/logger';

const logger = createLogger('Selection');

/**
 * Parameters for the useSelection hook.
 */
export interface UseSelectionParams {
  /** Route type lookup map (stopId -> routeTypes). */
  routeTypeMap: Map<string, AppRouteTypeValue[]>;
  /** Departure contexts for nearby stops. */
  nearbyDepartures: StopWithContext[];
  /** All route shapes for route selection. */
  routeShapes: RouteShape[];
  /** Stops within the nearby radius. */
  radiusStops: StopWithMeta[];
  /** Stops within the current map viewport. */
  inBoundStops: StopWithMeta[];
}

/**
 * Return type for the useSelection hook.
 */
export interface UseSelectionReturn {
  /** ID of the currently selected stop, or null. */
  selectedStopId: string | null;
  /** Enriched selection info for indicator display. */
  selectionInfo: SelectionInfo | null;
  /** Map focus position from search or stop selection. */
  focusPosition: LatLng | null;
  /** Select a stop by its object. */
  selectStop: (stop: Stop) => void;
  /** Select a stop by its ID. */
  selectStopById: (stopId: string) => void;
  /** Clear the current selection. */
  deselectStop: () => void;
  /** Select a route shape by route ID. */
  selectRouteShape: (routeId: string) => void;
  /** Select a stop and pan the map to it (always triggers pan). */
  focusStop: (stop: Stop) => void;
  /** Clear the direct focus position. */
  clearFocus: () => void;
}

/**
 * Manages stop and route selection state.
 *
 * Handles selection from map clicks, bottom sheet taps, route shape clicks,
 * and search results. Enriches selection info with route IDs from departure
 * data, and resolves the map focus position.
 *
 * @param params - Dependencies for selection logic.
 * @returns Selection state and action handlers.
 */
export function useSelection(params: UseSelectionParams): UseSelectionReturn {
  const { routeTypeMap, nearbyDepartures, routeShapes, radiusStops, inBoundStops } = params;

  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const [selectionInfo, setSelectionInfo] = useState<SelectionInfo | null>(null);
  // directFocusPosition is set only by focusStop and takes
  // priority over stop-based focus in resolveFocusPosition. Every other
  // selection action (selectStop, selectStopById, selectRouteShape,
  // deselectStop) clears it so the map pans to the newly selected item
  // instead of staying pinned to a stale focus position.
  const [directFocusPosition, setDirectFocusPosition] = useState<LatLng | null>(null);

  // Backfill routeIds when departure data arrives after stop selection.
  //
  // At selection time, the stop may not yet be in nearbyDepartures (e.g. the
  // stop is outside the nearby radius, or departures haven't loaded yet),
  // leaving routeIds as an empty Set. This synchronous setState-during-render
  // pattern follows React's recommendation for "adjusting state based on
  // props/state from previous renders" without an extra effect pass.
  // See: https://react.dev/reference/react/useState#storing-information-from-previous-renders
  //
  // This is NOT a useMemo (derived value). A useMemo recomputes from
  // nearbyDepartures on every render — if the stop later leaves the nearby
  // radius (e.g. map pan), the derived value reverts to an empty Set and
  // route highlighting is lost. A state update captures the routeIds once
  // and preserves them regardless of subsequent nearbyDepartures changes.
  if (selectionInfo?.type === 'stop' && selectionInfo.routeIds.size === 0) {
    const ids = extractRouteIdsForStop(nearbyDepartures, selectionInfo.stop.stop_id);
    if (ids.size > 0) {
      setSelectionInfo({ ...selectionInfo, routeIds: ids });
    }
  }

  // Resolve focus position for map panning.
  // useStableLatLng stabilizes the object reference: a new object is only
  // returned when coordinates actually change. Without this, every radiusStops
  // or inBoundStops update produces a new LatLng object with identical
  // coordinates, causing PanToFocus to re-trigger and jitter the map.
  const rawFocusPosition = useMemo(
    () => resolveFocusPosition(directFocusPosition, selectedStopId, radiusStops, inBoundStops),
    [directFocusPosition, selectedStopId, radiusStops, inBoundStops],
  );
  const stableFocusPosition = useStableLatLng(rawFocusPosition);
  // When directFocusPosition is active (search/history), use the raw
  // position so that every call to focusStop triggers a pan —
  // even if the coordinates haven't changed. When null (marker click,
  // bottom-sheet tap), use the stabilized reference to prevent map
  // jitter from radiusStops / inBoundStops re-renders.
  const focusPosition = directFocusPosition ? rawFocusPosition : stableFocusPosition;

  const selectStop = useCallback(
    (stop: Stop) => {
      setSelectedStopId(stop.stop_id);
      setSelectionInfo({
        type: 'stop',
        stop,
        routeTypes: resolveStopRouteTypes({
          stopId: stop.stop_id,
          routeTypeMap,
          routes: null,
          unknownPolicy: 'include-unknown',
        }),
        routeIds: extractRouteIdsForStop(nearbyDepartures, stop.stop_id),
      });
      setDirectFocusPosition(null);
    },
    [routeTypeMap, nearbyDepartures],
  );

  const selectStopById = useCallback(
    (stopId: string) => {
      const ctx = nearbyDepartures.find((d) => d.stop.stop_id === stopId);
      if (ctx) {
        setSelectedStopId(stopId);
        setSelectionInfo({
          type: 'stop',
          stop: ctx.stop,
          routeTypes: ctx.routeTypes,
          routeIds: extractRouteIdsForStop(nearbyDepartures, stopId),
        });
      } else {
        setSelectedStopId(null);
        setSelectionInfo(null);
      }
      setDirectFocusPosition(null);
    },
    [nearbyDepartures],
  );

  const deselectStop = useCallback(() => {
    setSelectedStopId(null);
    setSelectionInfo(null);
    setDirectFocusPosition(null);
  }, []);

  const selectRouteShape = useCallback(
    (routeId: string) => {
      setSelectedStopId(null);
      const shape = routeShapes.find((s) => s.routeId === routeId);
      if (shape?.route) {
        setSelectionInfo({
          type: 'route',
          route: shape.route,
          routeType: shape.routeType,
          routeIds: new Set([routeId]),
        });
      } else {
        setSelectionInfo(null);
      }
      setDirectFocusPosition(null);
    },
    [routeShapes],
  );

  const focusStop = useCallback(
    (stop: Stop) => {
      const routeIds = extractRouteIdsForStop(nearbyDepartures, stop.stop_id);
      logger.debug(
        `focusStop: stopId=${stop.stop_id}, name=${stop.stop_name}, routeIds=${routeIds.size}`,
      );
      setDirectFocusPosition({ lat: stop.stop_lat, lng: stop.stop_lon });
      setSelectedStopId(stop.stop_id);
      setSelectionInfo({
        type: 'stop',
        stop,
        routeTypes: resolveStopRouteTypes({
          stopId: stop.stop_id,
          routeTypeMap,
          routes: null,
          unknownPolicy: 'include-unknown',
        }),
        routeIds,
      });
    },
    [routeTypeMap, nearbyDepartures],
  );

  const clearFocus = useCallback(() => {
    setDirectFocusPosition(null);
  }, []);

  return {
    selectedStopId,
    selectionInfo,
    focusPosition,
    selectStop,
    selectStopById,
    deselectStop,
    selectRouteShape,
    focusStop,
    clearFocus,
  };
}
