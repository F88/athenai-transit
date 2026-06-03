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
    <div className="px-4 pb-0">
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
  const title = `${routeTypesEmoji([display.meta.routeType])} ${t(
    isArrivalBoard ? 'transitDisplay.arrivals' : 'transitDisplay.departures',
  )}`;
  return (
    // Each board is framed like a classic airport signage panel: a thick,
    // square (no rounded corners) border makes the boundary between stacked
    // boards explicit.
    <section className="mb-3 border-16 border-gray-300 last:mb-0 dark:border-gray-600">
      {/* Header band: title left, description right, on a single line. Shares the
          border color; text is darkened/lightened for contrast against it. */}
      <div className="flex items-baseline justify-between gap-2 bg-gray-300 px-3 py-2 dark:bg-gray-600">
        {/* Title — board basis arrow (up = departures, right = arrivals) + mode + phrase.
            The arrow is decorative; the phrase already states departures/arrivals. */}
        <h3 className="text-md flex min-w-0 items-center gap-1 font-bold text-gray-800 dark:text-gray-100">
          {isArrivalBoard ? (
            <ArrowRight size={14} strokeWidth={4} aria-hidden className="shrink-0" />
          ) : (
            <ArrowUp size={14} strokeWidth={4} aria-hidden className="shrink-0" />
          )}
          <span className="truncate">{title}</span>
        </h3>
        {/* Description composed from the display's selection params. */}
        <p className="m-0 shrink-0 text-xs whitespace-nowrap text-gray-600 dark:text-gray-300">
          {t('transitDisplay.recentCount', {
            count: display.meta.max,
            radius: display.meta.radius,
          })}
        </p>
      </div>
      {/* Body: the rows (or the empty fallback). */}
      <div className="p-3">
        {display.data.length === 0 ? (
          <p className="m-0 py-1 text-xs text-[#9e9e9e] dark:text-gray-500">{emptyMessage}</p>
        ) : (
          <ul className="m-0 list-none space-y-1 p-0">
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
  return (
    <button
      type="button"
      className="cursor-pointer rounded-sm font-mono text-sm font-semibold tabular-nums focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:outline-none"
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
      className="cursor-pointer rounded-md bg-[#f5f7fa] px-3 py-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-100"
      onClick={() => onStopSelected(data.stop.id)}
    >
      {/* Single-line departure-board row: time, mode, route, agency, destination, stop, platform. */}
      <div className="flex items-center gap-1.5 whitespace-nowrap">
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
        <span className="text-gray-500 dark:text-gray-400">{data.agencyName}</span>
        <span className="font-medium">{data.routeName}</span>
        {/* Stop: stop-level mode emojis + stop name + platform code. */}

        {infoLevelFlag.isVerboseEnabled && (
          // Stop-level mode emojis
          <span aria-hidden>{data.stop.routeTypesEmoji}</span>
        )}

        <span className="min-w-0 flex-1 truncate font-medium">{data.stop.name}</span>
        {data.stop.platformCode !== undefined && (
          <span className="shrink-0 rounded bg-gray-200 px-1 text-[10px] dark:bg-gray-700">
            {data.stop.platformCode}
          </span>
        )}
        {/* Distance + direction to the stop (same DistanceBadge as StopInfo). */}
        {distanceRounded != null && distanceRounded >= 10 && (
          <DistanceBadge meters={distanceRounded} bearingDeg={bearing} showDirection size="xs" />
        )}
      </div>
    </li>
  );
}
