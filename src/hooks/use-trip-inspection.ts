import { useCallback, useRef, useState } from 'react';
import { createLogger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type { SelectedTripSnapshot, TripInspectionTarget } from '../types/app/transit-composed';
import {
  buildTripInspectionStopsLog,
  buildTripInspectionSummaryLog,
} from '../utils/trip-inspection-log';

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
  const lookupRequestIdRef = useRef(0);

  const closeTripInspection = useCallback(() => {
    lookupRequestIdRef.current += 1;
    setTripInspectionSnapshot(null);
    setTripInspectionTargets([]);
    setCurrentTripInspectionTargetIndex(-1);
  }, []);

  const openTripInspectionInternal = useCallback(
    (target: TripInspectionTarget, refreshTargets: boolean) => {
      const lookupRequestId = lookupRequestIdRef.current + 1;
      lookupRequestIdRef.current = lookupRequestId;

      const trip = repo.getTripSnapshot(target.tripLocator, target.serviceDate);
      if (!trip.success) {
        logger.warn('openTripInspection: failed to resolve trip snapshot', trip.error);
        return;
      }

      const selectedStop = trip.data.stopTimes.find(
        (stop) => stop.timetableEntry.patternPosition.stopIndex === target.stopIndex,
      );
      if (!selectedStop) {
        logger.warn(
          `openTripInspection: selected stop index ${target.stopIndex} is missing from reconstructed trip snapshot`,
        );
        return;
      }

      const snapshot: SelectedTripSnapshot = {
        ...trip.data,
        currentStopIndex: target.stopIndex,
        selectedStop,
      };

      logger.debug(buildTripInspectionSummaryLog(snapshot), snapshot);
      logger.debug(buildTripInspectionStopsLog(snapshot));

      setTripInspectionSnapshot(snapshot);

      if (!refreshTargets) {
        const currentIndex = tripInspectionTargets.findIndex((candidate) =>
          isSameTripInspectionTarget(candidate, target),
        );
        if (currentIndex >= 0) {
          setCurrentTripInspectionTargetIndex(currentIndex);
          return;
        }

        logger.warn('openTripInspection: target missing from cached trip-inspection targets', {
          target,
          tripInspectionTargets,
        });
      }

      setTripInspectionTargets([target]);
      setCurrentTripInspectionTargetIndex(0);

      const selectedStopId = selectedStop.stopMeta?.stop.stop_id;
      if (selectedStopId === undefined) {
        logger.warn(
          'openTripInspection: selected stop metadata missing; skip trip-inspection target lookup',
        );
      } else {
        void repo
          .getTripInspectionTargets({
            tripLocator: target.tripLocator,
            serviceDate: target.serviceDate,
            stopId: selectedStopId,
          })
          .then((result) => {
            if (lookupRequestIdRef.current !== lookupRequestId) {
              return;
            }

            if (!result.success) {
              logger.warn(
                'openTripInspection: trip-inspection target lookup failed',
                result.error,
                target,
              );
              return;
            }

            if (result.data.length === 0) {
              setTripInspectionTargets([]);
              setCurrentTripInspectionTargetIndex(-1);
              logger.debug('openTripInspection: trip-inspection target lookup returned no targets');
              return;
            }

            const currentIndex = result.data.findIndex((candidate) =>
              isSameTripInspectionTarget(candidate, target),
            );
            if (currentIndex < 0) {
              setTripInspectionTargets([]);
              setCurrentTripInspectionTargetIndex(-1);
              logger.warn(
                'openTripInspection: current target missing from trip-inspection targets',
                {
                  target,
                  targets: result.data,
                },
              );
              return;
            }

            setTripInspectionTargets(result.data);
            setCurrentTripInspectionTargetIndex(currentIndex);

            logger.debug(
              `openTripInspection: trip-inspection targets=${result.data.length} currentIndex=${currentIndex} stopId=${selectedStopId}`,
              result.data,
            );
          });
      }
    },
    [repo, tripInspectionTargets],
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
