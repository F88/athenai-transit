import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { Agency, Route, RouteType, Stop } from '../types/app/transit';
import type { StopWithContext, StopWithMeta } from '../types/app/transit-composed';
import { bearingDeg } from '../domain/transit/distance';
import { useInfoLevel } from '../hooks/use-info-level';
import { getStopDisplayNames } from '../domain/transit/get-stop-display-names';
import { routeTypesEmoji } from '../domain/transit/route-type-emoji';
import { AgencyBadge } from './badge/agency-badge';
import { DistanceBadge } from './badge/distance-badge';
import { IdBadge } from './badge/id-badge';
import { RouteBadge } from './badge/route-badge';
import { VerboseStopData } from './verbose/verbose-stop-data';
import { VerboseStopDisplayNames } from './verbose/verbose-stop-display-names';

interface StopInfoProps {
  stop: Stop;
  routeTypes: RouteType[];
  agencies: Agency[];
  /** Pre-computed distance in meters from map center. */
  distance?: number;
  mapCenter: LatLng | null;
  infoLevel: InfoLevel;
  /** Whether this stop is drop-off only (no boardable departures). */
  isDropOffOnly: boolean;
  /** Routes serving this stop. */
  routes?: Route[];
  /** Per-stop operational statistics from InsightsBundle. */
  stats?: StopWithMeta['stats'];
  /** Geographic metrics from GlobalInsightsBundle. */
  geo?: StopWithContext['geo'];
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
  distance,
  mapCenter,
  infoLevel,
  isDropOffOnly,
  routes,
  stats,
  geo,
}: StopInfoProps) {
  const info = useInfoLevel(infoLevel);
  const stopNames = getStopDisplayNames(stop, infoLevel);
  const distanceRounded = distance != null ? Math.round(distance) : null;
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
        {distanceRounded != null && distanceRounded >= 10 && (
          <DistanceBadge meters={distanceRounded} bearingDeg={bearing} showDirection />
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
      {(stats?.freq != null ||
        stats?.routeCount != null ||
        geo ||
        (routes && routes.length > 0)) && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {stats?.freq != null && (
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {stats.freq}本/日
            </span>
          )}
          {stats?.routeCount != null && (
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              {stats.routeCount}路線
            </span>
          )}
          {geo?.nearestRoute != null && (
            <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-[10px] font-medium text-gray-600 dark:bg-gray-700 dark:text-gray-300">
              最寄{geo.nearestRoute}km
            </span>
          )}
          {routes &&
            routes.length > 0 &&
            routes.map((r) => (
              <RouteBadge key={r.route_id} route={r} infoLevel={infoLevel} size="xs" />
            ))}
        </div>
      )}
      {info.isVerboseEnabled && (
        <details className="mt-1 text-[9px] font-normal text-[#999] dark:text-gray-500">
          <summary className="cursor-pointer select-none">[StopData]</summary>
          <div className="mt-0.5 space-y-0.5">
            <VerboseStopData
              stop={stop}
              isDropOffOnly={isDropOffOnly}
              distance={distance}
              bearing={bearing}
              routeTypes={routeTypes}
              agencies={agencies}
              routes={routes}
              stats={stats}
              geo={geo}
            />
            <VerboseStopDisplayNames names={stopNames} />
          </div>
        </details>
      )}
    </div>
  );
}
