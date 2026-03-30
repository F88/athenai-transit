import { useMemo } from 'react';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { StopWithContext } from '../types/app/transit-composed';
import { bearingDeg, distanceM } from '../domain/transit/distance';
import { groupByRouteHeadsign } from '../domain/transit/group-timetable-entries';
import { useInfoLevel } from '../hooks/use-info-level';
import { getStopDisplayNames } from '../domain/transit/get-stop-display-names';
import { routeTypesEmoji } from '../domain/transit/route-type-emoji';
import { resolveAgencyDisplayName } from '../domain/transit/get-agency-display-name';
import { Clock, Signpost } from 'lucide-react';
import { DepartureItem } from './departure-item';
import { AgencyBadge } from './badge/agency-badge';
import { DistanceBadge } from './badge/distance-badge';
import { IdBadge } from './badge/id-badge';
import { FlatDepartureItem } from './flat-departure-item';

interface NearbyStopProps {
  data: StopWithContext;
  isSelected: boolean;
  now: Date;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Active departure view pattern ID. */
  viewId: string;
  /** Whether this stop is in the anchor (bookmark) list. */
  isAnchor: boolean;
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, routeId: string, headsign: string) => void;
  onShowStopTimetable?: (stopId: string) => void;
  /** Toggle anchor (bookmark) status for this stop. */
  onToggleAnchor: (stopId: string) => void;
}

export function NearbyStop({
  data: { stop, routeTypes, departures, isBoardableOnServiceDay, agencies },
  isSelected,
  now,
  mapCenter,
  infoLevel,
  viewId,
  isAnchor,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
  onToggleAnchor,
}: NearbyStopProps) {
  const info = useInfoLevel(infoLevel);
  const stopNames = getStopDisplayNames(stop, infoLevel);
  const distance = mapCenter ? Math.round(distanceM(mapCenter, stop)) : null;
  const bearing = mapCenter ? bearingDeg(mapCenter, stop) : null;
  // Show route_type emoji on each departure row when the stop serves
  // multiple route_types (so the user can distinguish bus vs tram etc.).
  // verbose: always show. detailed and below: only when multiple types.
  const hasMultipleRouteTypes = routeTypes.length > 1;
  const showRouteTypeIconForAllDepartures = info.isVerboseEnabled || hasMultipleRouteTypes;

  // detailed: show all entries (including terminal/drop-off-only with labels)
  // non-detailed: show only boardable departures
  // const displayDepartures = useMemo(
  //   () => (info.isDetailedEnabled ? departures : filterBoardable(departures)),
  //   [info.isDetailedEnabled, departures],
  // );
  const displayDepartures = departures;

  const grouped = useMemo(
    () => (viewId !== 'stop' ? groupByRouteHeadsign(displayDepartures) : []),
    [viewId, displayDepartures],
  );

  const hasUnknownHeadsign = useMemo(
    () => departures.some((e) => e.routeDirection.headsign === ''),
    [departures],
  );

  const isStopDropOffOnly = !isBoardableOnServiceDay;

  return (
    <div
      data-stop-id={stop.stop_id}
      className={`mb-2 cursor-pointer rounded-lg px-3 pt-2.5 pb-3 last:mb-0 ${isSelected ? 'border border-[#90caf9] bg-[#e3f2fd] dark:border-blue-700 dark:bg-blue-950' : 'bg-[#f5f7fa] dark:bg-gray-800'}`}
      onClick={() => onStopSelected(stop.stop_id)}
    >
      {info.isVerboseEnabled && (
        <div className="mb-1">
          <IdBadge>{stop.stop_id}</IdBadge>
        </div>
      )}
      {stopNames.subNames.length > 0 && (
        <p className="m-0 mb-0.5 text-[11px] font-normal text-[#888] dark:text-gray-400">
          {stopNames.subNames.join(' / ')}
        </p>
      )}
      <div className="m-0 mb-1.5 flex flex-wrap items-center gap-1">
        <p className="m-0 text-base font-semibold text-[#1565c0] dark:text-blue-400">
          <span className="mr-1 align-middle text-[22px]">{routeTypesEmoji(routeTypes)}</span>
          {stopNames.name}
          {distance != null && distance >= 10 && (
            <DistanceBadge meters={distance} bearingDeg={bearing} showDirection />
          )}
        </p>
        {isStopDropOffOnly && (
          <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
            降車専用
          </span>
        )}
        {agencies.length > 0 &&
          agencies.map((agency) => (
            <AgencyBadge key={agency.agency_id} agency={agency} infoLevel={infoLevel} size="xs" />
          ))}
        <button
          type="button"
          className="ml-auto shrink-0 cursor-pointer rounded border border-amber-400 bg-transparent px-1.5 py-0.5 active:bg-amber-50 dark:border-amber-500 dark:active:bg-amber-950"
          onClick={(e) => {
            e.stopPropagation();
            onToggleAnchor(stop.stop_id);
          }}
          title={isAnchor ? 'Remove anchor' : 'Add anchor'}
          aria-label={isAnchor ? 'Remove anchor' : 'Add anchor'}
          aria-pressed={isAnchor}
        >
          <Signpost
            size={16}
            strokeWidth={2}
            className={isAnchor ? 'text-amber-500' : 'text-gray-400'}
          />
        </button>
        {onShowStopTimetable && (
          <button
            type="button"
            className="shrink-0 cursor-pointer rounded border border-[#1976d2] bg-transparent px-1.5 py-0.5 text-[#1976d2] active:bg-[rgba(25,118,210,0.1)] dark:border-blue-400 dark:text-blue-400"
            onClick={(e) => {
              e.stopPropagation();
              onShowStopTimetable(stop.stop_id);
            }}
            title="Show timetable"
            aria-label="Show timetable"
          >
            <Clock size={16} strokeWidth={2} />
          </button>
        )}
      </div>
      {info.isVerboseEnabled && departures.length > 0 && (
        <p className="m-0 mb-1 text-[9px] text-[#999] dark:text-gray-500">
          entries={departures.length}
          {` boardable=${departures.filter((e) => e.boarding.pickupType !== 1 && !e.patternPosition.isTerminal).length}`}
          {` dropOffOnly=${departures.filter((e) => e.boarding.pickupType === 1 || e.patternPosition.isTerminal).length}`}
          {isStopDropOffOnly && ' (ALL DROP-OFF ONLY)'}
        </p>
      )}
      {hasUnknownHeadsign && (
        <p className="m-0 mb-1 text-[11px] text-amber-600 dark:text-amber-400">
          行先が表示されない路線があります
        </p>
      )}
      {displayDepartures.length > 0 ? (
        viewId === 'stop' ? (
          displayDepartures
            .slice(0, 5)
            .map((entry, i) => (
              <FlatDepartureItem
                key={`${entry.routeDirection.route.route_id}__${entry.routeDirection.headsign}__${entry.schedule.departureMinutes}__${i}`}
                entry={entry}
                now={now}
                isFirst={i === 0}
                showRouteTypeIcon={showRouteTypeIconForAllDepartures}
                infoLevel={infoLevel}
                agencyName={resolveAgencyDisplayName(
                  entry.routeDirection.route.agency_id,
                  agencies,
                  infoLevel,
                )}
                agency={agencies.find((a) => a.agency_id === entry.routeDirection.route.agency_id)}
              />
            ))
        ) : (
          grouped.map(([key, entries]) => (
            <DepartureItem
              key={`${stop.stop_id}__${key}`}
              entries={entries}
              now={now}
              infoLevel={infoLevel}
              showRouteTypeIcon={showRouteTypeIconForAllDepartures}
              agencyName={resolveAgencyDisplayName(
                entries[0].routeDirection.route.agency_id,
                agencies,
                infoLevel,
              )}
              agency={agencies.find(
                (a) => a.agency_id === entries[0].routeDirection.route.agency_id,
              )}
              onShowTimetable={
                onShowTimetable
                  ? (routeId, headsign) => onShowTimetable(stop.stop_id, routeId, headsign)
                  : undefined
              }
            />
          ))
        )
      ) : (
        <p className="m-0 text-xs text-[#9e9e9e] dark:text-gray-500">本日の運行は終了しました</p>
      )}
    </div>
  );
}
