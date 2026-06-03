import { useMemo, type RefObject } from 'react';

import { useTranslation } from 'react-i18next';

import type { LatLng } from '@/types/app/map';
import type { InfoLevel } from '@/types/app/settings';
import type { StopWithContext, TripInspectionTarget } from '@/types/app/transit-composed';

import { useScrollFades } from '@/hooks/use-scroll-fades';

import { DistanceBadge } from '@/components/badge/distance-badge';
import { ScrollFadeEdge } from '@/components/shared/scroll-fade-edge';
import {
  buildTransitDisplayDataSet,
  type TransitDisplayData,
  type TransitDisplayEntryData,
} from '@/domain/transit/transit-info-display/build-transit-display-data';
import { getBearingDeg } from '@/domain/transit/distance';
import { routeTypesEmoji } from '@/utils/route-type-emoji';

export interface TransitDisplaysContainerProps {
  stopTimes: StopWithContext[];
  /** Current wall-clock reference time for relative time display. */
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  dataLangs: readonly string[];
  contentRef: RefObject<HTMLDivElement | null>;
  /** Select the target stop (fired together with trip inspection on a time tap). */
  onStopSelected: (stopId: string) => void;
  /** Optional callback for opening trip inspection for one concrete stop event. */
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

export function TransitDisplaysContainer({
  stopTimes,
  now,
  mapCenter,
  infoLevel: _infoLevel,
  dataLangs,
  contentRef,
  onStopSelected,
  onInspectTrip,
}: TransitDisplaysContainerProps) {
  const { t } = useTranslation();
  const stopIdsKey = useMemo(() => stopTimes.map((swc) => swc.stop.stop_id).join(','), [stopTimes]);
  const scrollFade = useScrollFades(contentRef, stopIdsKey);
  const displays = useMemo(
    () => buildTransitDisplayDataSet(stopTimes, dataLangs),
    [stopTimes, dataLangs],
  );

  return (
    <div
      className="relative min-h-0 flex-1 overflow-y-auto"
      ref={contentRef}
      onScroll={scrollFade.handleScroll}
    >
      {scrollFade.showTop && <ScrollFadeEdge position="top" />}
      <TransitDisplays
        displays={displays}
        emptyMessage={t('stop.timetable.allFilteredOut')}
        now={now}
        mapCenter={mapCenter}
        onStopSelected={onStopSelected}
        onInspectTrip={onInspectTrip}
      />
      {scrollFade.showBottom && <ScrollFadeEdge position="bottom" />}
    </div>
  );
}

export interface TransitDisplaysProps {
  displays: readonly TransitDisplayData[];
  emptyMessage: string;
  now: Date;
  mapCenter: LatLng | null;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/** Renders every {@link TransitDisplayData} as its own stacked board. */
export function TransitDisplays({
  displays,
  emptyMessage,
  now,
  mapCenter,
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
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/** One departure-board display: optional heading plus its rows (or empty fallback). */
export function TransitDisplay({
  display,
  emptyMessage,
  now,
  mapCenter,
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
    <section className="mb-3 last:mb-0">
      {/* Title — what this display is (mode + departures/arrivals). */}
      <h3 className="mb-0.5 text-xs font-semibold text-gray-600 dark:text-gray-300">{title}</h3>
      {/* Description composed from the display's selection params. */}
      <p className="m-0 mb-1 text-[10px] text-gray-500 dark:text-gray-400">
        {t('transitDisplay.recentCount', {
          count: display.meta.max,
          radius: display.meta.radius,
        })}
      </p>
      {/* Data — the rows. */}
      {display.data.length === 0 ? (
        <p className="m-0 py-1 text-xs text-[#9e9e9e] dark:text-gray-500">{emptyMessage}</p>
      ) : (
        <ul className="m-0 list-none space-y-1 p-0">
          {display.data.map((row) => (
            <TransitDisplayEntry
              key={row.key}
              row={row}
              now={now}
              mapCenter={mapCenter}
              onStopSelected={onStopSelected}
              onInspectTrip={onInspectTrip}
            />
          ))}
        </ul>
      )}
    </section>
  );
}

export interface TimeInfoProps {
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
  row: TransitDisplayEntryData;
  now: Date;
  mapCenter: LatLng | null;
  onStopSelected: (stopId: string) => void;
  onInspectTrip?: (target: TripInspectionTarget) => void;
}

/** A single departure-board row (one stop event). */
export function TransitDisplayEntry({
  row,
  now: _now,
  mapCenter,
  onStopSelected,
  onInspectTrip,
}: TransitDisplayEntryProps) {
  // Distance is baked on the row (query-time); bearing is computed live from the
  // current map center so the direction arrow tracks panning, like StopInfo.
  const distanceRounded = row.stop.distance != null ? Math.round(row.stop.distance) : null;
  const bearing = mapCenter ? getBearingDeg(mapCenter, row.stop.context.stop) : null;
  return (
    <li
      className="cursor-pointer rounded-md bg-[#f5f7fa] px-3 py-2 text-xs text-gray-800 dark:bg-gray-800 dark:text-gray-100"
      onClick={() => onStopSelected(row.stop.id)}
    >
      {/* Single-line departure-board row: time, mode, route, agency, destination, stop, platform. */}
      <div className="flex items-center gap-1.5 whitespace-nowrap">
        {/* Local TimeInfo: shows timeText; tap selects the stop + opens inspection. */}
        <TimeInfo
          timeText={row.timeText}
          stopId={row.stop.id}
          inspectTarget={row.inspectionTarget}
          onStopSelected={onStopSelected}
          onInspectTrip={onInspectTrip}
        />
        {/* Trip mode emoji + destination (行き先), allowed to shrink and truncate. */}
        <span aria-hidden>{row.routeTypeEmoji}</span>
        <span className="min-w-0 flex-1 truncate">{row.headsign || '-'}</span>
        {/* Operating agency + route name. */}
        <span className="text-gray-500 dark:text-gray-400">{row.agencyName}</span>
        <span className="font-medium">{row.routeName}</span>
        {/* Stop: stop-level mode emojis + stop name + platform code. */}
        <span aria-hidden>{row.stop.routeTypesEmoji}</span>
        <span className="min-w-0 flex-1 truncate font-medium">{row.stop.name}</span>
        {row.stop.platformCode !== undefined && (
          <span className="shrink-0 rounded bg-gray-200 px-1 text-[10px] dark:bg-gray-700">
            {row.stop.platformCode}
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
