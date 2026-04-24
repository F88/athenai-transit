import { useInfoLevel } from '@/hooks/use-info-level';
import { getTimetableEntryAttributes } from '../domain/transit/timetable-entry-attributes';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import { StopTimeDetailInfo } from './stop-time-detail-info';
import { StopTimeTimeInfo } from './stop-time-time-info';
import { VerboseContextualTimetableEntry } from './verbose/verbose-contextual-timetable-entry';

interface StopTimeItemProps {
  /** The timetable entry to display. */
  entry: ContextualTimetableEntry;
  /** Current time for relative time calculation. */
  now: Date;
  /** Whether to render the arrival absolute time. */
  showArrivalTime: boolean;
  /** Whether to render the departure absolute time. */
  showDepartureTime: boolean;
  /** Whether to hide arrival when both times are shown and the formatted values match. */
  collapseArrivalWhenSameAsDeparture: boolean;
  /** Force relative-time display even when the entry is far in the future. */
  forceShowRelativeTime: boolean;
  /** Whether to show route_type emoji (e.g. when stop serves multiple route types). */
  showRouteTypeIcon: boolean;
  /** Current info verbosity level for route label formatting. */
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  /** Agency object for badge display at detailed+ info level. */
  agency?: Agency;
  /**
   * Whether to render the agency badge inside `TripInfo`. Forwarded
   * verbatim. Callers that know the stop's full agency set should
   * compute this as `agencies.length > 1` so the badge only appears
   * when it actually disambiguates between multiple operators.
   *
   * @default false
   */
  showAgency?: boolean;
  /** Optional callback for inspecting this concrete trip entry. */
  onInspectTrip?: (entry: ContextualTimetableEntry) => void;
}

/**
 * A single row in the T1 (Stop) flat stop time list.
 *
 * The first stop time shows relative time ("あと5分"), subsequent
 * stop times show absolute time ("14:30"). Route label is colored
 * with the route's designated color.
 */
export function StopTimeItem({
  entry,
  now,
  showArrivalTime,
  showDepartureTime,
  collapseArrivalWhenSameAsDeparture,
  forceShowRelativeTime,
  showRouteTypeIcon,
  infoLevel,
  dataLangs,
  agency,
  showAgency = false,
  onInspectTrip,
}: StopTimeItemProps) {
  const info = useInfoLevel(infoLevel);
  const showVerbose = info.isVerboseEnabled;
  const attributes = getTimetableEntryAttributes(entry);

  return (
    <div className="border-b border-[#e0e0e0] py-1 last:border-b-0 dark:border-gray-700">
      <div className="flex gap-2">
        <StopTimeTimeInfo
          entry={entry}
          now={now}
          showArrivalTime={showArrivalTime}
          showDepartureTime={showDepartureTime}
          collapseArrivalWhenSameAsDeparture={collapseArrivalWhenSameAsDeparture}
          forceShowRelativeTime={forceShowRelativeTime}
          showVerbose={showVerbose}
          onInspectTrip={onInspectTrip}
        />

        <StopTimeDetailInfo
          entry={entry}
          infoLevel={infoLevel}
          dataLangs={dataLangs}
          showRouteTypeIcon={showRouteTypeIcon}
          agency={agency}
          showAgency={showAgency}
          attributes={attributes}
        />
      </div>
      {showVerbose && <VerboseContextualTimetableEntry entry={entry} />}
    </div>
  );
}
