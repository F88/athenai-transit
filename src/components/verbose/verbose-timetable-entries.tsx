import { getEffectiveHeadsign } from '../../domain/transit/get-effective-headsign';
import type { TimetableEntry } from '../../types/app/transit-composed';

/**
 * Render a one-line visual indicator of the current stop position within
 * the trip pattern. Each `.` is one stop, `*` highlights the current stop.
 *
 * Example for a 39-stop pattern with current at stopIndex=28:
 *   ............................*..........
 *
 * Useful for spotting 6-shape and circular routes at a glance, where the
 * same stop_id appears at multiple positions (Issue #47).
 */
function renderPatternBar(stopIndex: number, totalStops: number): string {
  if (totalStops <= 0) {
    return '';
  }
  const chars: string[] = [];
  for (let i = 0; i < totalStops; i++) {
    chars.push(i === stopIndex ? '*' : '.');
  }
  return chars.join('');
}

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

  const tripHeadsign = entry.routeDirection.tripHeadsign;
  const stopHeadsign = entry.routeDirection.stopHeadsign;

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
        [Headsign] effective=&quot;{getEffectiveHeadsign(entry.routeDirection)}&quot; trip=&quot;
        {entry.routeDirection.tripHeadsign.name}&quot;
        {entry.routeDirection.stopHeadsign != null &&
          ` stop="${entry.routeDirection.stopHeadsign.name}"`}
      </span>
      <span className="block">
        [TripHeadSign]{' '}
        {Object.keys(tripHeadsign.names).length > 0
          ? Object.entries(tripHeadsign.names)
              .map(([k, v]) => `${k}=${v}`)
              .join(' ')
          : '(none)'}
      </span>
      <span className="block">
        [StopHeadSign]{' '}
        {stopHeadsign == null
          ? '(undefined)'
          : `${
              Object.keys(stopHeadsign.names).length > 0
                ? Object.entries(stopHeadsign.names)
                    .map(([k, v]) => `${k}=${v}`)
                    .join(' ')
                : '(none)'
            }`}
      </span>

      <span className="block">
        [boarding] pt={entry.boarding.pickupType} dt={entry.boarding.dropOffType}
      </span>
      <span className="block">
        [pattern] si={entry.patternPosition.stopIndex} [{entry.patternPosition.stopIndex + 1}/
        {entry.patternPosition.totalStops}]{entry.patternPosition.isTerminal && ' TERM'}
        {entry.patternPosition.isOrigin && ' ORIG'}
      </span>
      <span className="block pl-2 font-mono text-xs">
        {renderPatternBar(entry.patternPosition.stopIndex, entry.patternPosition.totalStops)}
      </span>
      <span className="block">
        [insights]{' '}
        {entry.insights ? `remainingMinutes=${entry.insights.remainingMinutes}` : '(none)'}
      </span>
    </>
  );
}
