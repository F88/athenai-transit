import { useInfoLevel } from '@/hooks/use-info-level';
import { useThemeContrastAssessment } from '@/hooks/use-is-low-contrast-against-theme';
import { AbsoluteStopTime } from '@/components/absolute-stop-time';
import {
  getContrastAdjustedRouteColors,
  resolveRouteColors,
} from '@/domain/transit/color-resolver/route-colors';
import {
  LOW_CONTRAST_BADGE_MIN_RATIO,
  LOW_CONTRAST_TEXT_MIN_RATIO,
} from '@/domain/transit/color-resolver/contrast-thresholds';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { formatAbsoluteTime } from '../domain/transit/time';
import { getTimetableEntryAttributes } from '../domain/transit/timetable-entry-attributes';
import { getDisplayMinutes } from '../domain/transit/timetable-utils';
import type { InfoLevel } from '../types/app/settings';
import type { Agency } from '../types/app/transit';
import type { ContextualTimetableEntry } from '../types/app/transit-composed';
import { getContrastAwareAlphaSuffixes } from '@/utils/color/contrast-alpha-suffixes';
import { JourneyTimeBar } from './journey-time-bar';
import { BaseLabel } from './label/base-label';
import { TripPositionIndicator } from './label/trip-position-indicator';
import { RelativeTime } from './relative-time';
import { TripInfo } from './trip-info';
import { VerboseContextualTimetableEntry } from './verbose/verbose-contextual-timetable-entry';

interface StopTimeItemProps {
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
  isFirst,
  showRouteTypeIcon,
  infoLevel,
  dataLang,
  agency,
  showAgency = false,
  onInspectTrip,
}: StopTimeItemProps) {
  const info = useInfoLevel(infoLevel);
  const showVerbose = info.isVerboseEnabled;
  const attributes = getTimetableEntryAttributes(entry);
  const isTerminal = attributes.isTerminal;
  const time = minutesToDate(entry.serviceDate, getDisplayMinutes(entry));
  const diffMs = time.getTime() - now.getTime();
  const showRelativeTime = isFirst || diffMs <= 60 * 60 * 1000;

  const dt = formatAbsoluteTime(minutesToDate(entry.serviceDate, entry.schedule.departureMinutes));
  const at = formatAbsoluteTime(minutesToDate(entry.serviceDate, entry.schedule.arrivalMinutes));

  // Route colors
  const { route } = entry.routeDirection;
  const { routeColor } = resolveRouteColors(route, 'css-hex');
  const routeColorAssessment = useThemeContrastAssessment(routeColor, LOW_CONTRAST_BADGE_MIN_RATIO);

  // Adjust route colors for the position indicator and time bar based on contrast against the current theme.
  const contrastAdjustedRouteColors = getContrastAdjustedRouteColors(
    route,
    routeColorAssessment.isLowContrast,
    'css-hex',
  );
  const adjustedColorAssessment = useThemeContrastAssessment(
    contrastAdjustedRouteColors.color,
    LOW_CONTRAST_TEXT_MIN_RATIO,
  );

  // Compute accent colors for the position indicator based on the route color's contrast ratio.
  const { subtleAlphaSuffix, emphasisAlphaSuffix } = getContrastAwareAlphaSuffixes(
    adjustedColorAssessment.ratio,
  );
  const emphasisAccentColor = `${contrastAdjustedRouteColors.color}${emphasisAlphaSuffix}`;
  const subtleAccentColor = `${contrastAdjustedRouteColors.color}${subtleAlphaSuffix}`;

  return (
    <div className="border-b border-[#e0e0e0] py-1 last:border-b-0 dark:border-gray-700">
      <div className="flex gap-2">
        {onInspectTrip ? (
          <button
            type="button"
            className="flex min-h-8 w-14 shrink-0 cursor-pointer flex-col justify-center text-right leading-none"
            onClick={(e) => {
              e.stopPropagation();
              onInspectTrip(entry);
            }}
          >
            {showVerbose && (
              <>
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
                time={time}
                isTerminal={isTerminal}
                hidePrefix={diffMs > 90 * 60 * 1000}
              />
            )}
            <AbsoluteStopTime
              timeText={formatAbsoluteTime(time)}
              textColor={contrastAdjustedRouteColors.color}
              showDepartureMarker={false}
              showArrivalMarker={isTerminal}
            />
          </button>
        ) : (
          <div className="flex min-h-8 w-14 shrink-0 flex-col justify-center text-right leading-none">
            {showVerbose && (
              <>
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
                time={time}
                isTerminal={isTerminal}
                hidePrefix={diffMs > 90 * 60 * 1000}
              />
            )}
            <AbsoluteStopTime
              timeText={formatAbsoluteTime(time)}
              showArrivalMarker={isTerminal}
              showDepartureMarker={false}
              textColor={contrastAdjustedRouteColors.color}
            />
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col justify-center gap-0.5">
          {info.isNormalEnabled && (
            <div className="mb-0.5 flex min-w-0 items-center gap-1">
              <div className="min-w-0 flex-1">
                <TripPositionIndicator
                  stopIndex={entry.patternPosition.stopIndex}
                  totalStops={entry.patternPosition.totalStops}
                  size={info.isDetailedEnabled ? 'md' : info.isNormalEnabled ? 'xs' : 'xs'}
                  showEmoji={info.isVerboseEnabled}
                  showTrack={info.isNormalEnabled}
                  trackColor={subtleAccentColor}
                  dotColor={emphasisAccentColor}
                  currentColor={contrastAdjustedRouteColors.color}
                  trackBorderColor={contrastAdjustedRouteColors.color}
                  showTrackBorder={false}
                  showPositionLabel={info.isVerboseEnabled}
                  labelTextColor={contrastAdjustedRouteColors.textColor}
                  labelBgColor={contrastAdjustedRouteColors.color}
                />
              </div>
            </div>
          )}

          {info.isDetailedEnabled && (
            <JourneyTimeBar
              remainingMinutes={entry.insights?.remainingMinutes}
              totalMinutes={entry.insights?.totalMinutes}
              size={info.isDetailedEnabled ? 'md' : 'sm'}
              showEmoji={info.isVerboseEnabled}
              fillColor={contrastAdjustedRouteColors.color}
              unfilledColor={emphasisAccentColor}
              showRMins={info.isVerboseEnabled}
              showTMins={info.isVerboseEnabled}
              minsPosition="right"
              fillDirection="rtl"
              borderColor={contrastAdjustedRouteColors.color}
              minsTextColor={contrastAdjustedRouteColors.textColor}
              minsBgColor={contrastAdjustedRouteColors.color}
              showBorder={false}
            />
          )}

          <div className="min-w-0">
            <TripInfo
              size="md"
              routeDirection={entry.routeDirection}
              infoLevel={infoLevel}
              dataLang={dataLang}
              showRouteTypeIcon={showRouteTypeIcon}
              agency={agency}
              showAgency={showAgency}
              attributes={attributes}
            />
          </div>
        </div>
      </div>
      {showVerbose && <VerboseContextualTimetableEntry entry={entry} />}
    </div>
  );
}
