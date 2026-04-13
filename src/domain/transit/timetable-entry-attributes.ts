import type { TimetableEntryAttributes } from '../../types/app/transit';
import type { TimetableEntry } from '../../types/app/transit-composed';

/**
 * Derive flat display attributes from a {@link TimetableEntry}.
 *
 * Maps `patternPosition` and `boarding` fields into the shape expected
 * by display components. All four flags are determined purely from the
 * entry itself — no external context (trip pattern, route, agency) is
 * required.
 */
export function getTimetableEntryAttributes(entry: TimetableEntry): TimetableEntryAttributes {
  return {
    isTerminal: entry.patternPosition.isTerminal,
    isOrigin: entry.patternPosition.isOrigin,
    isPickupUnavailable: entry.boarding.pickupType === 1,
    isDropOffUnavailable: entry.boarding.dropOffType === 1,
  };
}
