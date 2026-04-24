import { DEFAULT_AGENCY_LANG } from '../../config/transit-defaults';
import { getHeadsignDisplayNames } from '../../domain/transit/get-headsign-display-names';
import { getRouteDisplayNames } from '../../domain/transit/get-route-display-names';
import type { InfoLevel } from '../../types/app/settings';
import type { TimetableEntry } from '../../types/app/transit-composed';
import { VerboseHeadsign } from './verbose-headsign';
import { VerboseRoute } from './verbose-route';

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
  timetableEntry: TimetableEntry;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLangs: readonly string[];
  /** Agency languages for subNames sort priority. */
  agencyLang?: readonly string[];
  /** Maximum characters for headsign truncation. */
  headsignMaxLength?: number;
  /** Info level used when formatting route labels. */
  infoLevel: InfoLevel;
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
  timetableEntry,
  dataLangs,
  agencyLang = DEFAULT_AGENCY_LANG,
  headsignMaxLength,
  infoLevel,
  disableVerbose = false,
  defaultOpen = false,
}: VerboseTimetableEntryProps) {
  if (disableVerbose) {
    return null;
  }

  const routeNames = getRouteDisplayNames(
    timetableEntry.routeDirection.route,
    dataLangs,
    agencyLang,
  );

  const headsignNames = getHeadsignDisplayNames(
    timetableEntry.routeDirection,
    dataLangs,
    agencyLang,
    'stop',
  );
  const headsignLabel =
    headsignMaxLength != null && headsignNames.resolved.name.length > headsignMaxLength
      ? headsignNames.resolved.name.slice(0, headsignMaxLength)
      : headsignNames.resolved.name;

  return (
    <details open={defaultOpen} className="text-[9px] font-normal text-[#999] dark:text-gray-500">
      <summary className="cursor-pointer select-none" onClick={(e) => e.stopPropagation()}>
        [TimetableEntry]
      </summary>
      <div className="border-app-neutral mt-0.5 rounded border border-dashed p-1">
        <span className="border-app-neutral block overflow-x-auto rounded border border-dashed p-1 whitespace-nowrap">
          <span className="block">
            [schedule] d={timetableEntry.schedule.departureMinutes} a=
            {timetableEntry.schedule.arrivalMinutes}
          </span>
          <span className="block">
            [boarding] pt={timetableEntry.boarding.pickupType} dt=
            {timetableEntry.boarding.dropOffType}
          </span>
          <span className="block">
            [pattern] si={timetableEntry.patternPosition.stopIndex} [
            {timetableEntry.patternPosition.stopIndex + 1}/
            {timetableEntry.patternPosition.totalStops}]
            {timetableEntry.patternPosition.isTerminal && ' TERM'}
            {timetableEntry.patternPosition.isOrigin && ' ORIG'}
          </span>
          <span className="block pl-2 font-mono text-xs">
            {renderPatternBar(
              timetableEntry.patternPosition.stopIndex,
              timetableEntry.patternPosition.totalStops,
            )}
          </span>
          <span className="block">
            [insights]{' '}
            {timetableEntry.insights
              ? `remainingMinutes=${timetableEntry.insights.remainingMinutes}`
              : '(none)'}
          </span>
        </span>

        <VerboseRoute
          route={timetableEntry.routeDirection.route}
          names={routeNames}
          infoLevel={infoLevel}
          defaultOpen={defaultOpen}
        />

        {/* Headsign  */}
        <VerboseHeadsign
          routeDirection={timetableEntry.routeDirection}
          names={headsignNames}
          label={headsignLabel}
          maxLength={headsignMaxLength}
          defaultOpen={defaultOpen}
        />
      </div>
    </details>
  );
}
