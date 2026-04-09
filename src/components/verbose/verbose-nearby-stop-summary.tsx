import type { ContextualTimetableEntry } from '../../types/app/transit-composed';

/**
 * Debug dump of NearbyStop-level summary information.
 *
 * Covers fields NOT dumped by child verbose components:
 * - Stop details → VerboseStopData
 * - Resolved names → VerboseStopDisplayNames
 * - Stats/Geo → VerboseStopMetrics
 * - Individual departures → VerboseContextualTimetableEntry
 *
 * This component dumps: UI state (isSelected, isAnchor, viewId),
 * boarding status (isBoardableOnServiceDay), and departures summary
 * (total, boardable, dropOffOnly counts).
 */
export function VerboseNearbyStopSummary({
  departures,
  isBoardableOnServiceDay,
  isSelected,
  isAnchor,
  viewId,
}: {
  departures: ContextualTimetableEntry[];
  isBoardableOnServiceDay: boolean;
  isSelected: boolean;
  isAnchor: boolean;
  viewId: string;
}) {
  const boardable = departures.filter(
    (e) => e.boarding.pickupType !== 1 && !e.patternPosition.isTerminal,
  ).length;
  const dropOffOnly = departures.length - boardable;

  return (
    <details className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [NearbyStop]
      </summary>
      <div className="mt-0.5">
        <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 text-[9px] whitespace-nowrap text-[#999] dark:border-gray-600 dark:text-gray-500">
          <span className="block">
            [state] selected={String(isSelected)} anchor={String(isAnchor)} view={viewId}
          </span>
          <span className="block">
            [boarding] isBoardableOnServiceDay={String(isBoardableOnServiceDay)}
          </span>
          <span className="block">
            [departures] entries={departures.length} boardable={boardable} dropOffOnly={dropOffOnly}
            {departures.length === 0
              ? ' (NO SERVICE)'
              : !isBoardableOnServiceDay
                ? ' (ALL DROP-OFF ONLY)'
                : ''}
          </span>
        </span>
      </div>
    </details>
  );
}
