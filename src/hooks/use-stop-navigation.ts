import { useCallback } from 'react';
import { resolveStopRouteTypes } from '../domain/transit/resolve-stop-route-types';
import { createStopReferenceSnapshot } from '../domain/transit/stop-history';
import { resolveNavigableStopMeta } from '../domain/transit/stop-navigation';
import { createLogger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type { AutoLocateOffReason } from '../types/app/auto-locate';
import type { Result } from '../types/app/repository';
import type { StopReferenceSnapshot } from '../types/app/stop-reference-snapshot';
import type { AppRouteTypeValue, Stop } from '../types/app/transit';
import type { StopWithMeta } from '../types/app/transit-composed';

const logger = createLogger('StopNavigation');

export interface UseStopNavigationParams {
  repo: TransitRepository;
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
  navigateAndFocusStop: (
    stop: Stop,
    reason: AutoLocateOffReason,
    routeTypes?: readonly AppRouteTypeValue[],
  ) => void;
  navigateAndFocusStopById: (
    stopId: string,
    reason: AutoLocateOffReason,
    routeTypes?: readonly AppRouteTypeValue[],
  ) => Promise<Result<StopWithMeta>>;
}

export function useStopNavigation(params: UseStopNavigationParams): UseStopNavigationReturn {
  const {
    repo,
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
      recordStopSelection(
        createStopReferenceSnapshot(
          meta,
          routeTypes ??
            resolveStopRouteTypes({
              stopId: meta.stop.stop_id,
              routeTypeMap,
              routes: meta.routes,
              unknownPolicy: 'include-unknown',
            }),
        ),
      );
    },
    [recordStopSelection, routeTypeMap],
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
    (stop: Stop, reason: AutoLocateOffReason, routeTypes?: readonly AppRouteTypeValue[]) => {
      disableAutoLocate(reason);
      focusStop(stop);
      const meta = resolveNavigableStopMeta(stop.stop_id, radiusStops, inBoundStops, stop);
      if (meta) {
        recordStopHistorySelection(meta, routeTypes);
      }
    },
    [disableAutoLocate, focusStop, radiusStops, inBoundStops, recordStopHistorySelection],
  );

  const navigateAndFocusStopById = useCallback(
    async (
      stopId: string,
      reason: AutoLocateOffReason,
      routeTypes?: readonly AppRouteTypeValue[],
    ) => {
      const result = await repo.getStopMetaById(stopId);
      if (result.success) {
        disableAutoLocate(reason);
        focusStop(result.data.stop);
        recordStopHistorySelection(result.data, routeTypes);
      }
      return result;
    },
    [repo, disableAutoLocate, focusStop, recordStopHistorySelection],
  );

  return {
    selectStopWithFallback,
    navigateAndFocusStop,
    navigateAndFocusStopById,
  };
}
