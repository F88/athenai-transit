import { AbsoluteStopTime } from '@/components/absolute-stop-time';
import { minutesToDate } from '../domain/transit/calendar-utils';
import { shouldCollapseArrival } from '../domain/transit/stop-time-display';
import { formatAbsoluteTime } from '../domain/transit/time';
import type { TripInspectionTarget, WithServiceDate } from '../types/app/transit-composed';
import { cn } from '../lib/utils';
import { RelativeTime } from './relative-time';
import type { ExtendedDisplaySize } from './shared/display-size';

/**
 * Public display-size alias for stop-time rendering.
 *
 * `StopTimeTimeInfo` now renders from explicit schedule + service-date props
 * rather than a full timetable entry object.
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

/** Horizontal alignment of rendered time text. */
export type StopTimeTimeInfoAlign = 'left' | 'center' | 'right';

export interface StopTimeTimeInfoProps extends WithServiceDate {
  /** Arrival minutes from midnight of the service day. */
  arrivalMinutes: number;
  /** Departure minutes from midnight of the service day. */
  departureMinutes: number;
  /** Current wall-clock reference time for relative display. */
  now: Date;
  /** Visual size preset for rendered time text. */
  size: StopTimeTimeTextSize;
  /** Horizontal alignment for the time text. @default 'right' */
  align?: StopTimeTimeInfoAlign;
  /** Optional appearance overrides for rendered time text. */
  textAppearance?: StopTimeTimeTextAppearance;
  /** Whether to render the arrival absolute time. */
  showArrivalTime: boolean;
  /** Whether to render the departure absolute time. */
  showDepartureTime: boolean;
  /**
   * Tolerance for collapsing the arrival row when it would render
   * redundantly next to departure.
   *
   * - `null`: never collapse (always show both rows when scheduled).
   * - `0`: collapse only when arrival and departure are at the
   *   exact same minute (most common UI default).
   * - `n` (positive integer): collapse when
   *   `|departure - arrival| <= n` minutes.
   */
  collapseToleranceMinutes: number | null;
  /** Force relative-time display even when the entry is far in the future. */
  forceShowRelativeTime: boolean;
  /** Optional payload describing which trip inspection target should open. */
  inspectTarget?: TripInspectionTarget;
  /** Optional callback that opens trip inspection for the provided target. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

export function StopTimeTimeInfo({
  arrivalMinutes,
  departureMinutes,
  serviceDate,
  now,
  size,
  align = 'right',
  textAppearance,
  showArrivalTime,
  showDepartureTime,
  collapseToleranceMinutes,
  forceShowRelativeTime,
  inspectTarget,
  onInspectTrip,
}: StopTimeTimeInfoProps) {
  const primaryMinutes = showDepartureTime ? departureMinutes : arrivalMinutes;
  const time = minutesToDate(serviceDate, primaryMinutes);
  const diffMs = time.getTime() - now.getTime();
  const showRelativeTime = forceShowRelativeTime || diffMs <= 60 * 60 * 1000;
  const dt = formatAbsoluteTime(minutesToDate(serviceDate, departureMinutes));
  const at = formatAbsoluteTime(minutesToDate(serviceDate, arrivalMinutes));
  const arrivalCollapsed = shouldCollapseArrival({
    arrivalMinutes,
    departureMinutes,
    collapseToleranceMinutes,
    showArrivalTime,
    showDepartureTime,
  });
  const shouldShowArrivalAbsolute = showArrivalTime && !arrivalCollapsed;
  const shouldShowDepartureAbsolute = showDepartureTime;
  const shouldShowDepartureMarker = shouldShowArrivalAbsolute && shouldShowDepartureAbsolute;
  const timeSize: ExtendedDisplaySize = size;

  const textAlignClassName =
    align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right';
  const rootClassName = cn(
    'flex min-h-8 w-14 shrink-0 flex-col justify-center leading-none',
    textAlignClassName,
  );
  const timeTextClassName = cn(
    textAppearance?.weight === 'normal' ? 'font-normal' : 'font-bold',
    textAppearance?.className,
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
      {showRelativeTime && (
        <RelativeTime
          time={time}
          now={now}
          size={timeSize}
          align={align}
          showPastTime={true}
          hidePrefix={diffMs > 90 * 60 * 1000}
          className={timeTextClassName}
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
            textColor={textAppearance?.color}
            size={timeSize}
            weight={textAppearance?.weight}
            className={textAppearance?.className}
            showDepartureMarker={variant.showDepartureMarker}
            showArrivalMarker={variant.showArrivalMarker}
          />
        );
      })}
    </>
  );

  if (onInspectTrip === undefined || inspectTarget === undefined) {
    return <div className={rootClassName}>{content}</div>;
  }

  return (
    <button
      type="button"
      className={cn(
        rootClassName,
        'cursor-pointer rounded-sm focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none',
      )}
      onClick={(e) => {
        e.stopPropagation();
        onInspectTrip(inspectTarget);
      }}
    >
      {content}
    </button>
  );
}
