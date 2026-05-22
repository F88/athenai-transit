import { useCallback } from 'react';
import { createLogger } from '../lib/logger';
import type { AutoLocateOffReason } from '../types/app/auto-locate';
import type { Stop } from '../types/app/transit';
import type { StopWithMeta } from '../types/app/transit-composed';

const logger = createLogger('StopNavigation');

export interface UseStopNavigationParams {
  radiusStops: readonly StopWithMeta[];
  inBoundStops: readonly StopWithMeta[];
  disableAutoLocate: (reason: AutoLocateOffReason) => void;
  selectStopById: (stopId: string, fallbackStop?: Stop) => void;
  focusStop: (stop: Stop) => void;
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
  const { disableAutoLocate, selectStopById, focusStop } = params;

  // Immediate selection helper for paths that already have a concrete Stop or
  // a UI-local stopId. Arbitrary persistent stop IDs such as URL params must
  // still go through `repo.getStopMetaById` before calling into navigation.
  const selectStopWithFallback = useCallback(
    (stopId: string, reason: AutoLocateOffReason, fallbackStop?: Stop) => {
      if (logger.isEnabled('debug')) {
        logger.debug(
          `selectStopWithFallback: reason=${reason}, stopId=${stopId}, name=${fallbackStop?.stop_name ?? 'unknown'}`,
        );
      }
      disableAutoLocate(reason);
      selectStopById(stopId, fallbackStop);
    },
    [disableAutoLocate, selectStopById],
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
