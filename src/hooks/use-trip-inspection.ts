import { useCallback, useState } from 'react';
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
  openTripInspection: (target: TripInspectionTarget) => void;
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

  const closeTripInspection = useCallback(() => {
    setTripInspectionSnapshot(null);
  }, []);

  const openTripInspection = useCallback(
    (target: TripInspectionTarget) => {
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
    },
    [repo],
  );

  return {
    tripInspectionSnapshot,
    openTripInspection,
    closeTripInspection,
  };
}
