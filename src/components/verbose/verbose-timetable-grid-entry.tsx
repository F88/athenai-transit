import type { InfoLevel } from '../../types/app/settings';
import type { TimetableEntry } from '../../types/app/transit-composed';
import { VerboseTimetableEntry } from './verbose-timetable-entries';

/**
 * Debug dump of TimetableGridEntry props and entry data.
 * Includes its own details/summary for collapsed display.
 * Only rendered in verbose info level.
 */
export function VerboseTimetableGridEntry({
  entry,
  displayMinutes,
  showHeadsign,
  headsignMaxLength,
  infoLevel,
  isDisplayTerminal,
  isDisplayOrigin,
  isDisplayPickupUnavailable,
  isDisplayDropOffUnavailable,
  defaultOpen = false,
}: {
  entry: TimetableEntry;
  displayMinutes: number;
  showHeadsign: boolean;
  headsignMaxLength?: number;
  infoLevel: InfoLevel;
  isDisplayTerminal: boolean;
  isDisplayOrigin: boolean;
  isDisplayPickupUnavailable: boolean;
  isDisplayDropOffUnavailable: boolean;
  /** Start with details expanded. @default false */
  defaultOpen?: boolean;
}) {
  return (
    <details open={defaultOpen} className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [GridEntry]
      </summary>
      <div className="mt-0.5 space-y-0.5">
        <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 whitespace-nowrap dark:border-gray-600">
          <span className="block">
            [display] minutes={displayMinutes} showHeadsign={String(showHeadsign)}
            {headsignMaxLength != null && ` maxLength=${headsignMaxLength}`}
            {` infoLevel=${infoLevel}`}
          </span>
          <span className="block">
            [flags] terminal={String(isDisplayTerminal)} origin={String(isDisplayOrigin)}
            {` pickupUnavail=${String(isDisplayPickupUnavailable)}`}
            {` dropOffUnavail=${String(isDisplayDropOffUnavailable)}`}
          </span>
        </span>
        <span className="block overflow-x-auto rounded border border-dashed border-gray-300 p-1 whitespace-nowrap dark:border-gray-600">
          <VerboseTimetableEntry entry={entry} />
        </span>
      </div>
    </details>
  );
}
