import type { StopsCounts } from '../../types/app/stop';
import type { TimetableEntry } from '../../types/app/transit-composed';

interface StopTimesCarrier {
  stopTimes: readonly TimetableEntry[];
}

function hasBoardableEntry(entries: readonly TimetableEntry[]): boolean {
  return entries.some(
    (entry) =>
      entry.boarding.pickupType === 0 &&
      (entry.patternPosition.isOrigin || !entry.patternPosition.isTerminal),
  );
}

export function computeStopsCounts<T extends StopTimesCarrier>(items: readonly T[]): StopsCounts {
  return items.reduce<StopsCounts>(
    (counts, item) => {
      counts.total += 1;

      if (item.stopTimes.length > 0) {
        counts.nonEmpty += 1;
      }
      if (item.stopTimes.some((entry) => entry.patternPosition.isOrigin)) {
        counts.originCount += 1;
      }
      if (hasBoardableEntry(item.stopTimes)) {
        counts.boardableCount += 1;
      }

      return counts;
    },
    {
      total: 0,
      nonEmpty: 0,
      originCount: 0,
      boardableCount: 0,
    },
  );
}
