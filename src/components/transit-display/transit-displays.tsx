import { ArrowRight, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import { DistanceBadge } from '@/components/badge/distance-badge';
import { TimetableEntryAttributesLabels } from '@/components/label/timetable-entry-attributes-labels';
import type { ExtendedDisplaySize } from '@/components/shared/display-size';
import {
  type TransitDisplayData,
  type TransitDisplayEntryData,
} from '@/domain/transit/transit-info-display/build-transit-display-data';
import { getBearingDeg } from '@/domain/transit/distance';
import { routeTypesEmoji } from '@/utils/route-type-emoji';
import type { InfoLevel } from '@/types/app/settings';
import { useInfoLevel } from '@/hooks/use-info-level';
import { cn } from '@/lib/utils';

/**
 * Theme-aware color of the board frame: the thick outer bezel that encloses the
 * panel and the header / rows divider, which read as the same frame. A lighter
 * grey in light mode and a darker grey in dark mode so the frame sits well on
 * either background. Shared so the bezel and the inner divider always render the
 * same frame color.
 */
const BOARD_FRAME_COLOR = 'border-zinc-400 dark:border-zinc-700';

/**
 * Theme-aware background for the board panel (the header band and rows that make
 * up the split-flap panel face). Stays dark in both themes so the panel keeps
 * its amber text, but is lifted slightly in light mode where the darkest shade
 * felt too heavy. Shared so the header and rows always render the same panel
 * color.
 */
const BOARD_PANEL_BG = 'bg-neutral-800 dark:bg-neutral-900';

export interface TransitDisplaysProps {
  displays: readonly TransitDisplayData[];
  emptyMessage: string;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  size: ExtendedDisplaySize;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/** Renders every {@link TransitDisplayData} as its own stacked board. */
export function TransitDisplays({
  displays,
  emptyMessage,
  now,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplaysProps) {
  return (
    <div className="font-dotgothic16 px-4 pb-0">
      {displays.map((display, index) => (
        <TransitDisplay
          key={index}
          display={display}
          emptyMessage={emptyMessage}
          now={now}
          mapCenter={mapCenter}
          infoLevel={infoLevel}
          size={size}
          onStopSelected={onStopSelected}
          onInspectTrip={onInspectTrip}
        />
      ))}
    </div>
  );
}

export interface TransitDisplayProps {
  display: TransitDisplayData;
  emptyMessage: string;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  size: ExtendedDisplaySize;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * One transit board: a single departure or arrival display.
 *
 * Design basis: a slightly classical split-flap signage panel (the "Solari" /
 * flip-board mechanical flap displays once used in stations and airports). The
 * current styling evokes that look statically -- a thick, square-cornered frame
 * and a header band that shares the frame color -- rather than animating real
 * flaps. Typography (fonts, monospacing) and finer split-flap details are
 * intended to be refined later.
 *
 * Layout: a header band (title on the left, recent-count / radius on the right)
 * above the rows, or an empty fallback when the board has no entries.
 */
export function TransitDisplay({
  display,
  emptyMessage,
  mapCenter,
  infoLevel,
  size,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayProps) {
  const { t } = useTranslation();
  // Airport-board-style title: mode emoji + departures/arrivals phrase. The
  // route type and basis are structured meta; the UI composes the localized text.
  // The board's title carries the departure/arrival distinction, so rows do not
  // repeat it: each row shows a single time (the board's basis) without a label.
  const isArrivalBoard = display.meta.category === 'arrivals';
  const routeTypeIcon = routeTypesEmoji(display.meta.routeTypes);
  const title = t(isArrivalBoard ? 'transitDisplay.arrivals' : 'transitDisplay.departures');
  // A board that mixes route types: rows then show their own trip route-type emoji.
  const hasMultiRoutes = display.meta.routeTypes.length >= 2;
  return (
    // Each board is framed like a classic airport signage panel: a thick,
    // square (no rounded corners) border makes the boundary between stacked
    // boards explicit.
    <section
      className={cn(
        'mb-4 overflow-hidden rounded-sm border-12 bg-neutral-950 last:mb-0',
        BOARD_FRAME_COLOR,
      )}
    >
      {/* Header band: title left, description right, on a single line. A dark band
          with letter-spaced amber text, like a split-flap header. */}
      <div
        className={cn(
          'flex items-baseline justify-between gap-3 border-b-8 px-3 py-2.5',
          BOARD_PANEL_BG,
          BOARD_FRAME_COLOR,
        )}
      >
        {/* Title — board basis arrow (up = departures, right = arrivals) + mode + phrase.
            The arrow is decorative; the phrase already states departures/arrivals. */}
        <h3 className="text-md flex min-w-0 items-center gap-4 font-bold tracking-[0.18em] text-amber-100 uppercase">
          {isArrivalBoard ? (
            <ArrowRight size={14} strokeWidth={4} aria-hidden className="shrink-0" />
          ) : (
            <ArrowUp size={14} strokeWidth={4} aria-hidden className="shrink-0" />
          )}
          {routeTypeIcon}
          <span className="truncate">{title}</span>
        </h3>
        {/* Radius the board's stops were selected within (count is intentionally omitted). */}
        <p className="m-0 shrink-0 text-[11px] tracking-[0.12em] whitespace-nowrap text-amber-200/80">
          {display.meta.radius}m
        </p>
      </div>
      {/* Body: the rows (or the empty fallback). */}
      <div className="bg-neutral-950 p-0">
        {display.data.length === 0 ? (
          <p className="m-0 px-1 py-2 text-xs tracking-[0.08em] text-amber-100/55">
            {emptyMessage}
          </p>
        ) : (
          <ul className="m-0 list-none p-0">
            {display.data.map((row) => (
              <TransitDisplayEntry
                key={row.key}
                data={row}
                mapCenter={mapCenter}
                infoLevel={infoLevel}
                size={size}
                hasMultiRoutes={hasMultiRoutes}
                onStopSelected={onStopSelected}
                onInspectTrip={onInspectTrip}
              />
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}

interface TimeInfoProps {
  /** Pre-formatted absolute time text to display. */
  timeText: string;
  /** Stop selected together with trip inspection on tap. */
  stopId: string;
  /** Target opened in trip inspection on tap. */
  inspectTarget: TripInspectionTarget;
  /** Extra classes appended last; lets the caller override the default text size. */
  className?: string;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/**
 * Displays `timeText` as a tappable control. Tapping runs both handlers
 * (select the stop, then open trip inspection) like `StopTimeTimeInfo`, and
 * stops propagation so the row's own onClick does not double-fire.
 */
function TimeInfo({
  timeText,
  stopId,
  inspectTarget,
  className,
  onStopSelected,
  onInspectTrip,
}: TimeInfoProps) {
  // Fixed-width, right-aligned time column so single- and double-digit-hour
  // times ("9:30" / "14:30") align their colons and minutes across rows
  // (DotGothic16 is monospaced; tabular-nums keeps the digits uniform).
  // `text-base` is the default size; `className` (appended last) can override it.
  return (
    <button
      type="button"
      className={cn(
        'mr-2 w-[5ch] shrink-0 cursor-pointer rounded-none text-right font-bold tracking-[0.12em] text-amber-100 tabular-nums focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus-visible:outline-none',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
        onStopSelected(stopId);
        onInspectTrip?.(inspectTarget);
      }}
    >
      {timeText}
    </button>
  );
}

export interface TransitDisplayEntryProps {
  data: TransitDisplayEntryData;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Display size; drives the row text size. */
  size: ExtendedDisplaySize;
  /**
   * Whether the board mixes route types (its `meta.routeTypes.length >= 2`). When
   * true, each row shows its trip's route-type emoji so mixed types can be told
   * apart; a single-type board does not need it.
   */
  hasMultiRoutes: boolean;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/** Row text size per display size; the larger the container, the larger the rows. */
const ROW_TEXT_CLASS_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'text-[8px]',
  sm: 'text-[10px]',
  md: 'text-xs',
  lg: 'text-lg',
  xl: 'text-2xl',
};

const TIMETABLE_ENTRY_ATTRIBUTES_LABELS_SIZE_BY_SIZE: Record<
  ExtendedDisplaySize,
  ExtendedDisplaySize
> = {
  xs: 'xs',
  sm: 'xs',
  md: 'xs',
  lg: 'sm',
  xl: 'md',
};

const DISTANCE_BADGE_SIZE_BY_SIZE: Record<ExtendedDisplaySize, ExtendedDisplaySize> = {
  xs: 'xs',
  sm: 'xs',
  md: 'xs',
  lg: 'lg',
  xl: 'xl',
};

/** Headsign column width per display size (fixed: max == min so the column is stable). */
const HEADSIGN_WIDTH_CLASS_BY_SIZE: Record<ExtendedDisplaySize, string> = {
  xs: 'max-w-[10ch] min-w-[10ch]',
  sm: 'max-w-[12ch] min-w-[12ch]',
  md: 'max-w-[18ch] min-w-[18ch]',
  lg: 'max-w-[32ch] min-w-[32ch]',
  xl: 'max-w-[32ch] min-w-[32ch]',
};

/** A single departure-board row (one stop event). */
export function TransitDisplayEntry({
  data,
  mapCenter,
  infoLevel,
  size,
  hasMultiRoutes,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayEntryProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);

  console.log({ size });

  // Distance is baked on the row (query-time); bearing is computed live from the
  // current map center so the direction arrow tracks panning, like StopInfo.
  const distanceRounded = data.stop.distance != null ? Math.round(data.stop.distance) : null;
  const bearing = mapCenter ? getBearingDeg(mapCenter, data.stop.context.stop) : null;

  const showRouteTypeOfEntry = infoLevelFlag.isVerboseEnabled || hasMultiRoutes;
  // const showRouteTypeOfStop = infoLevelFlag.isVerboseEnabled || data.stop.context.routeTypes.length >= 2;
  const showRouteTypeOfStop = infoLevelFlag.isVerboseEnabled;

  return (
    <li
      className={cn(
        'cursor-pointer border-b border-neutral-800 px-3 py-2 text-neutral-100 last:border-b-0 hover:bg-neutral-800/95',
        ROW_TEXT_CLASS_BY_SIZE[size],
        BOARD_PANEL_BG,
      )}
      onClick={() => onStopSelected(data.stop.id)}
    >
      {/* Single-line departure-board row: time, mode, route, agency, destination, stop, platform. */}
      <div className="flex items-center gap-2 whitespace-nowrap">
        {/* Local TimeInfo: shows timeText; tap selects the stop + opens inspection. */}
        <TimeInfo
          timeText={data.timeText}
          stopId={data.stop.id}
          inspectTarget={data.inspectionTarget}
          className={ROW_TEXT_CLASS_BY_SIZE[size]}
          onStopSelected={onStopSelected}
          onInspectTrip={onInspectTrip}
        />

        {showRouteTypeOfEntry && (
          // Route type emoji for the trip
          <span aria-hidden>{data.routeTypeEmoji}</span>
        )}

        {/* Headsign (destination) + attribute labels: headsign fills the column and
            truncates, pushing the labels to the right edge. */}
        <span className={cn('flex items-center gap-1', HEADSIGN_WIDTH_CLASS_BY_SIZE[size])}>
          <span className="min-w-0 flex-1 truncate">{data.headsign || '-'}</span>
          {/* Attribute labels (terminal / origin / no-pickup / no-drop-off). Shows the
            no-boarding marker so a service that cannot be boarded here is not silent. */}
          <TimetableEntryAttributesLabels
            size={TIMETABLE_ENTRY_ATTRIBUTES_LABELS_SIZE_BY_SIZE[size]}
            attributes={data.attributes}
            showDisplayTerminal={true}
            showDisplayOrigin={true}
            showDisplayPickupUnavailable={true}
            showDisplayDropOffUnavailable={true}
          />
        </span>

        {/* Route name */}
        <span className="min-w-[6ch] flex-1 truncate text-left text-amber-100">
          {data.routeName}
        </span>

        {/* Operating agency + route name. */}
        <span className="min-w-[6ch] flex-1 truncate text-left text-neutral-400">
          {data.agencyName}
        </span>

        {/* Stop: stop-level mode emojis + stop name + platform code. */}
        {showRouteTypeOfStop && (
          // Stop-level mode emojis
          <span aria-hidden>{data.stop.routeTypesEmoji}</span>
        )}

        {/* Stop info kept together as one group (stop name, platform code, and
            distance / direction) so the stop's details are not split across the row. */}
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <span className="min-w-0 truncate">{data.stop.name}</span>
          {data.stop.platformCode !== undefined && (
            <span className="shrink-0 bg-neutral-800 px-1 text-amber-100">
              {data.stop.platformCode}
            </span>
          )}
          {/* Distance + direction to the stop (same DistanceBadge as StopInfo). */}
          {infoLevelFlag.isVerboseEnabled && distanceRounded != null && distanceRounded >= 10 && (
            <DistanceBadge
              meters={distanceRounded}
              bearingDeg={bearing}
              showDirection
              size={DISTANCE_BADGE_SIZE_BY_SIZE[size]}
            />
          )}
        </span>
      </div>
    </li>
  );
}
