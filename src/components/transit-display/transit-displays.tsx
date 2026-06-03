import { ArrowRight, ArrowUp } from 'lucide-react';
import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { TripInspectionTarget } from '@/types/app/transit-composed';

import { DistanceBadge } from '@/components/badge/distance-badge';
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
  onStopSelected,
  onInspectTrip,
}: TransitDisplayProps) {
  const { t } = useTranslation();
  // Airport-board-style title: mode emoji + departures/arrivals phrase. The
  // route type and basis are structured meta; the UI composes the localized text.
  // The board's title carries the departure/arrival distinction, so rows do not
  // repeat it: each row shows a single time (the board's basis) without a label.
  const isArrivalBoard = display.meta.timeBasis === 'arrival';
  const routeTypeIcon = routeTypesEmoji([display.meta.routeType]);
  const title = t(isArrivalBoard ? 'transitDisplay.arrivals' : 'transitDisplay.departures');
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
  onStopSelected,
  onInspectTrip,
}: TimeInfoProps) {
  // Fixed-width, right-aligned time column so single- and double-digit-hour
  // times ("9:30" / "14:30") align their colons and minutes across rows
  // (DotGothic16 is monospaced; tabular-nums keeps the digits uniform).
  return (
    <button
      type="button"
      className="w-[6ch] cursor-pointer rounded-none py-0.5 text-right text-base font-bold tracking-[0.12em] text-amber-100 tabular-nums focus-visible:ring-2 focus-visible:ring-amber-300 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 focus-visible:outline-none"
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
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/** A single departure-board row (one stop event). */
export function TransitDisplayEntry({
  data,
  mapCenter,
  infoLevel,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayEntryProps) {
  const infoLevelFlag = useInfoLevel(infoLevel);

  // Distance is baked on the row (query-time); bearing is computed live from the
  // current map center so the direction arrow tracks panning, like StopInfo.
  const distanceRounded = data.stop.distance != null ? Math.round(data.stop.distance) : null;
  const bearing = mapCenter ? getBearingDeg(mapCenter, data.stop.context.stop) : null;
  return (
    <li
      className={cn(
        'cursor-pointer border-b border-neutral-800 px-3 py-2 text-xs text-neutral-100 last:border-b-0 hover:bg-neutral-800/95',
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
          onStopSelected={onStopSelected}
          onInspectTrip={onInspectTrip}
        />

        {infoLevelFlag.isVerboseEnabled && (
          // Route type emoji for the trip
          <span aria-hidden>{data.routeTypeEmoji}</span>
        )}

        <span className="min-w-0 flex-1 truncate">{data.headsign || '-'}</span>
        {/* Operating agency + route name. */}
        <span className="text-neutral-400">{data.agencyName}</span>
        <span className="font-semibold text-amber-100">{data.routeName}</span>
        {/* Stop: stop-level mode emojis + stop name + platform code. */}

        {infoLevelFlag.isVerboseEnabled && (
          // Stop-level mode emojis
          <span aria-hidden>{data.stop.routeTypesEmoji}</span>
        )}

        {/* Stop info kept together as one group (stop name, platform code, and
            distance / direction) so the stop's details are not split across the row. */}
        <span className="flex min-w-0 flex-1 items-center gap-1">
          <span className="min-w-0 truncate font-medium">{data.stop.name}</span>
          {data.stop.platformCode !== undefined && (
            <span className="shrink-0 rounded-none border border-neutral-700 bg-neutral-800 px-1.5 text-[10px] tracking-[0.12em] text-amber-100">
              {data.stop.platformCode}
            </span>
          )}
          {/* Distance + direction to the stop (same DistanceBadge as StopInfo). */}
          {distanceRounded != null && distanceRounded >= 10 && (
            <DistanceBadge meters={distanceRounded} bearingDeg={bearing} showDirection size="xs" />
          )}
        </span>
      </div>
    </li>
  );
}
