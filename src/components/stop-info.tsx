import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { Agency, RouteType, Stop } from '../types/app/transit';
import { bearingDeg, distanceM } from '../domain/transit/distance';
import { useInfoLevel } from '../hooks/use-info-level';
import { getStopDisplayNames } from '../domain/transit/get-stop-display-names';
import { routeTypesEmoji } from '../domain/transit/route-type-emoji';
import { AgencyBadge } from './badge/agency-badge';
import { DistanceBadge } from './badge/distance-badge';
import { IdBadge } from './badge/id-badge';

interface StopInfoProps {
  stop: Stop;
  routeTypes: RouteType[];
  agencies: Agency[];
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Whether this stop is drop-off only (no boardable departures). */
  isDropOffOnly: boolean;
}

/**
 * Displays stop identification: name, route type emoji, distance/direction,
 * drop-off-only label, and agency badges.
 *
 * Does not include action buttons (anchor, timetable) — those belong
 * to the parent component's interaction layer.
 */
export function StopInfo({
  stop,
  routeTypes,
  agencies,
  mapCenter,
  infoLevel,
  isDropOffOnly,
}: StopInfoProps) {
  const info = useInfoLevel(infoLevel);
  const stopNames = getStopDisplayNames(stop, infoLevel);
  const distance = mapCenter ? Math.round(distanceM(mapCenter, stop)) : null;
  const bearing = mapCenter ? bearingDeg(mapCenter, stop) : null;

  return (
    <div className="min-w-0 flex-1">
      {info.isVerboseEnabled && (
        <div className="mb-1">
          <IdBadge>{stop.stop_id}</IdBadge>
        </div>
      )}
      {stopNames.subNames.length > 0 && (
        <p className="m-0 mb-0.5 text-xs font-normal text-[#888] dark:text-gray-400">
          {stopNames.subNames.join(' / ')}
        </p>
      )}
      <div className="m-0 flex flex-wrap items-center gap-1 text-xl font-semibold text-[#1565c0] dark:text-blue-400">
        <span className="mr-1">{routeTypesEmoji(routeTypes)}</span>
        <span>{stopNames.name}</span>
        {distance != null && distance >= 10 && (
          <DistanceBadge meters={distance} bearingDeg={bearing} showDirection />
        )}
        {isDropOffOnly && (
          <span className="shrink-0 rounded bg-red-100 px-1.5 py-0.5 text-[10px] font-medium text-red-700 dark:bg-red-900 dark:text-red-300">
            降車専用
          </span>
        )}
        {agencies.length > 0 &&
          agencies.map((agency) => (
            <AgencyBadge
              key={agency.agency_id}
              agency={agency}
              infoLevel={infoLevel}
              //
              // size="xs"
              size="sm"
              // size="default"
            />
          ))}
      </div>
    </div>
  );
}
