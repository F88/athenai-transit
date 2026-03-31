import type { LatLng } from '../types/app/map';
import type { InfoLevel } from '../types/app/settings';
import type { Agency, Route, RouteType, Stop } from '../types/app/transit';
import type { StopWithContext, StopWithMeta } from '../types/app/transit-composed';
import { bearingDeg } from '../domain/transit/distance';
import { useInfoLevel } from '../hooks/use-info-level';
import { getStopDisplayNames } from '../domain/transit/get-stop-display-names';
import { routeTypesEmoji } from '../domain/transit/route-type-emoji';
import { Accessibility } from 'lucide-react';
import { AgencyBadge } from './badge/agency-badge';
import { DistanceBadge } from './badge/distance-badge';
import { IdBadge } from './badge/id-badge';
import { RouteBadge } from './badge/route-badge';
import { StopMetrics } from './stop-metrics';
import { VerboseStopData } from './verbose/verbose-stop-data';

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
  const showVerbose = infoLevel === 'verbose';
  const stopNames = getStopDisplayNames(stop, infoLevel);
  const distanceRounded = distance != null ? Math.round(distance) : null;
  const bearing = mapCenter ? bearingDeg(mapCenter, stop) : null;

  return (
    <div className="min-w-0 flex-1">
      {showVerbose && (
        <VerboseStopData
          stop={stop}
          stopNames={stopNames}
          isDropOffOnly={isDropOffOnly}
          distance={distance}
          bearing={bearing}
          routeTypes={routeTypes}
          agencies={agencies}
          routes={routes}
          stats={stats}
          geo={geo}
        />
      )}
      {showVerbose && (
        <>
          <div className="mb-1 flex gap-1">
            <IdBadge>{stop.stop_id}</IdBadge>
            {stop.parent_station && <IdBadge>p:{stop.parent_station}</IdBadge>}
          </div>
        </>
      )}
      {stopNames.subNames.length > 0 && (
        <p className="m-0 mb-0.5 text-xs font-normal text-[#888] dark:text-gray-400">
          {stopNames.subNames.join(' / ')}
        </p>
      )}
      <div className="m-0 flex flex-wrap items-center gap-1 text-xl font-semibold text-[#1565c0] dark:text-blue-400">
        <span className="mr-1">{routeTypesEmoji(routeTypes)}</span>
        <span>{stopNames.name}</span>
        {stop.platform_code && (
          <span className="shrink-0 rounded border border-amber-400 bg-amber-100 px-1.5 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-600 dark:bg-amber-900 dark:text-amber-300">
            {stop.platform_code}
          </span>
        )}
        {distanceRounded != null && distanceRounded >= 10 && (
          <DistanceBadge meters={distanceRounded} bearingDeg={bearing} showDirection />
        )}
        {stop.wheelchair_boarding === 1 && (
          <span className="shrink-0 rounded bg-blue-100 px-1.5 py-0.5 text-blue-700 dark:bg-blue-900 dark:text-blue-300">
            <Accessibility size={14} strokeWidth={2} />
          </span>
        )}
        {stop.wheelchair_boarding === 2 && (
          <span className="shrink-0 rounded bg-gray-100 px-1.5 py-0.5 text-gray-700 opacity-30 dark:bg-gray-700 dark:text-gray-300">
            <Accessibility size={14} strokeWidth={2} />
          </span>
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
              size="sm"
            />
          ))}
      </div>
      <StopMetrics stats={stats} geo={geo} infoLevel={infoLevel} />
      {info.isDetailedEnabled && routes && routes.length > 0 && (
        <div className="mt-0.5 flex flex-wrap items-center gap-1">
          {routes.map((r) => (
            <RouteBadge key={r.route_id} route={r} infoLevel={infoLevel} size="xs" />
          ))}
        </div>
      )}
    </div>
  );
}
