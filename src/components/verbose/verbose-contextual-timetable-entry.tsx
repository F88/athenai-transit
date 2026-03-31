import type { ContextualTimetableEntry } from '../../types/app/transit-composed';
import { formatDateKey } from '../../domain/transit/calendar-utils';
import { VerboseTimetableEntry } from './verbose-timetable-entries';

interface VerboseContextualTimetableEntryProps {
  entry: ContextualTimetableEntry;
  /** Suppress verbose rendering. Use in non-interactive contexts like tooltips. */
  disableVerbose?: boolean;
  /** Start with details expanded. @default false */
  defaultOpen?: boolean;
}

/**
 * Debug dump of ContextualTimetableEntry fields.
 * Composes {@link VerboseTimetableEntry} for TimetableEntry fields
 * and adds serviceDate.
 * Includes its own details/summary for collapsed display.
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
        <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
          <span className="block">[serviceDate] {formatDateKey(entry.serviceDate)}</span>
          <VerboseTimetableEntry entry={entry} />
        </span>
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
