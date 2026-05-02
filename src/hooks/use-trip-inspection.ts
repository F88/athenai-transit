import { useCallback, useRef, useState } from 'react';
import { formatDateKey } from '../domain/transit/calendar-utils';
import { getServiceDayMinutes } from '../domain/transit/service-day';
import {
  isSameTripInspectionTarget,
  resolveSelectedTripInspectionSnapshot,
  resolveTripInspectionDisplayState,
  selectTripInspectionTargetByReferenceTime,
} from '../domain/transit/trip-inspection-target';
import { createLogger, type Logger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type { TripInspectionTargetsResult } from '../types/app/repository';
import type {
  SelectedTripSnapshot,
  TripInspectionTarget,
  TripSnapshot,
} from '../types/app/transit-composed';

const logger: Logger = createLogger('TripInspection');

interface OpenTripInspectionByStopIdParams {
  stopId: string;
  now: Date;
  serviceDate: Date;
}

type TripInspectionOpenResult = 'opened' | 'no-data' | 'error' | 'cancelled';

type TripInspectionLoadResult = Extract<TripInspectionOpenResult, 'error' | 'no-data'>;
type RefineFailureStatus = Extract<TripInspectionOpenResult, 'no-data' | 'error' | 'cancelled'>;

interface LoadedTripInspectionSnapshot {
  snapshot: SelectedTripSnapshot;
  selectedStopId: string;
}

type LoadedTripInspectionSnapshotResult =
  | {
      ok: true;
      data: LoadedTripInspectionSnapshot;
    }
  | {
      ok: false;
      status: TripInspectionLoadResult;
    };

interface RefinedTripInspectionState {
  snapshot: SelectedTripSnapshot;
  targets: TripInspectionTarget[];
  targetIndex: number;
}

type RefinedTripInspectionStateResult =
  | {
      ok: true;
      data: RefinedTripInspectionState;
    }
  | {
      ok: false;
      status: RefineFailureStatus;
    };

interface UseTripInspectionReturn {
  tripInspectionSnapshot: SelectedTripSnapshot | null;
  tripInspectionTargets: TripInspectionTarget[];
  currentTripInspectionTargetIndex: number;
  openTripInspectionFromTarget: (target: TripInspectionTarget) => Promise<TripInspectionOpenResult>;
  openTripInspectionFromStopId: (
    params: OpenTripInspectionByStopIdParams,
  ) => Promise<TripInspectionOpenResult>;
  openPreviousTripInspection: () => void;
  openNextTripInspection: () => void;
  closeTripInspection: () => void;
}

function buildTripInspectionMatchDiagnostics(
  target: TripInspectionTarget,
  candidates: TripInspectionTarget[],
) {
  const summarizeTarget = (candidate: TripInspectionTarget) => ({
    patternId: candidate.tripLocator.patternId,
    serviceId: candidate.tripLocator.serviceId,
    tripIndex: candidate.tripLocator.tripIndex,
    stopIndex: candidate.stopIndex,
    departureMinutes: candidate.departureMinutes,
    serviceDate: candidate.serviceDate.toISOString(),
  });

  const sameService = candidates.filter(
    (candidate) =>
      candidate.tripLocator.patternId === target.tripLocator.patternId &&
      candidate.tripLocator.serviceId === target.tripLocator.serviceId,
  );
  const sameTripIndex = sameService.filter(
    (candidate) => candidate.tripLocator.tripIndex === target.tripLocator.tripIndex,
  );
  const sameStopIndex = sameTripIndex.filter(
    (candidate) => candidate.stopIndex === target.stopIndex,
  );

  return {
    patternId: target.tripLocator.patternId,
    serviceId: target.tripLocator.serviceId,
    tripIndex: target.tripLocator.tripIndex,
    stopIndex: target.stopIndex,
    departureMinutes: target.departureMinutes,
    serviceDate: target.serviceDate.toISOString(),
    sampleSameService: sameService.slice(0, 5).map(summarizeTarget),
    sampleSameTripIndex: sameTripIndex.slice(0, 5).map(summarizeTarget),
    sampleSameStopIndex: sameStopIndex.slice(0, 5).map(summarizeTarget),
  };
}

function loadTripInspectionSnapshot(
  trip: TripSnapshot,
  target: TripInspectionTarget,
): LoadedTripInspectionSnapshotResult {
  const resolvedSnapshot = resolveSelectedTripInspectionSnapshot(trip, target);
  if (!resolvedSnapshot.ok) {
    switch (resolvedSnapshot.reason) {
      case 'pattern-position-missing':
        logger.warn(
          `openTripInspection: selected stop index ${target.stopIndex} is missing from reconstructed trip snapshot`,
        );
        break;
      case 'stop-row-missing':
        logger.warn(
          'openTripInspection: selected stop row is missing from reconstructed trip snapshot',
          {
            target,
          },
        );
        break;
      default: {
        const exhaustiveReason: never = resolvedSnapshot.reason;
        logger.warn('openTripInspection: unexpected snapshot resolution failure', {
          target,
          reason: exhaustiveReason,
        });
      }
    }

    return { ok: false, status: 'no-data' };
  }

  if (resolvedSnapshot.data.selectedStopId === undefined) {
    logger.warn(
      'openTripInspection: selected stop metadata missing; skip trip-inspection target lookup',
    );
    return { ok: false, status: 'no-data' };
  }

  return {
    ok: true,
    data: {
      snapshot: resolvedSnapshot.data.snapshot,
      selectedStopId: resolvedSnapshot.data.selectedStopId,
    },
  };
}

async function refineTripInspectionState(
  repo: TransitRepository,
  target: TripInspectionTarget,
  snapshot: SelectedTripSnapshot,
  selectedStopId: string,
  isCancelled: () => boolean,
): Promise<RefinedTripInspectionStateResult> {
  try {
    const result = await repo.getTripInspectionTargets({
      serviceDate: target.serviceDate,
      stopId: selectedStopId,
    });

    if (isCancelled()) {
      return { ok: false, status: 'cancelled' };
    }

    if (!result.success) {
      logger.warn('openTripInspection: trip-inspection target lookup failed', result.error, target);
      return { ok: false, status: 'error' };
    }

    if (result.data.length === 0) {
      return { ok: false, status: 'no-data' };
    }

    const resolvedState = resolveTripInspectionDisplayState(snapshot, result.data, target);
    if (!resolvedState.ok) {
      if (logger.isEnabled('debug')) {
        const diagnostics = buildTripInspectionMatchDiagnostics(target, result.data);
        logger.debug(
          'openTripInspection: target lookup mismatch sampleSameService',
          diagnostics.sampleSameService,
        );
        logger.debug(
          'openTripInspection: target lookup mismatch sampleSameTripIndex',
          diagnostics.sampleSameTripIndex,
        );
        logger.debug(
          'openTripInspection: target lookup mismatch sampleSameStopIndex',
          diagnostics.sampleSameStopIndex,
        );
        logger.debug('openTripInspection: target lookup mismatch diagnostics', diagnostics);
      }
      logger.warn('openTripInspection: current target missing from trip-inspection targets', {
        target,
        targets: result.data,
      });
      return { ok: false, status: 'no-data' };
    }

    if (
      resolvedState.data.snapshot.currentStopIndex !== snapshot.currentStopIndex ||
      resolvedState.data.snapshot.selectedStop !== snapshot.selectedStop
    ) {
      logger.warn('openTripInspection: using fallback trip-inspection target', {
        requestedTarget: target,
        resolvedTarget: resolvedState.data.targets[resolvedState.data.targetIndex],
      });
    }

    return {
      ok: true,
      data: {
        snapshot: resolvedState.data.snapshot,
        targets: resolvedState.data.targets,
        targetIndex: resolvedState.data.targetIndex,
      },
    };
  } catch (error: unknown) {
    if (isCancelled()) {
      return { ok: false, status: 'cancelled' };
    }

    logger.warn('openTripInspection: trip-inspection target lookup threw', error, target);
    return { ok: false, status: 'error' };
  }
}

/**
 * Manage the currently selected trip inspection snapshot and expose handlers
 * to open or close the dialog from a timetable entry.
 *
 * @param repo - Repository used to reconstruct a full trip snapshot for the selected target.
 * @returns Current trip inspection snapshot state and open/close handlers.
 */
export function useTripInspection(repo: TransitRepository): UseTripInspectionReturn {
  const [tripInspectionSnapshot, setTripInspectionSnapshot] = useState<SelectedTripSnapshot | null>(
    null,
  );
  const [tripInspectionTargets, setTripInspectionTargets] = useState<TripInspectionTarget[]>([]);
  const [currentTripInspectionTargetIndex, setCurrentTripInspectionTargetIndex] = useState(-1);
  const tripInspectionTargetsRef = useRef<TripInspectionTarget[]>([]);
  const lookupRequestIdRef = useRef(0);

  const updateTripInspectionTargets = useCallback((targets: TripInspectionTarget[]) => {
    tripInspectionTargetsRef.current = targets;
    setTripInspectionTargets(targets);
  }, []);

  const closeTripInspection = useCallback(() => {
    lookupRequestIdRef.current += 1;
    setTripInspectionSnapshot(null);
    updateTripInspectionTargets([]);
    setCurrentTripInspectionTargetIndex(-1);
  }, [updateTripInspectionTargets]);

  const openTripInspectionInternal = useCallback(
    async (
      target: TripInspectionTarget,
      preferCachedTargets: boolean,
    ): Promise<TripInspectionOpenResult> => {
      const lookupRequestId = lookupRequestIdRef.current + 1;
      lookupRequestIdRef.current = lookupRequestId;

      const trip = repo.getTripSnapshot(target.tripLocator, target.serviceDate);
      if (!trip.success) {
        logger.warn('openTripInspection: failed to resolve trip snapshot', trip.error);
        return 'error';
      }

      const loadedSnapshot = loadTripInspectionSnapshot(trip.data, target);
      if (!loadedSnapshot.ok) {
        return loadedSnapshot.status;
      }

      const { snapshot, selectedStopId } = loadedSnapshot.data;

      if (preferCachedTargets) {
        // Prev/next navigation prefers the cached target list for a fast local
        // move, but it intentionally falls through to a fresh lookup when the
        // requested target is missing from that cache.
        const currentIndex = tripInspectionTargetsRef.current.findIndex((candidate) =>
          isSameTripInspectionTarget(candidate, target),
        );
        if (currentIndex >= 0) {
          setTripInspectionSnapshot(snapshot);
          setCurrentTripInspectionTargetIndex(currentIndex);
          return 'opened';
        }

        logger.warn('openTripInspection: target missing from cached trip-inspection targets', {
          target,
          cachedTargets: tripInspectionTargetsRef.current,
        });
      }

      const refinedState = await refineTripInspectionState(
        repo,
        target,
        snapshot,
        selectedStopId,
        () => lookupRequestIdRef.current !== lookupRequestId,
      );
      if (!refinedState.ok) {
        return refinedState.status;
      }

      updateTripInspectionTargets(refinedState.data.targets);
      setCurrentTripInspectionTargetIndex(refinedState.data.targetIndex);
      setTripInspectionSnapshot(refinedState.data.snapshot);
      return 'opened';
    },
    [repo, updateTripInspectionTargets],
  );

  const openTripInspectionFromTarget = useCallback(
    (target: TripInspectionTarget) => {
      return openTripInspectionInternal(target, false);
    },
    [openTripInspectionInternal],
  );

  const openTripInspectionFromStopId = useCallback(
    async ({ stopId, now, serviceDate }: OpenTripInspectionByStopIdParams) => {
      const lookupRequestId = lookupRequestIdRef.current + 1;
      lookupRequestIdRef.current = lookupRequestId;
      const currentServiceDayMinutes = getServiceDayMinutes(now);

      try {
        const result: TripInspectionTargetsResult = await repo.getTripInspectionTargets({
          stopId,
          serviceDate,
        });

        if (lookupRequestIdRef.current !== lookupRequestId) {
          return 'cancelled' satisfies TripInspectionOpenResult;
        }

        if (!result.success) {
          logger.warn('openTripInspectionFromStopId: failed to load trip inspection targets', {
            stopId,
            serviceDate: serviceDate.toISOString(),
            error: result.error,
          });
          return 'error' satisfies TripInspectionOpenResult;
        }

        if (result.data.length === 0) {
          const emptyReason = result.meta.emptyReason;
          logger.warn('openTripInspectionFromStopId: empty trip inspection target result', {
            stopId,
            now: now.toISOString(),
            serviceDate: serviceDate.toISOString(),
            serviceDayKey: formatDateKey(serviceDate),
            currentServiceDayMinutes,
            emptyReason,
            note:
              emptyReason === 'no-stop-data'
                ? 'The stop has no trip-inspection stop data.'
                : 'The stop has trip-inspection data, but no services on the selected service day.',
          });
          return 'no-data' satisfies TripInspectionOpenResult;
        }

        const selectedTarget = selectTripInspectionTargetByReferenceTime(
          result.data,
          currentServiceDayMinutes,
        );

        if (selectedTarget === null) {
          logger.warn(
            'openTripInspectionFromStopId: failed to resolve target from non-empty candidate list',
            {
              stopId,
              now: now.toISOString(),
              serviceDate: serviceDate.toISOString(),
              serviceDayKey: formatDateKey(serviceDate),
              currentServiceDayMinutes,
              candidateCount: result.data.length,
            },
          );
          return 'error' satisfies TripInspectionOpenResult;
        }

        return openTripInspectionInternal(selectedTarget.target, false);
      } catch (error: unknown) {
        if (lookupRequestIdRef.current !== lookupRequestId) {
          return 'cancelled' satisfies TripInspectionOpenResult;
        }

        logger.warn('openTripInspectionFromStopId: unexpected error', {
          stopId,
          serviceDate: serviceDate.toISOString(),
          error,
        });
        return 'error' satisfies TripInspectionOpenResult;
      }
    },
    [openTripInspectionInternal, repo],
  );

  const openPreviousTripInspection = useCallback(() => {
    if (currentTripInspectionTargetIndex <= 0) {
      return;
    }

    const previousTarget = tripInspectionTargets[currentTripInspectionTargetIndex - 1];
    if (previousTarget) {
      void openTripInspectionInternal(previousTarget, true).then((status) => {
        if ((status === 'no-data' || status === 'error') && logger.isEnabled('debug')) {
          logger.debug('openTripInspection: previous target open failed after inner warning', {
            status,
            target: previousTarget,
          });
        }
      });
    }
  }, [currentTripInspectionTargetIndex, openTripInspectionInternal, tripInspectionTargets]);

  const openNextTripInspection = useCallback(() => {
    if (currentTripInspectionTargetIndex < 0) {
      return;
    }

    const nextTarget = tripInspectionTargets[currentTripInspectionTargetIndex + 1];
    if (nextTarget) {
      void openTripInspectionInternal(nextTarget, true).then((status) => {
        if ((status === 'no-data' || status === 'error') && logger.isEnabled('debug')) {
          logger.debug('openTripInspection: next target open failed after inner warning', {
            status,
            target: nextTarget,
          });
        }
      });
    }
  }, [currentTripInspectionTargetIndex, openTripInspectionInternal, tripInspectionTargets]);

  return {
    tripInspectionSnapshot,
    tripInspectionTargets,
    currentTripInspectionTargetIndex,
    openTripInspectionFromTarget,
    openTripInspectionFromStopId,
    openPreviousTripInspection,
    openNextTripInspection,
    closeTripInspection,
  };
}
