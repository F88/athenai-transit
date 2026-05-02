import { useCallback, useRef, useState } from 'react';
import { getServiceDayMinutes } from '../domain/transit/service-day';
import {
  isSameTripInspectionTarget,
  resolveSnapshotStopIndex,
  resolveTripInspectionTarget,
  selectTripInspectionTargetByReferenceTime,
} from '../domain/transit/trip-inspection-target';
import { createLogger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type { SelectedTripSnapshot, TripInspectionTarget } from '../types/app/transit-composed';

const logger = createLogger('TripInspection');

interface OpenTripInspectionByStopIdParams {
  stopId: string;
  now: Date;
  serviceDate: Date;
}

type TripInspectionOpenResult = 'opened' | 'no-data' | 'error' | 'cancelled';

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

function summarizeTripInspectionTarget(target: TripInspectionTarget) {
  return {
    patternId: target.tripLocator.patternId,
    serviceId: target.tripLocator.serviceId,
    tripIndex: target.tripLocator.tripIndex,
    stopIndex: target.stopIndex,
    departureMinutes: target.departureMinutes,
    serviceDate: target.serviceDate.toISOString(),
  };
}

function buildTripInspectionMatchDiagnostics(
  target: TripInspectionTarget,
  candidates: TripInspectionTarget[],
) {
  const samePattern = candidates.filter(
    (candidate) => candidate.tripLocator.patternId === target.tripLocator.patternId,
  );
  const sameService = samePattern.filter(
    (candidate) => candidate.tripLocator.serviceId === target.tripLocator.serviceId,
  );
  const sameTripIndex = sameService.filter(
    (candidate) => candidate.tripLocator.tripIndex === target.tripLocator.tripIndex,
  );
  const sameStopIndex = sameTripIndex.filter(
    (candidate) => candidate.stopIndex === target.stopIndex,
  );
  const sameServiceDate = sameStopIndex.filter(
    (candidate) => candidate.serviceDate.getTime() === target.serviceDate.getTime(),
  );
  const sameDepartureMinutes = sameStopIndex.filter(
    (candidate) => candidate.departureMinutes === target.departureMinutes,
  );

  return {
    patternId: target.tripLocator.patternId,
    serviceId: target.tripLocator.serviceId,
    tripIndex: target.tripLocator.tripIndex,
    stopIndex: target.stopIndex,
    departureMinutes: target.departureMinutes,
    serviceDate: target.serviceDate.toISOString(),
    counts: {
      total: candidates.length,
      samePattern: samePattern.length,
      sameService: sameService.length,
      sameTripIndex: sameTripIndex.length,
      sameStopIndex: sameStopIndex.length,
      sameServiceDate: sameServiceDate.length,
      sameDepartureMinutesAfterStopIndex: sameDepartureMinutes.length,
    },
    sampleSamePattern: samePattern.slice(0, 5).map(summarizeTripInspectionTarget),
    sampleSameService: sameService.slice(0, 5).map(summarizeTripInspectionTarget),
    sampleSameTripIndex: sameTripIndex.slice(0, 5).map(summarizeTripInspectionTarget),
    sampleSameStopIndex: sameStopIndex.slice(0, 5).map(summarizeTripInspectionTarget),
  };
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
      refreshTargets: boolean,
    ): Promise<TripInspectionOpenResult> => {
      const lookupRequestId = lookupRequestIdRef.current + 1;
      lookupRequestIdRef.current = lookupRequestId;

      const trip = repo.getTripSnapshot(target.tripLocator, target.serviceDate);
      if (!trip.success) {
        logger.warn('openTripInspection: failed to resolve trip snapshot', trip.error);
        return 'error';
      }

      const selectedStopIndex = resolveSnapshotStopIndex(trip.data.stopTimes, target);
      if (selectedStopIndex < 0) {
        logger.warn(
          `openTripInspection: selected stop index ${target.stopIndex} is missing from reconstructed trip snapshot`,
        );
        return 'no-data';
      }

      const selectedStop = trip.data.stopTimes[selectedStopIndex];
      if (!selectedStop) {
        logger.warn(
          `openTripInspection: selected stop array index ${selectedStopIndex} is missing from reconstructed trip snapshot`,
        );
        return 'no-data';
      }

      const snapshot: SelectedTripSnapshot = {
        ...trip.data,
        currentStopIndex: selectedStopIndex,
        selectedStop,
      };

      // logger.debug(buildTripInspectionSummaryLog(snapshot), snapshot);
      // logger.debug(buildTripInspectionStopsLog(snapshot));

      if (!refreshTargets) {
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
          tripInspectionTargets: tripInspectionTargetsRef.current,
        });
      }

      const selectedStopId = selectedStop.stopMeta?.stop.stop_id;
      if (selectedStopId === undefined) {
        logger.warn(
          'openTripInspection: selected stop metadata missing; skip trip-inspection target lookup',
        );
        return 'no-data';
      }

      try {
        const result = await repo.getTripInspectionTargets({
          serviceDate: target.serviceDate,
          stopId: selectedStopId,
        });

        if (lookupRequestIdRef.current !== lookupRequestId) {
          return 'cancelled';
        }

        // logger.debug(
        //   `openTripInspection: getTripInspectionTargets result serviceDate=${formatTripInspectionServiceDate(target.serviceDate)} stopId=${selectedStopId}`,
        //   result,
        // );

        if (!result.success) {
          logger.warn(
            'openTripInspection: trip-inspection target lookup failed',
            result.error,
            target,
          );
          return 'error';
        }

        if (result.data.length === 0) {
          // logger.debug('openTripInspection: trip-inspection target lookup returned no targets');
          return 'no-data';
        }

        const resolvedTarget = resolveTripInspectionTarget(result.data, target);
        if (resolvedTarget === null) {
          const diagnostics = buildTripInspectionMatchDiagnostics(target, result.data);
          // logger.debug('openTripInspection: target lookup mismatch', {
          //   requestedStopId: selectedStopId,
          //   target: summarizeTripInspectionTarget(target),
          //   sampleCandidates: result.data.slice(0, 10).map(summarizeTripInspectionTarget),
          // });
          // logger.debug('openTripInspection: target lookup mismatch counts', diagnostics.counts);
          // logger.debug(
          //   'openTripInspection: target lookup mismatch sampleSamePattern',
          //   diagnostics.sampleSamePattern,
          // );
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
          logger.warn('openTripInspection: current target missing from trip-inspection targets', {
            target,
            targets: result.data,
          });
          return 'no-data';
        }

        let resolvedSnapshot = snapshot;

        if (resolvedTarget.matchType === 'fallback') {
          const fallbackStopIndex = resolveSnapshotStopIndex(
            trip.data.stopTimes,
            resolvedTarget.target,
          );
          let fallbackSelectedStop;
          if (fallbackStopIndex >= 0) {
            fallbackSelectedStop = trip.data.stopTimes[fallbackStopIndex];
          }
          if (!fallbackSelectedStop) {
            logger.warn(
              'openTripInspection: fallback target resolved but snapshot stop is missing',
              {
                requestedTarget: target,
                resolvedTarget: resolvedTarget.target,
              },
            );
            return 'no-data';
          }

          resolvedSnapshot = {
            ...trip.data,
            currentStopIndex: fallbackStopIndex,
            selectedStop: fallbackSelectedStop,
          };
          logger.warn('openTripInspection: using fallback trip-inspection target', {
            requestedTarget: target,
            resolvedTarget: resolvedTarget.target,
          });
        }

        updateTripInspectionTargets(result.data);
        setCurrentTripInspectionTargetIndex(resolvedTarget.index);
        setTripInspectionSnapshot(resolvedSnapshot);

        // logger.debug(
        //   `openTripInspection: serviceDate=${formatTripInspectionServiceDate(target.serviceDate)} trip-inspection targets=${result.data.length} currentIndex=${resolvedTarget.index} stopId=${selectedStopId}`,
        //   result.data,
        // );
        return 'opened';
      } catch (error: unknown) {
        if (lookupRequestIdRef.current !== lookupRequestId) {
          return 'cancelled';
        }
        logger.warn('openTripInspection: trip-inspection target lookup threw', error, target);
        return 'error';
      }
    },
    [repo, updateTripInspectionTargets],
  );

  const openTripInspectionFromTarget = useCallback(
    (target: TripInspectionTarget) => {
      return openTripInspectionInternal(target, true);
    },
    [openTripInspectionInternal],
  );

  const openTripInspectionFromStopId = useCallback(
    async ({ stopId, now, serviceDate }: OpenTripInspectionByStopIdParams) => {
      const lookupRequestId = lookupRequestIdRef.current + 1;
      lookupRequestIdRef.current = lookupRequestId;
      const currentServiceDayMinutes = getServiceDayMinutes(now);

      try {
        const result = await repo.getTripInspectionTargets({ stopId, serviceDate });

        if (lookupRequestIdRef.current !== lookupRequestId) {
          return 'cancelled' satisfies TripInspectionOpenResult;
        }

        if (!result.success) {
          logger.warn('openTripInspectionByStopId: failed to load trip inspection targets', {
            stopId,
            serviceDate: serviceDate.toISOString(),
            error: result.error,
          });
          return 'error' satisfies TripInspectionOpenResult;
        }

        const selectedTarget = selectTripInspectionTargetByReferenceTime(
          result.data,
          currentServiceDayMinutes,
        );

        if (selectedTarget === null) {
          logger.warn('openTripInspectionByStopId: no trip inspection targets', {
            stopId,
            serviceDate: serviceDate.toISOString(),
          });
          return 'no-data' satisfies TripInspectionOpenResult;
        }

        return openTripInspectionInternal(selectedTarget.target, true);
      } catch (error: unknown) {
        if (lookupRequestIdRef.current !== lookupRequestId) {
          return 'cancelled' satisfies TripInspectionOpenResult;
        }

        logger.warn('openTripInspectionByStopId: unexpected error', {
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
      void openTripInspectionInternal(previousTarget, false).then((status) => {
        if (status === 'no-data' || status === 'error') {
          logger.warn('openTripInspection: failed to open previous target', {
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
      void openTripInspectionInternal(nextTarget, false).then((status) => {
        if (status === 'no-data' || status === 'error') {
          logger.warn('openTripInspection: failed to open next target', {
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
