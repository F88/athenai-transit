import { useCallback } from 'react';
import { resolveStopRouteTypes } from '../domain/transit/resolve-stop-route-types';
import { resolveNavigableStopMeta } from '../domain/transit/stop-navigation';
import { createStopReferenceSnapshot } from '../domain/transit/stop-reference-snapshot';
import { createLogger } from '../lib/logger';
import type { AutoLocateOffReason } from '../types/app/auto-locate';
import type { StopReferenceSnapshot } from '../types/app/stop-reference-snapshot';
import type { AppRouteTypeValue, Stop } from '../types/app/transit';
import type { StopWithMeta } from '../types/app/transit-composed';

const logger = createLogger('StopNavigation');

export interface UseStopNavigationParams {
  dataLang: readonly string[];
  routeTypeMap: ReadonlyMap<string, AppRouteTypeValue[]>;
  radiusStops: readonly StopWithMeta[];
  inBoundStops: readonly StopWithMeta[];
  disableAutoLocate: (reason: AutoLocateOffReason) => void;
  selectStopById: (stopId: string, fallbackStop?: Stop) => void;
  focusStop: (stop: Stop) => void;
  recordStopSelection: (selection: StopReferenceSnapshot) => void;
}

export interface UseStopNavigationReturn {
  selectStopWithFallback: (
    stopId: string,
    reason: AutoLocateOffReason,
    fallbackStop?: Stop,
  ) => void;
  navigateAndFocusStop: (reason: AutoLocateOffReason, stop: Stop) => void;
}

export function useStopNavigation(params: UseStopNavigationParams): UseStopNavigationReturn {
  const {
    dataLang,
    routeTypeMap,
    radiusStops,
    inBoundStops,
    disableAutoLocate,
    selectStopById,
    focusStop,
    recordStopSelection,
  } = params;

  const recordStopHistorySelection = useCallback(
    (meta: StopWithMeta, routeTypes?: readonly AppRouteTypeValue[]) => {
      const snapshot = createStopReferenceSnapshot(
        meta,
        routeTypes ??
          resolveStopRouteTypes({
            stopId: meta.stop.stop_id,
            routeTypeMap,
            routes: meta.routes,
            unknownPolicy: 'include-unknown',
          }),
        dataLang,
      );
      recordStopSelection(snapshot);
    },
    [dataLang, recordStopSelection, routeTypeMap],
  );

  // Viewport-limited lookup: this only searches `radiusStops` and `inBoundStops`.
  // Use it for already-visible / user-picked stops (marker, bottom sheet, search,
  // history, portal fallback) where a stale-free fallback Stop is available.
  // Do not use it for arbitrary persistent stop IDs such as URL params or other
  // long-lived references; those must go through `repo.getStopMetaById`.
  const selectStopWithFallback = useCallback(
    (stopId: string, reason: AutoLocateOffReason, fallbackStop?: Stop) => {
      if (logger.isEnabled('debug')) {
        logger.debug(
          `selectStopWithFallback: reason=${reason}, stopId=${stopId}, name=${fallbackStop?.stop_name ?? 'unknown'}`,
        );
      }
      disableAutoLocate(reason);
      selectStopById(stopId, fallbackStop);
      const meta = resolveNavigableStopMeta(stopId, radiusStops, inBoundStops, fallbackStop);
      if (meta) {
        recordStopHistorySelection(meta);
      }
    },
    [disableAutoLocate, selectStopById, radiusStops, inBoundStops, recordStopHistorySelection],
  );

  const navigateAndFocusStop = useCallback(
    (reason: AutoLocateOffReason, stop: Stop) => {
      disableAutoLocate(reason);
      focusStop(stop);
    },
    [disableAutoLocate, focusStop],
  );

  return {
    selectStopWithFallback,
    navigateAndFocusStop,
  };
}
