import { useCallback, useRef, useState } from 'react';
import { formatDateKey } from '../domain/transit/calendar-utils';
import { getServiceDayMinutes } from '../domain/transit/service-day';
import {
  buildTripInspectionMatchDiagnostics,
  deriveTripInspectionCandidates,
  getEmptyTripInspectionTargetsNote,
  loadTripInspectionSnapshot,
  refineTripInspectionState,
  serviceDayReferenceDateTime,
} from '../domain/transit/trip-inspection-state';
import {
  isSameTripInspectionTarget,
  selectTripInspectionTargetByReferenceTime,
} from '../domain/transit/trip-inspection-target';
import { createLogger, type Logger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type {
  TripInspectionTargetsEmptyReason,
  TripInspectionTargetsResult,
} from '../types/app/repository';
import type { SelectedTripSnapshot, TripInspectionTarget } from '../types/app/transit-composed';

const logger: Logger = createLogger('TripInspection');

interface OpenTripInspectionByStopIdParams {
  stopId: string;
  now: Date;
  serviceDate: Date;
}

export type TripInspectionNoDataReason =
  | TripInspectionTargetsEmptyReason
  | 'snapshot-unavailable'
  | 'target-missing';

type TripInspectionOpenOutcome =
  | { status: 'opened' }
  | { status: 'cancelled' }
  | { status: 'error' }
  | {
      status: 'no-data';
      reason: TripInspectionNoDataReason;
    };

interface UseTripInspectionReturn {
  tripInspectionSnapshot: SelectedTripSnapshot | null;
  tripInspectionTargets: TripInspectionTarget[];
  currentTripInspectionTargetIndex: number;
  openTripInspectionFromTarget: (
    target: TripInspectionTarget,
  ) => Promise<TripInspectionOpenOutcome>;
  openTripInspectionFromStopId: (
    params: OpenTripInspectionByStopIdParams,
  ) => Promise<TripInspectionOpenOutcome>;
  openPreviousTripInspection: () => void;
  openNextTripInspection: () => void;
  closeTripInspection: () => void;
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
    ): Promise<TripInspectionOpenOutcome> => {
      const lookupRequestId = lookupRequestIdRef.current + 1;
      lookupRequestIdRef.current = lookupRequestId;

      const trip = repo.getTripSnapshot(target.tripLocator, target.serviceDate);
      if (!trip.success) {
        logger.warn('openTripInspection: failed to resolve trip snapshot', trip.error);
        return { status: 'error' };
      }

      const loadedSnapshot = loadTripInspectionSnapshot(trip.data, target);
      if (!loadedSnapshot.ok) {
        return { status: 'no-data', reason: 'snapshot-unavailable' };
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
          return { status: 'opened' };
        }

        logger.warn('openTripInspection: target missing from cached trip-inspection targets', {
          target,
          cachedTargets: tripInspectionTargetsRef.current,
        });
      }

      // I/O glue: fetch the stop's full-day timetable entries and hand them
      // to the pure `refineTripInspectionState` for sort + resolve. The
      // navigation list now follows display-time order (Issue #63), shared
      // with the timetable grid (#201) and the NearbyStop bottom sheet (#202).
      //
      // The companion entry point `openTripInspectionFromStopId` still uses
      // `repo.getTripInspectionTargets` because
      // `selectTripInspectionTargetByReferenceTime` assumes
      // `departureMinutes`-ascending input (see its TSDoc).
      let entriesResult: Awaited<ReturnType<TransitRepository['getFullDayTimetableEntries']>>;
      try {
        entriesResult = await repo.getFullDayTimetableEntries(
          selectedStopId,
          serviceDayReferenceDateTime(target.serviceDate),
        );
      } catch (error: unknown) {
        if (lookupRequestIdRef.current !== lookupRequestId) {
          return { status: 'cancelled' };
        }
        logger.warn('openTripInspection: trip-inspection entry lookup threw', error, target);
        return { status: 'error' };
      }

      if (lookupRequestIdRef.current !== lookupRequestId) {
        return { status: 'cancelled' };
      }

      if (!entriesResult.success) {
        logger.warn(
          'openTripInspection: trip-inspection entry lookup failed',
          entriesResult.error,
          target,
        );
        return { status: 'error' };
      }

      const candidates = deriveTripInspectionCandidates(entriesResult.data, target.serviceDate);
      const refinedState = refineTripInspectionState(candidates, snapshot, target);
      if (!refinedState.ok) {
        if (logger.isEnabled('debug')) {
          const diagnostics = buildTripInspectionMatchDiagnostics(target, candidates);
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
        });
        return { status: 'no-data', reason: 'target-missing' };
      }

      if (
        refinedState.data.snapshot.currentStopIndex !== snapshot.currentStopIndex ||
        refinedState.data.snapshot.selectedStop !== snapshot.selectedStop
      ) {
        logger.warn('openTripInspection: using fallback trip-inspection target', {
          requestedTarget: target,
          resolvedTarget: refinedState.data.targets[refinedState.data.targetIndex],
        });
      }

      updateTripInspectionTargets(refinedState.data.targets);
      setCurrentTripInspectionTargetIndex(refinedState.data.targetIndex);
      setTripInspectionSnapshot(refinedState.data.snapshot);
      return { status: 'opened' };
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
          return { status: 'cancelled' } satisfies TripInspectionOpenOutcome;
        }

        if (!result.success) {
          logger.warn('openTripInspectionFromStopId: failed to load trip inspection targets', {
            stopId,
            serviceDate: serviceDate.toISOString(),
            error: result.error,
          });
          return { status: 'error' } satisfies TripInspectionOpenOutcome;
        }

        if (result.data.length === 0) {
          const emptyReason = result.meta.emptyReason;
          if (emptyReason === undefined) {
            logger.warn('openTripInspectionFromStopId: empty result missing emptyReason metadata', {
              stopId,
              serviceDate: serviceDate.toISOString(),
            });
            return { status: 'error' } satisfies TripInspectionOpenOutcome;
          }

          logger.warn('openTripInspectionFromStopId: empty trip inspection target result', {
            stopId,
            now: now.toISOString(),
            serviceDate: serviceDate.toISOString(),
            serviceDayKey: formatDateKey(serviceDate),
            currentServiceDayMinutes,
            emptyReason,
            note: getEmptyTripInspectionTargetsNote(emptyReason),
          });
          return {
            status: 'no-data',
            reason: emptyReason,
          } satisfies TripInspectionOpenOutcome;
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
          return { status: 'error' } satisfies TripInspectionOpenOutcome;
        }

        return openTripInspectionInternal(selectedTarget.target, false);
      } catch (error: unknown) {
        if (lookupRequestIdRef.current !== lookupRequestId) {
          return { status: 'cancelled' } satisfies TripInspectionOpenOutcome;
        }

        logger.warn('openTripInspectionFromStopId: unexpected error', {
          stopId,
          serviceDate: serviceDate.toISOString(),
          error,
        });
        return { status: 'error' } satisfies TripInspectionOpenOutcome;
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
        if (
          (status.status === 'no-data' || status.status === 'error') &&
          logger.isEnabled('debug')
        ) {
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
        if (
          (status.status === 'no-data' || status.status === 'error') &&
          logger.isEnabled('debug')
        ) {
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
