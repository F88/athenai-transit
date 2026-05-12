import { memo } from 'react';

import { type AdjustedRouteColors } from '@/domain/transit/color-resolver/route-colors';
import type { InfoLevel } from '@/types/app/settings';
import type {
  SelectedTripSnapshot,
  TripInspectionTarget,
  TripStopTime,
} from '@/types/app/transit-composed';
import { LabelCountBadge } from '../badge/label-count-badge';
import { StopTimeTimeInfo, type StopTimeTimeInfoAlign } from '../stop-time-time-info';
import { TripStops1 } from './trip-stops-1';
import { TripStops2 } from './trip-stops-2';

/** Shared props forwarded to the active TripStops implementation. */
export interface TripStopsProps {
  tripSnapshot: SelectedTripSnapshot;
  renderedSnapshot: SelectedTripSnapshot | null;
  selectedPatternStopIndex: number;
  routeColors: AdjustedRouteColors<string>;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  now: Date;
  onInspectTrip?: (target: TripInspectionTarget) => void;
  onSelectStopById?: (stopId: string) => void;
}

/** Shared props for a concrete reconstructed stop row in the trip stops list. */
export interface TripStopRowProps {
  tripStopTime: TripStopTime;
  tripLocator: SelectedTripSnapshot['locator'];
  totalStops: number;
  currentPatternStopIndex: number;
  routeColors: AdjustedRouteColors<string>;
  infoLevel: InfoLevel;
  serviceDate: Date;
  dataLangs: readonly string[];
  now: Date;
  onInspectTrip?: (target: TripInspectionTarget) => void;
  onSelectStopById?: (stopId: string) => void;
}

/** Shared props for placeholder rows rendered for missing pattern positions. */
export interface TripStopPlaceholderRowProps {
  stopIndex: number;
  totalStops: number;
  currentPatternStopIndex: number;
  routeColors: AdjustedRouteColors<string>;
  infoLevel: InfoLevel;
}

interface TripStopMetaInfoProps {
  serviceDate?: Date;
  now?: Date;
  arrivalMinutes?: number;
  departureMinutes?: number;
  showArrivalTime?: boolean;
  showDepartureTime?: boolean;
  collapseToleranceMinutes: null | number;
  stopIndex: number;
  totalStops: number;
  timeTextColor?: string;
  labelBg?: string;
  labelFg?: string;
  frameColor?: string;
  align: StopTimeTimeInfoAlign;
  className?: string;
  stopId?: string;
  inspectTarget?: TripInspectionTarget;
  onSelectStopById?: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * Compact meta block rendered beside each trip stop row.
 *
 * Displays the stop index badge and, when schedule inputs are complete, the
 * corresponding arrival / departure time summary.
 *
 * @param props - Display and interaction data for the stop meta block.
 * @returns The stop badge and optional time summary for a trip stop row.
 */
export function TripStopMetaInfo({
  serviceDate,
  now,
  arrivalMinutes,
  departureMinutes,
  showArrivalTime,
  showDepartureTime,
  collapseToleranceMinutes,
  stopIndex,
  totalStops,
  timeTextColor,
  labelBg,
  labelFg,
  frameColor,
  align,
  className,
  stopId,
  inspectTarget,
  onSelectStopById,
  onInspectTrip,
}: TripStopMetaInfoProps) {
  const shouldRenderStopTimeTimeInfo =
    arrivalMinutes !== undefined &&
    departureMinutes !== undefined &&
    serviceDate !== undefined &&
    now !== undefined &&
    showArrivalTime !== undefined &&
    showDepartureTime !== undefined;

  return (
    <div className={className ?? 'flex flex-col items-end gap-1'}>
      <div className="self-start">
        <LabelCountBadge
          label={`${stopIndex + 1}`}
          count={totalStops}
          size="md"
          labelBg={labelBg}
          labelFg={labelFg}
          frameColor={frameColor}
        />
      </div>
      {shouldRenderStopTimeTimeInfo && (
        <StopTimeTimeInfo
          arrivalMinutes={arrivalMinutes}
          departureMinutes={departureMinutes}
          serviceDate={serviceDate}
          now={now}
          size="md"
          align={align}
          showArrivalTime={showArrivalTime}
          showDepartureTime={showDepartureTime}
          collapseToleranceMinutes={collapseToleranceMinutes}
          forceShowRelativeTime={true}
          textAppearance={{ color: timeTextColor }}
          stopId={stopId}
          inspectTarget={inspectTarget}
          onSelectStopById={onSelectStopById}
          onInspectTrip={onInspectTrip}
        />
      )}
    </div>
  );
}

/** Supported temporary variants for the TripStops design comparison. */
type TripStopsVariant = 'v1' | 'v2';

/** Query parameter name for the temporary TripStops design comparison switch. */
const TRIP_STOPS_VARIANT_QUERY_PARAM = 'tripStops';

/**
 * Default temporary variant used when the query parameter is absent or invalid.
 *
 * Keep this value explicit so the preferred design under review is obvious in
 * both the implementation and the tests.
 */
const TRIP_STOPS_VARIANT_DEFAULT_VALUE: TripStopsVariant = 'v2';

/** Component implementation used for each temporary TripStops variant. */
const TRIP_STOPS_COMPONENT_BY_VARIANT: Record<TripStopsVariant, typeof TripStops1> = {
  v1: TripStops1,
  v2: TripStops2,
};

/** Default TripStops implementation used when no temporary variant is selected. */
const DEFAULT_TRIP_STOPS_COMPONENT =
  TRIP_STOPS_COMPONENT_BY_VARIANT[TRIP_STOPS_VARIANT_DEFAULT_VALUE];

/**
 * Resolve the temporary TripStops design variant from the query string.
 *
 * The comparison switch is intentionally local to the TripStops facade so the
 * rest of the UI does not need to know about the temporary `TripStops1` /
 * `TripStops2` split during design review.
 *
 * @returns The requested temporary variant, or the configured default when the
 * query parameter is absent or invalid.
 */
function getTripStopsVariantFromQuery(): TripStopsVariant {
  if (typeof window === 'undefined') {
    return TRIP_STOPS_VARIANT_DEFAULT_VALUE;
  }

  const requestedVariant = new URLSearchParams(window.location.search).get(
    TRIP_STOPS_VARIANT_QUERY_PARAM,
  );

  if (requestedVariant == null) {
    return TRIP_STOPS_VARIANT_DEFAULT_VALUE;
  }

  return Object.hasOwn(TRIP_STOPS_COMPONENT_BY_VARIANT, requestedVariant)
    ? (requestedVariant as TripStopsVariant)
    : TRIP_STOPS_VARIANT_DEFAULT_VALUE;
}

/**
 * Public TripStops facade used by dialogs and other callers.
 *
 * TEMPORARY DESIGN COMPARISON SWITCH:
 * This query-param based branch exists only to switch between the TripStops1
 * and TripStops2 UI designs during review. Keep the branching logic isolated
 * here, and remove it once the design comparison ends and a single
 * implementation is chosen.
 *
 * @param props - Shared props forwarded unchanged to the active TripStops variant.
 * @returns The active TripStops implementation for the current temporary variant.
 */
export const TripStops = memo(function TripStops(props: TripStopsProps) {
  const activeVariant = getTripStopsVariantFromQuery();
  const ActiveTripStops =
    activeVariant === TRIP_STOPS_VARIANT_DEFAULT_VALUE
      ? DEFAULT_TRIP_STOPS_COMPONENT
      : TRIP_STOPS_COMPONENT_BY_VARIANT[activeVariant];

  return <ActiveTripStops {...props} />;
});
