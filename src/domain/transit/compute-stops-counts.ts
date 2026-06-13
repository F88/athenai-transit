import type { StopsCounts } from '../../types/app/stop';
import type { TimetableEntry } from '../../types/app/transit-composed';

import { isBoardableForPassenger } from './timetable-entry-for-passenger';

interface StopTimesCarrier {
  stopTimes: readonly TimetableEntry[];
}

/**
 * Whether at least one entry is boardable, judged by {@link isBoardableForPassenger}
 * -- the same predicate the "boardable only" filter uses
 * (`filterByStopEventBoardability`), so `boardableCount` always agrees
 * with what that filter actually keeps.
 */
function hasBoardableEntry(entries: readonly TimetableEntry[]): boolean {
  return entries.some(isBoardableForPassenger);
}

export function computeStopsCounts<T extends StopTimesCarrier>(items: readonly T[]): StopsCounts {
  return items.reduce<StopsCounts>(
    (counts, item) => {
      counts.total += 1;

      if (item.stopTimes.length > 0) {
        counts.nonEmpty += 1;
      }
      if (item.stopTimes.some((entry) => entry.patternPosition.isFirstStop)) {
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
