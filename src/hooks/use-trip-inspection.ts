import { useCallback, useState } from 'react';
import { createLogger } from '../lib/logger';
import type { TransitRepository } from '../repositories/transit-repository';
import type { ContextualTimetableEntry, SelectedTripSnapshot } from '../types/app/transit-composed';
import {
  buildTripInspectionStopsLog,
  buildTripInspectionSummaryLog,
} from '../utils/trip-inspection-log';

const logger = createLogger('TripInspection');

interface UseTripInspectionReturn {
  tripInspectionSnapshot: SelectedTripSnapshot | null;
  openTripInspection: (entry: ContextualTimetableEntry) => void;
  closeTripInspection: () => void;
}

export function useTripInspection(repo: TransitRepository): UseTripInspectionReturn {
  const [tripInspectionSnapshot, setTripInspectionSnapshot] = useState<SelectedTripSnapshot | null>(
    null,
  );

  const closeTripInspection = useCallback(() => {
    setTripInspectionSnapshot(null);
  }, []);

  const openTripInspection = useCallback(
    (entry: ContextualTimetableEntry) => {
      const trip = repo.getTripSnapshot(entry.tripLocator, entry.serviceDate);
      if (!trip.success) {
        logger.warn('openTripInspection: failed to resolve trip snapshot', trip.error);
        return;
      }

      const selectedStop = trip.data.stopTimes.find(
        (stop) => stop.timetableEntry.patternPosition.stopIndex === entry.patternPosition.stopIndex,
      );
      if (!selectedStop) {
        logger.warn(
          `openTripInspection: selected stop index ${entry.patternPosition.stopIndex} is missing from reconstructed trip snapshot`,
        );
        return;
      }

      const snapshot: SelectedTripSnapshot = {
        ...trip.data,
        currentStopIndex: entry.patternPosition.stopIndex,
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
