import type { ContextualTimetableEntry } from '../../types/app/transit-composed';
import { formatDateKey } from '../../domain/transit/calendar-utils';

interface VerboseContextualTimetableEntryProps {
  entry: ContextualTimetableEntry;
  /** Suppress verbose rendering. Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
  /** Start with details expanded. @default false */
  defaultOpen?: boolean;
}

/**
 * Debug dump of ContextualTimetableEntry fields.
 * Includes its own details/summary for collapsed display.
 * Only rendered in verbose info level.
 */
export function VerboseContextualTimetableEntry({
  entry,
  disableVerbose = false,
  defaultOpen = false,
}: VerboseContextualTimetableEntryProps) {
  if (disableVerbose) {
    return null;
  }

  return (
    <details open={defaultOpen} className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Departure]
      </summary>
      <div className="mt-0.5">
        <EntryDump entry={entry} />
      </div>
    </details>
  );
}

interface VerboseContextualTimetableEntriesProps {
  entries: ContextualTimetableEntry[];
  /** Suppress verbose rendering. Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
}

/**
 * Debug dump of multiple ContextualTimetableEntry items.
 * Includes its own details/summary for collapsed display.
 */
export function VerboseContextualTimetableEntries({
  entries,
  disableVerbose = false,
}: VerboseContextualTimetableEntriesProps) {
  if (disableVerbose) {
    return null;
  }

  return (
    <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [Departures ({entries.length})]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        {entries.map((e, i) => (
          <VerboseContextualTimetableEntry key={i} entry={e} defaultOpen />
        ))}
      </div>
    </details>
  );
}

/** Shared dump rendering for a single ContextualTimetableEntry. */
function EntryDump({ entry }: { entry: ContextualTimetableEntry }) {
  return (
    <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
      <span className="block">
        [schedule] d={entry.schedule.departureMinutes} a={entry.schedule.arrivalMinutes}
        {` sd=${formatDateKey(entry.serviceDate)}`}
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
    </span>
  );
}
