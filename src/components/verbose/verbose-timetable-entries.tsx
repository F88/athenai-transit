import type { TimetableEntry } from '../../types/app/transit-composed';
import { getEffectiveHeadsign } from '../../domain/transit/get-effective-headsign';

interface VerboseTimetableEntryProps {
  /** The timetable entry to dump. */
  entry: TimetableEntry;
  /** Suppress verbose rendering. Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
}

/**
 * Debug dump of a single TimetableEntry (text format).
 * Renders all fields except serviceDate (which is on ContextualTimetableEntry).
 * Used as a building block by {@link VerboseContextualTimetableEntry}.
 */
export function VerboseTimetableEntry({
  entry,
  disableVerbose = false,
}: VerboseTimetableEntryProps) {
  if (disableVerbose) {
    return null;
  }

  return (
    <>
      <span className="block">
        [schedule] d={entry.schedule.departureMinutes} a={entry.schedule.arrivalMinutes}
      </span>
      <span className="block">
        [route] id={entry.routeDirection.route.route_id} type=
        {entry.routeDirection.route.route_type}
        {entry.routeDirection.direction !== undefined && ` dir=${entry.routeDirection.direction}`}
      </span>
      <span className="block">
        [headsign] effective=&quot;{getEffectiveHeadsign(entry.routeDirection)}&quot; trip=&quot;
        {entry.routeDirection.tripHeadsign.name}&quot;
        {entry.routeDirection.stopHeadsign != null &&
          ` stop="${entry.routeDirection.stopHeadsign.name}"`}
      </span>
      <span className="block">
        [headsign-names] trip=
        {Object.keys(entry.routeDirection.tripHeadsign.names).length > 0
          ? Object.entries(entry.routeDirection.tripHeadsign.names)
              .map(([k, v]) => `${k}=${v}`)
              .join(' ')
          : '(none)'}
        {entry.routeDirection.stopHeadsign != null &&
          ` stop=${
            Object.keys(entry.routeDirection.stopHeadsign.names).length > 0
              ? Object.entries(entry.routeDirection.stopHeadsign.names)
                  .map(([k, v]) => `${k}=${v}`)
                  .join(' ')
              : '(none)'
          }`}
      </span>
      <span className="block">
        [boarding] pt={entry.boarding.pickupType} dt={entry.boarding.dropOffType}
      </span>
      <span className="block">
        [pattern] [{entry.patternPosition.stopIndex + 1}/{entry.patternPosition.totalStops}]
        {entry.patternPosition.isTerminal && ' TERM'}
        {entry.patternPosition.isOrigin && ' ORIG'}
      </span>
      <span className="block">
        [insights]{' '}
        {entry.insights ? `remainingMinutes=${entry.insights.remainingMinutes}` : '(none)'}
      </span>
    </>
  );
}
