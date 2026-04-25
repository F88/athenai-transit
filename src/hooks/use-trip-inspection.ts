import { useCallback, useRef, useState } from 'react';
import { formatDateKey } from '../domain/transit/calendar-utils';
import { createLogger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type { SelectedTripSnapshot, TripInspectionTarget } from '../types/app/transit-composed';

const logger = createLogger('TripInspection');

interface UseTripInspectionReturn {
  tripInspectionSnapshot: SelectedTripSnapshot | null;
  tripInspectionTargets: TripInspectionTarget[];
  currentTripInspectionTargetIndex: number;
  openTripInspection: (target: TripInspectionTarget) => void;
  openPreviousTripInspection: () => void;
  openNextTripInspection: () => void;
  closeTripInspection: () => void;
}

function isSameTripInspectionTarget(
  left: TripInspectionTarget,
  right: TripInspectionTarget,
): boolean {
  return (
    left.tripLocator.patternId === right.tripLocator.patternId &&
    left.tripLocator.serviceId === right.tripLocator.serviceId &&
    left.tripLocator.tripIndex === right.tripLocator.tripIndex &&
    left.stopIndex === right.stopIndex &&
    left.serviceDate.getTime() === right.serviceDate.getTime()
  );
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

function formatTripInspectionServiceDate(serviceDate: Date): string {
  return formatDateKey(serviceDate);
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
    (target: TripInspectionTarget, refreshTargets: boolean) => {
      const lookupRequestId = lookupRequestIdRef.current + 1;
      lookupRequestIdRef.current = lookupRequestId;

      const trip = repo.getTripSnapshot(target.tripLocator, target.serviceDate);
      if (!trip.success) {
        logger.warn('openTripInspection: failed to resolve trip snapshot', trip.error);
        return;
      }

      const selectedStopIndex = trip.data.stopTimes.findIndex(
        (stop) => stop.timetableEntry.patternPosition.stopIndex === target.stopIndex,
      );
      if (selectedStopIndex < 0) {
        logger.warn(
          `openTripInspection: selected stop index ${target.stopIndex} is missing from reconstructed trip snapshot`,
        );
        return;
      }

      const selectedStop = trip.data.stopTimes[selectedStopIndex];
      if (!selectedStop) {
        logger.warn(
          `openTripInspection: selected stop array index ${selectedStopIndex} is missing from reconstructed trip snapshot`,
        );
        return;
      }

      const snapshot: SelectedTripSnapshot = {
        ...trip.data,
        currentStopIndex: selectedStopIndex,
        selectedStop,
      };

      // logger.debug(buildTripInspectionSummaryLog(snapshot), snapshot);
      // logger.debug(buildTripInspectionStopsLog(snapshot));

      setTripInspectionSnapshot(snapshot);

      if (!refreshTargets) {
        const currentIndex = tripInspectionTargetsRef.current.findIndex((candidate) =>
          isSameTripInspectionTarget(candidate, target),
        );
        if (currentIndex >= 0) {
          setCurrentTripInspectionTargetIndex(currentIndex);
          return;
        }

        logger.warn('openTripInspection: target missing from cached trip-inspection targets', {
          target,
          tripInspectionTargets: tripInspectionTargetsRef.current,
        });
      }

      updateTripInspectionTargets([target]);
      setCurrentTripInspectionTargetIndex(0);

      const selectedStopId = selectedStop.stopMeta?.stop.stop_id;
      if (selectedStopId === undefined) {
        logger.warn(
          'openTripInspection: selected stop metadata missing; skip trip-inspection target lookup',
        );
        return;
      }

      void repo
        .getTripInspectionTargets({
          serviceDate: target.serviceDate,
          stopId: selectedStopId,
        })
        .then((result) => {
          if (lookupRequestIdRef.current !== lookupRequestId) {
            return;
          }

          logger.debug(
            `openTripInspection: getTripInspectionTargets result serviceDate=${formatTripInspectionServiceDate(target.serviceDate)} stopId=${selectedStopId}`,
            result,
          );

          if (!result.success) {
            logger.warn(
              'openTripInspection: trip-inspection target lookup failed',
              result.error,
              target,
            );
            return;
          }

          if (result.data.length === 0) {
            updateTripInspectionTargets([target]);
            setCurrentTripInspectionTargetIndex(0);
            logger.debug('openTripInspection: trip-inspection target lookup returned no targets');
            return;
          }

          const currentIndex = result.data.findIndex((candidate) =>
            isSameTripInspectionTarget(candidate, target),
          );
          if (currentIndex < 0) {
            const diagnostics = buildTripInspectionMatchDiagnostics(target, result.data);
            logger.debug('openTripInspection: target lookup mismatch', {
              requestedStopId: selectedStopId,
              target: summarizeTripInspectionTarget(target),
              sampleCandidates: result.data.slice(0, 10).map(summarizeTripInspectionTarget),
            });
            logger.debug('openTripInspection: target lookup mismatch counts', diagnostics.counts);
            logger.debug(
              'openTripInspection: target lookup mismatch sampleSamePattern',
              diagnostics.sampleSamePattern,
            );
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
            updateTripInspectionTargets([target]);
            setCurrentTripInspectionTargetIndex(0);
            logger.warn('openTripInspection: current target missing from trip-inspection targets', {
              target,
              targets: result.data,
            });
            return;
          }

          updateTripInspectionTargets(result.data);
          setCurrentTripInspectionTargetIndex(currentIndex);

          logger.debug(
            `openTripInspection: serviceDate=${formatTripInspectionServiceDate(target.serviceDate)} trip-inspection targets=${result.data.length} currentIndex=${currentIndex} stopId=${selectedStopId}`,
            result.data,
          );
        })
        .catch((error: unknown) => {
          if (lookupRequestIdRef.current !== lookupRequestId) {
            return;
          }
          logger.warn('openTripInspection: trip-inspection target lookup threw', error, target);
        });
    },
    [repo, updateTripInspectionTargets],
  );

  const openTripInspection = useCallback(
    (target: TripInspectionTarget) => {
      openTripInspectionInternal(target, true);
    },
    [openTripInspectionInternal],
  );

  const openPreviousTripInspection = useCallback(() => {
    if (currentTripInspectionTargetIndex <= 0) {
      return;
    }

    const previousTarget = tripInspectionTargets[currentTripInspectionTargetIndex - 1];
    if (previousTarget) {
      openTripInspectionInternal(previousTarget, false);
    }
  }, [currentTripInspectionTargetIndex, openTripInspectionInternal, tripInspectionTargets]);

  const openNextTripInspection = useCallback(() => {
    if (currentTripInspectionTargetIndex < 0) {
      return;
    }

    const nextTarget = tripInspectionTargets[currentTripInspectionTargetIndex + 1];
    if (nextTarget) {
      openTripInspectionInternal(nextTarget, false);
    }
  }, [currentTripInspectionTargetIndex, openTripInspectionInternal, tripInspectionTargets]);

  return {
    tripInspectionSnapshot,
    tripInspectionTargets,
    currentTripInspectionTargetIndex,
    openTripInspection,
    openPreviousTripInspection,
    openNextTripInspection,
    closeTripInspection,
  };
}
