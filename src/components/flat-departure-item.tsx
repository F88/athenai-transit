import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import { formatAbsoluteTime } from '../domain/transit/time';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { getTimetableEntryAttributes } from '../domain/transit/timetable-entry-attributes';
import { getDisplayMinutes } from '../domain/transit/timetable-utils';
import { RelativeTime } from './relative-time';
import { TripInfo } from './trip-info';
import { VerboseContextualTimetableEntry } from './verbose/verbose-contextual-timetable-entry';
import { BaseLabel } from './label/base-label';
import { TripPositionIndicator } from './label/trip-position-indicator';
import { useInfoLevel } from '@/hooks/use-info-level';

interface FlatDepartureItemProps {
  /** The timetable entry to display. */
  entry: ContextualTimetableEntry;
  /** Current time for relative time calculation. */
  now: Date;
  /** Whether this is the first item in the list. */
  isFirst: boolean;
  /** Whether to show route_type emoji (e.g. when stop serves multiple route types). */
  showRouteTypeIcon: boolean;
  /** Current info verbosity level for route label formatting. */
  infoLevel: InfoLevel;
  /** Display language chain for translated GTFS/ODPT data names. */
  dataLang: readonly string[];
  /** Agency object for badge display at detailed+ info level. */
  agency?: Agency;
}

/**
 * A single row in the T1 (Stop) flat departure list.
 *
 * The first departure shows relative time ("あと5分"), subsequent
 * departures show absolute time ("14:30"). Route label is colored
 * with the route's designated color.
 */
export function FlatDepartureItem({
  entry,
  now,
  isFirst,
  showRouteTypeIcon,
  infoLevel,
  dataLang,
  agency,
}: FlatDepartureItemProps) {
  const info = useInfoLevel(infoLevel);
  const showVerbose = info.isVerboseEnabled;
  const { route } = entry.routeDirection;
  const bgColor = route.route_color ? `#${route.route_color}` : undefined;
  const attributes = getTimetableEntryAttributes(entry);
  const isTerminal = attributes.isTerminal;
  const departureTime = minutesToDate(entry.serviceDate, getDisplayMinutes(entry));
  const diffMs = departureTime.getTime() - now.getTime();
  const showRelativeTime = isFirst || diffMs <= 60 * 60 * 1000;

  const dt = formatAbsoluteTime(minutesToDate(entry.serviceDate, entry.schedule.departureMinutes));
  const at = formatAbsoluteTime(minutesToDate(entry.serviceDate, entry.schedule.arrivalMinutes));

  return (
    <div className="border-b border-[#e0e0e0] py-1 last:border-b-0 dark:border-gray-700">
      <div className="flex gap-2">
        <div className="flex min-h-8 w-14 shrink-0 flex-col justify-center text-right leading-none">
          {showVerbose && (
            <>
              <div className="mb-0.5 flex justify-end gap-0.5 whitespace-nowrap">
                <BaseLabel
                  size={'sm'}
                  value={`${entry.patternPosition.stopIndex + 1} / ${entry.patternPosition.totalStops} stops`}
                  className="bg-gray-500 whitespace-nowrap text-white"
                />
                {/* <LabelCountBadge
                  size="sm"
                  label={`${String(entry.patternPosition.totalStops)} stops`}
                  count={entry.patternPosition.stopIndex + 1}
                  labelBg="#666"
                  labelFg="#fff"
                  countBg="#eee"
                  countFg="#333"
                  frameColor="#666"
                /> */}
              </div>
              <div className="mb-0.5 flex justify-end gap-0.5 whitespace-nowrap">
                <BaseLabel
                  size={'xs'}
                  value={at}
                  className="bg-gray-500 whitespace-nowrap text-white"
                />
                <BaseLabel
                  size={'xs'}
                  value={dt}
                  className="bg-blue-500 whitespace-nowrap text-white"
                />
              </div>
            </>
          )}
          {showRelativeTime && (
            <RelativeTime
              now={now}
              departureTime={departureTime}
              isTerminal={isTerminal}
              // Hide prefix for departures >90min to save space.
              hidePrefix={diffMs > 90 * 60 * 1000}
            />
          )}
          {/* Absolute time — always shown alongside relative for precise reference */}
          <div
            className="text-base text-[#333] dark:text-gray-100"
            style={bgColor ? { color: bgColor } : undefined}
          >
            {formatAbsoluteTime(departureTime)}
            {isTerminal && <span className="text-[10px] font-normal opacity-70">着</span>}
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-0.5">
          {/* Trip Position Indicator */}
          <TripPositionIndicator
            stopIndex={entry.patternPosition.stopIndex}
            totalStops={entry.patternPosition.totalStops}
            // size="md"
            size={info.isDetailedEnabled ? 'md' : info.isNormalEnabled ? 'xs' : 'xs'}
            // size="xs"
            showTrack={info.isNormalEnabled}
            infoLevel={infoLevel}
            trackColor={`#${route.route_color}20`}
            dotColor={`#${route.route_color}50`}
            currentColor={`#${route.route_color}`}
          />
          {/* <TripPositionIndicator
            stopIndex={entry.patternPosition.stopIndex}
            totalStops={entry.patternPosition.totalStops}
            // size="md"
            size="sm"
            // size="xs"
            // showTrack={false}
            infoLevel={infoLevel}
            trackColor={`#${route.route_color}20`}
            dotColor={`#${route.route_color}50`}
            currentColor={`#${route.route_color}`}
          /> */}
          {/* <TripPositionIndicator
            stopIndex={entry.patternPosition.stopIndex}
            totalStops={entry.patternPosition.totalStops}
            // size="md"
            size="xs"
            // size="xs"
            // showTrack={false}
            infoLevel={infoLevel}
            trackColor={`#${route.route_color}20`}
            dotColor={`#${route.route_color}50`}
            currentColor={`#${route.route_color}`}
          /> */}
          {showVerbose && (
            <>
              <div className="text-[10px] text-gray-500">
                {entry.insights?.remainingMinutes}/ {entry.insights?.totalMinutes}
              </div>
              {/* <div className="text-[10px] text-gray-500">{entry.insights?.freq} trips</div> */}
            </>
          )}
          {/* Trip Info */}
          <TripInfo
            routeDirection={entry.routeDirection}
            infoLevel={infoLevel}
            dataLang={dataLang}
            showRouteTypeIcon={showRouteTypeIcon}
            agency={agency}
            attributes={attributes}
          />
        </div>
      </div>
      {/* Verbose data */}
      {showVerbose && (
        <VerboseContextualTimetableEntry
          //
          entry={entry}
          // disableVerbose={true}
        />
      )}
    </div>
  );
}
