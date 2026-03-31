import type { TimetableEntry } from '../../types/app/transit-composed';

interface VerboseTimetableEntryProps {
  /** The timetable entry to dump. */
  entry: TimetableEntry;
  /** Suppress verbose rendering. Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
  /** Start with details expanded. @default false */
  defaultOpen?: boolean;
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
        [headsign] &quot;{entry.routeDirection.headsign}&quot;
        {Object.keys(entry.routeDirection.headsign_names).length > 0
          ? ` names=${Object.entries(entry.routeDirection.headsign_names)
              .map(([k, v]) => `${k}=${v}`)
              .join(' ')}`
          : ' names=(none)'}
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
