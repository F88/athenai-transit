import { useMemo } from 'react';
import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { DepartureGroup, StopWithContext } from '../types/app/transit';
import { distanceM } from '../domain/transit/distance';
import { flattenDepartures } from '../domain/transit/flatten-departures';
import { useInfoLevel } from '../hooks/use-info-level';
import { getStopDisplayNames } from '../domain/transit/get-stop-display-names';
import { routeTypesEmoji } from '../domain/transit/route-type-emoji';
import { hasUnknownDestination } from '../domain/transit/has-unknown-destination';
import { DepartureItem } from './departure-item';
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
  onStopSelected: (stopId: string) => void;
  onShowTimetable?: (stopId: string, group: DepartureGroup) => void;
  onShowStopTimetable?: (stopId: string) => void;
}

export function NearbyStop({
  data: { stop, routeTypes, groups },
  isSelected,
  now,
  mapCenter,
  infoLevel,
  viewId,
  onStopSelected,
  onShowTimetable,
  onShowStopTimetable,
}: NearbyStopProps) {
  const info = useInfoLevel(infoLevel);
  const stopNames = getStopDisplayNames(stop, infoLevel);
  const distance = mapCenter ? Math.round(distanceM(mapCenter, stop)) : null;

  // Show route_type emoji on each departure row when the stop serves
  // multiple route_types (so the user can distinguish bus vs tram etc.).
  // verbose: always show. detailed and below: only when multiple types.
  const hasMultipleRouteTypes = routeTypes.length > 1;
  const showRouteTypeIcon = info.isVerboseEnabled || hasMultipleRouteTypes;

  const flatDepartures = useMemo(
    () => (viewId === 'stop' ? flattenDepartures(groups) : []),
    [viewId, groups],
  );

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
      <div className="m-0 mb-1.5 flex items-center">
        <p className="m-0 text-base font-semibold text-[#1565c0] dark:text-blue-400">
          <span className="mr-1 align-middle text-[22px]">{routeTypesEmoji(routeTypes)}</span>
          {stopNames.name}
          {distance != null && distance >= 10 && <DistanceBadge meters={distance} />}
        </p>
        {onShowStopTimetable && (
          <button
            type="button"
            className="ml-auto shrink-0 cursor-pointer rounded border border-[#1976d2] bg-transparent px-2 py-0.5 text-xs whitespace-nowrap text-[#1976d2] active:bg-[rgba(25,118,210,0.1)] dark:border-blue-400 dark:text-blue-400"
            onClick={(e) => {
              e.stopPropagation();
              onShowStopTimetable(stop.stop_id);
            }}
          >
            時刻表
          </button>
        )}
      </div>
      {hasUnknownDestination(groups) && (
        <p className="m-0 mb-1 text-[11px] text-amber-600 dark:text-amber-400">
          目的地が不明の路線が含まれています
        </p>
      )}
      {groups.length > 0 ? (
        viewId === 'stop' ? (
          flatDepartures
            .slice(0, 5)
            .map((item, i) => (
              <FlatDepartureItem
                key={`${item.route.route_id}__${item.headsign}__${item.departure.getTime()}__${i}`}
                item={item}
                now={now}
                isFirst={i === 0}
                showRouteTypeIcon={showRouteTypeIcon}
                infoLevel={infoLevel}
              />
            ))
        ) : (
          groups.map((group) => (
            <DepartureItem
              key={`${stop.stop_id}__${group.route.route_short_name}__${group.headsign}`}
              group={group}
              now={now}
              infoLevel={infoLevel}
              showRouteTypeIcon={showRouteTypeIcon}
              onShowTimetable={
                onShowTimetable ? (g) => onShowTimetable(stop.stop_id, g) : undefined
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
