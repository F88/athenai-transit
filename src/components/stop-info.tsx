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
      {info.isVerboseEnabled && (
        <VerboseData
          stop={stop}
          distance={distance}
          bearing={bearing}
          routeTypes={routeTypes}
          agencies={agencies}
          routes={routes}
          stats={stats}
          geo={geo}
        />
      )}
    </div>
  );
}

/**
 * Debug dump of all StopInfo props.
 * Only rendered in verbose info level.
 */
function VerboseData({
  stop,
  distance,
  bearing,
  routeTypes,
  agencies,
  routes,
  stats,
  geo,
}: {
  stop: Stop;
  distance?: number;
  bearing: number | null;
  routeTypes: RouteType[];
  agencies: Agency[];
  routes?: Route[];
  stats?: StopWithMeta['stats'];
  geo?: StopWithContext['geo'];
}) {
  return (
    <div className="mt-1 space-y-0.5 text-[9px] text-[#999] dark:text-gray-500">
      <VerboseStop stop={stop} />
      <p className="m-0">
        [position] distance={distance ?? '?'}m bearing=
        {bearing != null ? `${Math.round(bearing)}°` : '?'}
        {` routeTypes=[${routeTypes.join(',')}]`}
      </p>
      <VerboseAgencies agencies={agencies} />
      <VerboseRoutes routes={routes} />
      <VerboseStats stats={stats} />
      <VerboseGeo geo={geo} />
    </div>
  );
}

function VerboseStop({ stop }: { stop: Stop }) {
  return (
    <p className="m-0">
      [stop] lat={stop.stop_lat} lon={stop.stop_lon} loc={stop.location_type}
      {stop.wheelchair_boarding != null && ` wb=${stop.wheelchair_boarding}`}
      {stop.parent_station && ` parent=${stop.parent_station}`}
      {stop.platform_code && ` platform=${stop.platform_code}`}
    </p>
  );
}

function VerboseAgencies({ agencies }: { agencies: Agency[] }) {
  if (agencies.length === 0) {
    return null;
  }
  return (
    <p className="m-0">
      [agencies] [{agencies.map((a) => a.agency_short_name || a.agency_id).join(', ')}]
    </p>
  );
}

function VerboseStats({ stats }: { stats?: StopWithMeta['stats'] }) {
  if (!stats) {
    return null;
  }
  return (
    <p className="m-0">
      [stats] freq={stats.freq} routes={stats.routeCount} types={stats.routeTypeCount}
      {` earliest=${stats.earliestDeparture} latest=${stats.latestDeparture}`}
    </p>
  );
}

function VerboseGeo({ geo }: { geo?: StopWithContext['geo'] }) {
  if (!geo) {
    return null;
  }
  return (
    <p className="m-0">
      [geo] nearestRoute={geo.nearestRoute}km
      {geo.walkablePortal != null && ` portal=${geo.walkablePortal}km`}
      {geo.connectivity &&
        Object.entries(geo.connectivity).map(
          ([group, c]) => ` ${group}:routes=${c.routeCount},freq=${c.freq},stops=${c.stopCount}`,
        )}
    </p>
  );
}

function VerboseRoutes({ routes }: { routes?: Route[] }) {
  if (!routes || routes.length === 0) {
    return null;
  }
  return (
    <p className="m-0">
      [routes] [{routes.map((r) => r.route_short_name || r.route_id).join(', ')}]
    </p>
  );
}
