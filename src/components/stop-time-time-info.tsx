import { AbsoluteStopTime } from '@/components/absolute-stop-time';
import { LOW_CONTRAST_BADGE_MIN_RATIO } from '@/domain/transit/color-resolver/contrast-thresholds';
import {
  getContrastAdjustedRouteColors,
  resolveRouteColors,
} from '@/domain/transit/color-resolver/route-colors';
import { useThemeContrastAssessment } from '@/hooks/use-is-low-contrast-against-theme';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { formatAbsoluteTime } from '../domain/transit/time';
import type {
  ContextualTimetableEntry,
  TripInspectionTarget,
  WithServiceDate,
} from '../types/app/transit-composed';
import { BaseLabel } from './label/base-label';
import { RelativeTime } from './relative-time';
import type { ExtendedDisplaySize } from './shared/display-size';

/**
 * Proposed future props for `StopTimeTimeInfo` after caller migration.
 *
 * The current component still accepts `StopTimeTimeInfoProps` so existing call
 * sites remain unchanged. This interface captures the slimmer API direction:
 * render from schedule + service date + text appearance, and keep trip
 * inspection wiring as an explicit optional feature.
 */
export type StopTimeTimeTextSize = ExtendedDisplaySize;

/**
 * Appearance options for rendered time text.
 *
 * This groups appearance controls that directly affect color treatment without
 * expanding the top-level props surface every time a new text styling
 * requirement appears.
 */
export interface StopTimeTimeTextAppearance {
  /** Resolved text color used for rendered time values. */
  color?: string;
  /** Font weight applied to rendered time values. */
  weight?: 'normal' | 'bold';
  /** Optional utility classes for exceptional text styling adjustments. */
  className?: string;
}

export interface StopTimeTimeInfoNextProps extends WithServiceDate {
  /** Arrival minutes from midnight of the service day. */
  arrivalMinutes: number;
  /** Departure minutes from midnight of the service day. */
  departureMinutes: number;
  /** Current wall-clock reference time for relative display. */
  now: Date;
  /** Visual size preset for rendered time text. */
  size?: StopTimeTimeTextSize;
  /** Optional appearance overrides for rendered time text. */
  textAppearance?: StopTimeTimeTextAppearance;
  /** Whether to render the arrival absolute time. */
  showArrivalTime: boolean;
  /** Whether to render the departure absolute time. */
  showDepartureTime: boolean;
  /** Whether to hide arrival when arrival and departure render the same value. */
  collapseArrivalWhenSameAsDeparture: boolean;
  /** Force relative-time display even when the entry is far in the future. */
  forceShowRelativeTime: boolean;
  /** Whether to render verbose arrival/departure badges above the time. */
  showVerbose: boolean;
  /** Optional payload describing which trip inspection target should open. */
  inspectTarget?: TripInspectionTarget;
  /** Optional callback that opens trip inspection for the provided target. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

interface StopTimeTimeInfoProps {
  entry: ContextualTimetableEntry;
  now: Date;
  size?: StopTimeTimeTextSize;
  showArrivalTime: boolean;
  showDepartureTime: boolean;
  collapseArrivalWhenSameAsDeparture: boolean;
  forceShowRelativeTime: boolean;
  showVerbose: boolean;
  onInspectTrip?: (entry: ContextualTimetableEntry) => void;
}

export function StopTimeTimeInfo({
  entry,
  now,
  size = 'md',
  showArrivalTime,
  showDepartureTime,
  collapseArrivalWhenSameAsDeparture,
  forceShowRelativeTime,
  showVerbose,
  onInspectTrip,
}: StopTimeTimeInfoProps) {
  const primaryMinutes = showDepartureTime
    ? entry.schedule.departureMinutes
    : entry.schedule.arrivalMinutes;
  const time = minutesToDate(entry.serviceDate, primaryMinutes);
  const diffMs = time.getTime() - now.getTime();
  const showRelativeTime = forceShowRelativeTime || diffMs <= 60 * 60 * 1000;
  const dt = formatAbsoluteTime(minutesToDate(entry.serviceDate, entry.schedule.departureMinutes));
  const at = formatAbsoluteTime(minutesToDate(entry.serviceDate, entry.schedule.arrivalMinutes));
  const shouldCollapseArrival =
    collapseArrivalWhenSameAsDeparture && showArrivalTime && showDepartureTime && at === dt;
  const shouldShowArrivalAbsolute = showArrivalTime && !shouldCollapseArrival;
  const shouldShowDepartureAbsolute = showDepartureTime;
  const shouldShowDepartureMarker = shouldShowArrivalAbsolute && shouldShowDepartureAbsolute;
  const timeSize: ExtendedDisplaySize = size;

  const { route } = entry.routeDirection;
  const { routeColor } = resolveRouteColors(route, 'css-hex');
  const routeColorAssessment = useThemeContrastAssessment(routeColor, LOW_CONTRAST_BADGE_MIN_RATIO);
  const contrastAdjustedRouteColors = getContrastAdjustedRouteColors(
    route,
    routeColorAssessment.isLowContrast,
    'css-hex',
  );

  const timeVariants = [
    {
      key: 'arrival',
      timeText: at,
      badgeClassName: 'bg-gray-500 whitespace-nowrap text-white',
      showInAbsolute: shouldShowArrivalAbsolute,
      showDepartureMarker: false,
      showArrivalMarker: shouldShowArrivalAbsolute,
    },
    {
      key: 'departure',
      timeText: dt,
      badgeClassName: 'bg-blue-500 whitespace-nowrap text-white',
      showInAbsolute: shouldShowDepartureAbsolute,
      showDepartureMarker: shouldShowDepartureMarker,
      showArrivalMarker: false,
    },
  ] as const;

  const content = (
    <>
      {showVerbose && (
        <div className="mb-0.5 flex justify-end gap-0.5 whitespace-nowrap">
          {timeVariants.map((variant) => (
            <BaseLabel
              key={variant.key}
              size={'xs'}
              value={variant.timeText}
              className={variant.badgeClassName}
            />
          ))}
        </div>
      )}
      {(showRelativeTime || true) && (
        <RelativeTime
          time={time}
          now={now}
          size={timeSize}
          showPastTime={true}
          hidePrefix={diffMs > 90 * 60 * 1000}
        />
      )}
      {timeVariants.map((variant) => {
        if (!variant.showInAbsolute) {
          return null;
        }

        return (
          <AbsoluteStopTime
            key={variant.key}
            timeText={variant.timeText}
            textColor={contrastAdjustedRouteColors.color}
            size={timeSize}
            showDepartureMarker={variant.showDepartureMarker}
            showArrivalMarker={variant.showArrivalMarker}
          />
        );
      })}
    </>
  );

  if (onInspectTrip === undefined) {
    return (
      <div className="flex min-h-8 w-14 shrink-0 flex-col justify-center text-right leading-none">
        {content}
      </div>
    );
  }

  return (
    <button
      type="button"
      className="flex min-h-8 w-14 shrink-0 cursor-pointer flex-col justify-center text-right leading-none"
      onClick={(e) => {
        e.stopPropagation();
        onInspectTrip(entry);
      }}
    >
      {content}
    </button>
  );
}
