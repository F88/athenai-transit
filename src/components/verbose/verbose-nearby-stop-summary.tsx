import type { ContextualTimetableEntry } from '../../types/app/transit-composed';
import type { StopServiceState } from '../../types/app/transit';

/**
 * Debug dump of NearbyStop-level summary information.
 *
 * Covers fields NOT dumped by child verbose components:
 * - Stop details → VerboseStopData
 * - Resolved names → VerboseStopDisplayNames
 * - Stats/Geo → VerboseStopMetrics
 * - Individual stop times → VerboseContextualTimetableEntry
 *
 * This component dumps: UI state (isSelected, isAnchor, viewId),
 * stop service state, and stop times summary
 * (total, boardable, dropOffOnly counts).
 */
export function VerboseNearbyStopSummary({
  stopTimes,
  stopServiceState,
  isSelected,
  isAnchor,
  viewId,
}: {
  stopTimes: ContextualTimetableEntry[];
  stopServiceState: StopServiceState;
  isSelected: boolean;
  isAnchor: boolean;
  viewId: string;
}) {
  const boardable = stopTimes.filter(
    (e) => e.boarding.pickupType !== 1 && !e.patternPosition.isTerminal,
  ).length;
  const dropOffOnly = stopTimes.length - boardable;

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
          <span className="block">[service] stopServiceState={stopServiceState}</span>
          <span className="block">
            [stop times] entries={stopTimes.length} boardable={boardable} dropOffOnly={dropOffOnly}
            {stopTimes.length === 0
              ? ' (NO SERVICE)'
              : stopServiceState === 'drop-off-only'
                ? ' (ALL DROP-OFF ONLY)'
                : ''}
          </span>
        </span>
      </div>
    </details>
  );
}
